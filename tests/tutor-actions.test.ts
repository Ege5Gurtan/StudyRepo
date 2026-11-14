import { afterEach, describe, expect, it, vi } from 'vitest';
import { askTutorWithActions, parseTutorAction } from '../electron/tutor-actions';

const base = {
  repository: '/sample', context: 'Practice' as const,
  code: 'function flipCargoBits(cargo) {}', question: 'create challenge about tile mechanics', history: []
};
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('structured tutor actions', () => {
  it('turns a model function call into a validated challenge action', () => {
    expect(parseTutorAction({ output: [{
      type: 'function_call', name: 'generate_challenge',
      arguments: JSON.stringify({ focus: 'tile mechanics', scope: 'single' })
    }] })).toEqual({ type: 'generate_challenge', focus: 'tile mechanics', scope: 'single' });
  });
  it('returns a normal message for explanations and hints', () => {
    expect(parseTutorAction({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'A loop iterates.' }] }] }))
      .toEqual({ type: 'message', text: 'A loop iterates.' });
  });
  it('rejects unknown functions, bad arguments and multiple actions', () => {
    expect(() => parseTutorAction({ output: [{ type: 'function_call', name: 'delete_file', arguments: '{}' }] })).toThrow();
    expect(() => parseTutorAction({ output: [{ type: 'function_call', name: 'generate_challenge', arguments: '{}' }] })).toThrow();
    expect(() => parseTutorAction({ output: [
      { type: 'function_call', name: 'generate_challenge', arguments: '{"focus":"loops","scope":"single"}' },
      { type: 'function_call', name: 'generate_challenge', arguments: '{"focus":"arrays","scope":"single"}' }
    ] })).toThrow();
  });
  it('requests a model tool for direct challenge requests and never writes repository files', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-token');
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ output: [{
        type: 'function_call', name: 'generate_challenge',
        arguments: '{"focus":"tile mechanics","scope":"single"}'
      }] })
    }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await askTutorWithActions(base)).toEqual({ type: 'generate_challenge', focus: 'tile mechanics', scope: 'single' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/responses');
    const sent = JSON.parse(String(init.body)) as { store: boolean; tools: { name: string }[]; tool_choice: string; parallel_tool_calls: boolean };
    expect(sent.store).toBe(false);
    expect(sent.tool_choice).toBe('auto');
    expect(sent.parallel_tool_calls).toBe(false);
    expect(sent.tools.map(t => t.name)).toEqual(['generate_challenge']);
  });
  it('does not allow structured actions outside Practice', async () => {
    await expect(askTutorWithActions({ ...base, context: 'Explorer' })).rejects.toThrow('Practice');
  });
});
