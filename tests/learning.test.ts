import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { sourceCandidates, retrieveLearningContext, validateGenerateRequest, parseLesson, validateEvaluation, generateLesson, evaluateSolution } from '../electron/learning';

const lesson = {
  topics: [{ id: 'functions', title: 'Functions', objective: 'Learn function parameters.' }],
  introduction: 'Let us explore a function.',
  explanation: 'The function returns one value based on its argument.',
  references: [{ file: 'src/game.js', startLine: 1, endLine: 2 }],
  challenge: { title: 'Double', description: 'Create a function returning double an input.', language: 'javascript',
    starterCode: 'function double(n) {\n  // TODO\n}', criteria: ['Return n * 2'] }
};

const response = (data: object) => ({ ok: true, json: async () => ({
  output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }]
}) });

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('adaptive learning', () => {
  it('excludes secret files and non-code documents from retrieval candidates', () => {
    expect(sourceCandidates([
      { name: 'src', path: 'src', type: 'directory', children: [
        { name: 'game.js', path: 'src/game.js', type: 'file' },
        { name: '.env.local', path: 'src/.env.local', type: 'file' },
        { name: 'secret.py', path: 'src/secrets/secret.py', type: 'file' },
        { name: 'note.md', path: 'src/note.md', type: 'file' }
      ] }
    ])).toEqual(['src/game.js']);
  });

  it('rejects oversized learning goals and malformed modes', () => {
    expect(() => validateGenerateRequest({ repository: '/repo', goal: 'x'.repeat(1501), mode: 'start' })).toThrow();
    expect(() => validateGenerateRequest({ repository: '/repo', goal: 'functions', mode: 'arbitrary' })).toThrow();
    expect(() => validateGenerateRequest({ repository: '/repo', goal: 'functions', mode: 'next' })).toThrow();
  });

  it('drops fabricated references and validates actual source line ranges', () => {
    const result = parseLesson({ ...lesson, references: [
      ...lesson.references, { file: 'nonexistent.js', startLine: 1, endLine: 5 },
      { file: 'src/game.js', startLine: 1, endLine: 999 }
    ] }, [{ file: 'src/game.js', code: 'function foo() {}\nfoo();', totalLines: 2 }],
    { repository: '/repo', goal: 'functions', mode: 'start' });
    expect(result.lesson.references).toEqual([{ file: 'src/game.js', startLine: 1, endLine: 2 }]);
    expect(result.lesson.challenge.language).toBe('javascript');
  });

  it('extends completed plans by replacing the short topic batch and resetting its index', () => {
    const prior = [
      { id: 'state', title: 'React state', objective: 'Use state safely' },
      { id: 'arrays', title: 'Arrays', objective: 'Transform arrays' },
      { id: 'loops', title: 'Loops', objective: 'Iterate' }
    ];
    const request = validateGenerateRequest({
      repository: '/repo', goal: 'learn JavaScript', mode: 'extend', topics: prior,
      topicIndex: 2, focus: 'Give me another set of challenges.'
    });
    const next = {
      ...lesson,
      topics: [
        { id: 'objects', title: 'Objects', objective: 'Understand object copying' },
        { id: 'functions', title: 'Closures', objective: 'Understand callbacks' }
      ]
    };
    const result = parseLesson(next, [{ file: 'src/game.js', code: 'function foo() {}\nfoo();', totalLines: 2 }], request);
    expect(result.topics).toEqual(next.topics);
    expect(result.topicIndex).toBe(0);
    expect(result.lesson.challenge.title).toBe('Double');
    expect(() => validateGenerateRequest({ ...request, focus: 'x'.repeat(1501) })).toThrow();
  });

  it('supports a focused challenge that replaces old topic labels', () => {
    const oldTopics = [{ id: 'react', title: 'React state', objective: 'Hooks' }];
    const request = validateGenerateRequest({
      repository: '/repo', goal: 'Learn JavaScript', mode: 'focused',
      topics: oldTopics, topicIndex: 0, focus: 'Tile mechanics'
    });
    const result = parseLesson({
      ...lesson, topics: [{ id: 'terrain', title: 'Tile mechanics', objective: 'Count masked tiles' }]
    }, [{ file: 'src/game.js', code: 'function f() {}', totalLines: 1 }], request);
    expect(result.topicIndex).toBe(0);
    expect(result.topics[0].title).toBe('Tile mechanics');
    expect(result.topics).not.toEqual(oldTopics);
  });

  it('validates evaluation evidence and avoids equating unsupported status with success', () => {
    expect(validateEvaluation({ status: 'unable_to_verify', feedback: 'Requires execution.', criteria: [] }).status).toBe('unable_to_verify');
    expect(() => validateEvaluation({ status: 'compiled', feedback: 'Everything works.', criteria: [] })).toThrow();
  });

  it('retrieves code only from repository source and generates a structured lesson', async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'studyrepo-learning-')));
    try {
      await mkdir(path.join(root, 'src'));
      await writeFile(path.join(root, 'src', 'game.js'), 'function getActive(items) {\n return items.filter(x => x.active);\n}');
      await writeFile(path.join(root, 'src', '.env'), 'OPENAI_API_KEY=SECRET');
      const inlineToken = 'sk-proj-' + 'a'.repeat(35);
      await writeFile(path.join(root, 'src', 'inline.js'), 'const token = "' + inlineToken + '";');
      const files = await retrieveLearningContext(root, 'game functions');
      expect(files).toHaveLength(2);
      expect(files[0].code).not.toContain('SECRET');
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
      const fetchMock = vi.fn(async () => response(lesson));
      vi.stubGlobal('fetch', fetchMock);
      const result = await generateLesson({ repository: root, goal: 'game functions', mode: 'start' });
      expect(result.lesson.challenge.title).toBe('Double');
      expect(result.lesson.references).toHaveLength(1);
      const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as {
        store: boolean; text: { format: { type: string } }; input: string
      };
      expect(body.store).toBe(false);
      expect(body.text.format.type).toBe('json_schema');
      expect(body.input).not.toContain('SECRET');
      expect(body.input).not.toContain(inlineToken);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('finds relevant terrain code by content even when other files sort first', async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'studyrepo-focused-')));
    try {
      await mkdir(path.join(root, 'src'));
      for (const file of ['a.js', 'b.js', 'c.js']) {
        await writeFile(path.join(root, 'src', file), 'const unrelated = true;');
      }
      await writeFile(path.join(root, 'src', 'terrain.js'), 'export function countMaskedTiles(terrain) { return terrain.flat().filter(tile => tile.masked).length; }');
      const files = await retrieveLearningContext(root, 'create a coding challenge about tile mechanics');
      expect(files.some(file => file.file.endsWith('terrain.js'))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('returns an AI code review without running student code', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async () => response({
      status: 'needs_revision', feedback: 'Return the result rather than logging it.',
      criteria: [{ criterion: 'Return n * 2', met: false, explanation: 'Missing return statement.' }]
    })));
    const result = await evaluateSolution({
      repository: '/repo', lesson: {
        introduction: lesson.introduction, explanation: lesson.explanation, references: [], challenge: lesson.challenge
      }, code: 'function double(n) { console.log(n * 2); }'
    });
    expect(result.status).toBe('needs_revision');
    expect(result.criteria[0].met).toBe(false);
  });
});
