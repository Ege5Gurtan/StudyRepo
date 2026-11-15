import { afterEach, describe, expect, it, vi } from 'vitest';
import { askTutorWithActions, explicitlyRequestsChallenge, parseTutorAction } from '../electron/tutor-actions';

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
    const sent = JSON.parse(String(init.body)) as { store: boolean; tools: { name: string }[]; tool_choice: string; parallel_tool_calls: boolean; max_output_tokens: number };
    expect(sent.store).toBe(false);
    expect(sent.tool_choice).toBe('required');
    expect(sent.parallel_tool_calls).toBe(false);
    expect(sent.max_output_tokens).toBeGreaterThan(1200);
    expect(sent.tools.map(t => t.name)).toEqual(['generate_challenge']);
  });
  it('requires an action for explicit imperative requests but not for ordinary explanations', () => {
    expect(explicitlyRequestsChallenge('create challenge about the tile mechanics')).toBe(true);
    expect(explicitlyRequestsChallenge('Give me another set of challenges.')).toBe(true);
    expect(explicitlyRequestsChallenge('Explain what this code does.')).toBe(false);
    expect(explicitlyRequestsChallenge('Can you explain the next challenge?')).toBe(false);
  });

  it('leaves the model free to answer normal questions', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const mock = vi.fn(async () => ({
      ok: true, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'A loop iterates.' }] }] })
    }));
    vi.stubGlobal('fetch', mock);
    const result = await askTutorWithActions({ ...base, question: 'Explain loops to me' });
    expect(result).toEqual({ type: 'message', text: 'A loop iterates.' });
    const body = JSON.parse(String((mock.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as { tool_choice: string };
    expect(body.tool_choice).toBe('auto');
  });

  it('does not generate challenges for broad learning goals or multiple-choice requests', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const fetchMock = vi.fn(async () => ({
      ok: true, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Here is a C++ overview.' }] }] })
    }));
    vi.stubGlobal('fetch', fetchMock);
    for (const question of ['Help me understand this repository and learn C++', 'Ask me a multiple choice question']) {
      const result = await askTutorWithActions({ ...base, question });
      expect(result).toEqual({ type: 'message', text: 'Here is a C++ overview.' });
      const [, init] = fetchMock.mock.calls.at(-1)! as unknown as [string, RequestInit];
      const sent = JSON.parse(String(init.body)) as { tool_choice: string; instructions: string };
      expect(sent.tool_choice).toBe('auto');
      expect(sent.instructions).toContain('multiple-choice');
    }
  });
  it('investigates repository source before generating language-agnostic tutorials', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const mock = vi.fn(async () => ({ ok: true, json: async () => ({
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'Lesson one.' }] }]
    }) }));
    vi.stubGlobal('fetch', mock);
    const reply = await askTutorWithActions({ ...base, code: '', question: 'Create a tutorial to better understand the cpp codes in this repo' });
    expect(reply).toEqual({ type: 'message', text: 'Lesson one.' });
    const body = JSON.parse(String((mock.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as {
      tool_choice: string; tools: { name: string }[]; input: Array<{ content?: string }>; instructions: string
    };
    expect(body.tool_choice).toBe('required');
    expect(body.tools.map(t => t.name)).toContain('read_source');
    expect(body.tools.map(t => t.name)).toContain('list_source_files');
    expect(JSON.stringify(body.input)).not.toContain('Partial repository sample');
    expect(body.instructions).toContain('ONE coherent first lesson');
    expect(body.instructions).toContain('language-specific constructs');
    expect(body.instructions).toContain('mixed-language repositories');
    expect(body.instructions).not.toContain('Do not assume familiarity with constructors');
  });

  it('does not allow structured actions outside Practice', async () => {
    await expect(askTutorWithActions({ ...base, context: 'Explorer' })).rejects.toThrow('Practice');
  });
});
