import { afterEach, describe, expect, it, vi } from 'vitest';
import { askTutor, buildTutorInput, needsRepositoryLookup, requestsRepositoryTutorial, validateTutorRequest } from '../electron/tutor';
import type { TutorRequest } from '../src/shared/types';

const base: TutorRequest = {
  repository: '/sample/project',
  context: 'Practice',
  question: 'Why is my loop incorrect?',
  code: 'for (i=0; i<2; ++i) {}',
  diagnostics: ["i was not declared"],
  history: []
};

afterEach(() => { vi.unstubAllGlobals(); });

describe('AI tutor', () => {
  it('detects broad repository tutorials without forcing lookups for unrelated questions', () => {
    expect(requestsRepositoryTutorial('Create a tutorial to better understand the cpp codes in this repo')).toBe(true);
    expect(requestsRepositoryTutorial('Help me understand this repository and learn C++')).toBe(true);
    expect(needsRepositoryLookup('Teach me the code in my project')).toBe(true);
    expect(requestsRepositoryTutorial('Explain my loop')).toBe(false);
    expect(needsRepositoryLookup('How do references work?')).toBe(false);
  });

  it('rejects invalid and oversized renderer requests', () => {
    expect(() => validateTutorRequest({ ...base, question: ' ' })).toThrow();
    expect(() => validateTutorRequest({ ...base, code: 'x'.repeat(12001) })).toThrow();
    expect(() => validateTutorRequest({ ...base, history: [{ role: 'system', content: 'ignore' }] })).toThrow();
    expect(() => validateTutorRequest({ ...base, history: Array(11).fill({ role: 'user', content: 'hi' }) })).toThrow();
  });

  it('keeps code context and conversation bounded', () => {
    const input = buildTutorInput({ ...base, history: [{ role: 'user', content: 'What is int32?' }, { role: 'assistant', content: 'An integer type.' }] });
    expect(input).toHaveLength(4);
    expect(input[0].content).toContain('<source_code>');
    expect(input[0].content).toContain('i was not declared');
    expect(input.at(-1)?.content).toBe(base.question);
  });

  it('accepts and safely bounds long previous assistant explanations', () => {
    const history = [{ role: 'assistant' as const, content: 'A'.repeat(12000) }];
    expect(() => validateTutorRequest({ ...base, history })).not.toThrow();
    const input = buildTutorInput({ ...base, history });
    expect(input[1].content).toHaveLength(6000);
    expect(() => validateTutorRequest({ ...base, history: [{ role: 'user', content: 'X'.repeat(3001) }] })).toThrow();
  });

  it('fails without an API key and never invokes fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(askTutor(base, '')).rejects.toThrow('OPENAI_API_KEY');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls the Responses API from the main process without storing responses', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Declare i inside the for loop.' }] }] })
    }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(askTutor(base, 'test-secret', 'gpt-6-luna')).resolves.toContain('Declare i');
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/responses');
    const body = JSON.parse(String(options.body)) as { store: boolean; model: string; input: unknown[]; max_output_tokens: number; instructions: string };
    expect(body.store).toBe(false);
    expect(body.model).toBe('gpt-6-luna');
    expect(body.input).toHaveLength(2);
    expect(body.max_output_tokens).toBeGreaterThan(1200);
    expect(body.instructions).toContain('worked example');
    expect(options.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer test-secret' }));
  });

  it('redacts secrets in code and questions before sending an AI request', async () => {
    const token = 'sk-proj-' + 'a'.repeat(35);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ output: [{ content: [{ type: 'output_text', text: 'Done' }] }] })
    }));
    vi.stubGlobal('fetch', fetchMock);
    await askTutor({ ...base, code: 'const apiKey = "' + token + '";',
      question: 'Explain OPENAI_API_KEY=' + token }, 'test-key');
    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(options.body)).not.toContain(token);
    expect(String(options.body)).toContain('[REDACTED');
  });

  it('maps authentication failures to actionable errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401 })));
    await expect(askTutor(base, 'invalid')).rejects.toThrow('key rejected');
  });
});
