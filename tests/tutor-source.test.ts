import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { namedFileInQuestion, findNamedSource, excerptSource, retrieveNamedFileContext } from '../electron/tutor-source';
import { askTutor } from '../electron/tutor';
import type { TutorRequest } from '../src/shared/types';

const request = (repository: string, question: string): TutorRequest => ({
  repository, question, context: 'Practice', code: 'A previous short partial excerpt', history: []
});
afterEach(() => vi.unstubAllGlobals());

describe('source-grounded tutor questions', () => {
  it('resolves a named C++ source file without guessing other filenames', () => {
    expect(namedFileInQuestion('Tell me more about WorldManager.cpp')).toBe('WorldManager.cpp');
    expect(namedFileInQuestion('Explain how arrays work')).toBeNull();
    expect(findNamedSource([
      { name: 'Source', path: 'Source', type: 'directory', children: [
        { name: 'WorldManager.cpp', path: 'Source/WorldManager.cpp', type: 'file' },
        { name: 'WorldManager.cpp', path: 'Source/private/WorldManager.cpp', type: 'file' },
        { name: 'WorldManager.cpp', path: 'Source/secrets/WorldManager.cpp', type: 'file' }
      ] }
    ], 'WorldManager.cpp')).toEqual(['Source/WorldManager.cpp']);
  });

  it('labels partial excerpts and retrieves later requested line ranges', () => {
    const content = Array.from({ length: 500 }, (_, i) => 'Line ' + (i + 1) + ': ' + 'void Tick() {};'.repeat(12)).join('\n');
    const first = excerptSource(content, 'WorldManager.cpp', 'explain');
    expect(first).toContain('PARTIAL EXCERPT');
    expect(first).toContain('of 500');
    const later = excerptSource(content, 'WorldManager.cpp', 'explain lines 250-260');
    expect(later).toContain('Showing lines 250-260 of 500');
    expect(later).toContain('  250 |');
    expect(later).not.toContain('PARTIAL EXCERPT');
  });

  it('reads the actual imported source instead of relying only on older session snippets', async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'studyrepo-source-')));
    try {
      await mkdir(path.join(root, 'Source'));
      await writeFile(path.join(root, 'Source', 'WorldManager.cpp'), 'void AWorldManager::BeginPlay() {}\nvoid AWorldManager::Tick(float dt) {}');
      const context = await retrieveNamedFileContext(request(root, 'Tell me more about WorldManager.cpp'));
      expect(context).toContain('WorldManager.cpp');
      expect(context).toContain('AWorldManager::Tick');
      expect(context).not.toContain('PARTIAL EXCERPT');
      vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
        const payload = JSON.parse(String(init.body)) as { input: { content: string }[] };
        expect(payload.input.some(i => i.content.includes('AWorldManager::Tick'))).toBe(true);
        return { ok: true, json: async () => ({ output: [{ content: [{ type: 'output_text', text: 'Tick runs each frame.' }] }] }) };
      }));
      await expect(askTutor(request(root, 'Tell me more about WorldManager.cpp'), 'test-api-key')).resolves.toBe('Tick runs each frame.');
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('does not silently choose between ambiguous matching filenames', async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'studyrepo-ambiguous-')));
    try {
      for (const dir of ['a','b']) {
        await mkdir(path.join(root, dir));
        await writeFile(path.join(root, dir, 'WorldManager.cpp'), 'void foo() {}');
      }
      const context = await retrieveNamedFileContext(request(root, 'Explain WorldManager.cpp'));
      expect(context).toContain('Multiple matching source files');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
