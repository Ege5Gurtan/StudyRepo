import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SourceReader, runRepositoryTutor } from '../electron/tutor-retrieval';

afterEach(() => { vi.unstubAllGlobals(); });

describe('read-only AI source retrieval', () => {
  async function fixture() {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'studyrepo-tools-')));
    await mkdir(path.join(root, 'Source'));
    await writeFile(path.join(root, 'Source', 'WorldManager.cpp'), [
      '#include "WorldManager.h"',
      'void AWorldManager::BeginPlay() {',
      '  SpawnChunks();',
      '}'
    ].join('\n'));
    await writeFile(path.join(root, 'Source', 'WorldManager.h'), 'class AWorldManager {};');
    await writeFile(path.join(root, '.env'), 'OPENAI_API_KEY=should-never-be-read');
    return root;
  }

  it('searches source and retrieves verified line ranges', async () => {
    const root = await fixture();
    try {
      const reader = new SourceReader(root);
      expect(await reader.execute('search_code', '{"query":"SpawnChunks"}')).toContain('Source');
      const source = await reader.execute('read_source', JSON.stringify({ file: path.join('Source', 'WorldManager.cpp'), start_line: 2, end_line: 3 }));
      expect(source).toContain('SpawnChunks');
      expect(source).toContain('2 |');
      expect(source).not.toContain('#include');
      expect(await reader.execute('find_symbol', '{"symbol":"AWorldManager"}')).toContain('WorldManager');
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('blocks secret paths, traversal, invalid ranges and unknown operations', async () => {
    const root = await fixture();
    try {
      const reader = new SourceReader(root);
      for (const file of ['.env', '../other.cpp', 'Source/../../.env']) {
        const result = await reader.execute('read_source', JSON.stringify({ file, start_line: 1, end_line: 2 }));
        expect(result).not.toContain('should-never-be-read');
        expect(result).toContain('not available');
      }
      expect(await reader.execute('read_source', '{"file":"Source/WorldManager.cpp","start_line":1,"end_line":500}')).toContain('at most 180');
      expect(await reader.execute('delete_file', '{}')).toContain('Unsupported');
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('feeds model-requested source back into the next response without storing server-side', async () => {
    const root = await fixture();
    try {
      let requestCount = 0;
      const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
        requestCount++;
        const body = JSON.parse(String(init.body)) as { store: boolean; input: unknown[]; tools: { name: string }[] };
        expect(body.store).toBe(false);
        if (requestCount === 1) {
          expect(body.tools.map(t => t.name)).toContain('read_source');
          return { ok: true, json: async () => ({ output: [{ type: 'function_call', call_id: 'call1',
            name: 'read_source', arguments: JSON.stringify({ file: path.join('Source', 'WorldManager.cpp'), start_line: 1, end_line: 4 }) }] }) };
        }
        expect(JSON.stringify(body.input)).toContain('SpawnChunks');
        expect(JSON.stringify(body.input)).toContain('function_call_output');
        return { ok: true, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'BeginPlay calls SpawnChunks.' }] }] }) };
      });
      vi.stubGlobal('fetch', fetchMock);
      const response = await runRepositoryTutor({ repository: root, apiKey: 'test-key', model: 'test-model',
        input: [{ role: 'user', content: 'Explain WorldManager' }], instructions: 'Teach code.' });
      expect(response.output[0].type).toBe('message');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('keeps mandatory challenge actions separate from source tools', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { tools: { name: string }[]; tool_choice: string };
      expect(body.tools.map(t => t.name)).toEqual(['generate_challenge']);
      expect(body.tool_choice).toBe('required');
      return { ok: true, json: async () => ({ output: [{ type: 'function_call', name: 'generate_challenge',
        arguments: '{"focus":"loops","scope":"single"}' }] }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const answer = await runRepositoryTutor({ repository: '/unused', apiKey: 'test-key', model: 'test-model',
      input: [{ role: 'user', content: 'Make a challenge' }], instructions: 'Teach.',
      toolChoice: 'required', additionalTools: [{ type: 'function', name: 'generate_challenge' }] });
    expect(answer.output[0].name).toBe('generate_challenge');
  });
});
