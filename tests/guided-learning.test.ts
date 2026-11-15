import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateGuidedLesson, parseGuidedResponse, validateGuidedRequest } from '../electron/learning-path';
import { validateGuidedPath } from '../src/study/guided-path';
import { guidedLearningIntent, formatGuidedLesson } from '../src/study/guided-intent';
import { validateArchive, emptyArchive } from '../src/study/history';
import { emptyConversations, newConversation, updateConversationById, validateConversationStore } from '../src/study/conversations';

const topics = [
  { id: 'variables', title: 'Variables', objective: 'Understand stored values' },
  { id: 'functions', title: 'Functions', objective: 'Follow a function call' }
];
const sample = {
  topics,
  lesson: { title: 'Variables', explanation: 'A variable stores a value.', references: [{ file: 'src/game.py', startLine: 1, endLine: 2 }] }
};
const files = [{ file: 'src/game.py', code: '1 | count = 1\n2 | print(count)', lines: 2 }];
const firstRequest = { repository: '/repo', goal: 'Teach me the source code of this repository', mode: 'start' as const };

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('progressive guided learning', () => {
  it('routes only explicit tutorial and next-lesson requests', () => {
    expect(guidedLearningIntent('Teach me about the source code of this repo')).toBe('start');
    expect(guidedLearningIntent('Create a tutorial to understand Python files')).toBe('start');
    expect(guidedLearningIntent('Explain this loop')).toBeNull();
    expect(guidedLearningIntent('Create a coding challenge')).toBeNull();
    const p = parseGuidedResponse(sample, firstRequest, files);
    expect(guidedLearningIntent('Next lesson', p)).toBe('next');
    expect(guidedLearningIntent('Explain the current lesson more simply', p)).toBeNull();
    expect(guidedLearningIntent('Start a new tutorial about the source code', p)).toBe('start');
  });

  it('keeps topics stable and completes the previous topic only after next lesson', () => {
    const first = parseGuidedResponse(sample, firstRequest, files);
    expect(first.currentIndex).toBe(0);
    expect(first.completed).toEqual([]);
    const next = parseGuidedResponse({
      topics: [{ id: 'invented', title: 'Unwanted roadmap', objective: 'Ignore' }],
      lesson: { title: 'Functions', explanation: 'A function groups steps.', references: [{ file: 'src/game.py', startLine: 2, endLine: 2 }] }
    }, { ...firstRequest, mode: 'next', path: first }, files);
    expect(next.topics).toEqual(first.topics);
    expect(next.currentIndex).toBe(1);
    expect(next.completed).toEqual(['variables']);
    expect(formatGuidedLesson(first, true)).toContain('Your learning roadmap');
    expect(formatGuidedLesson(next, false)).toContain('Lesson 2 of 2');
    expect(() => validateGuidedRequest({ ...firstRequest, mode: 'next', path: next })).toThrow('complete');
  });

  it('rejects forged source references, malformed paths and mismatched goals', () => {
    expect(() => parseGuidedResponse({
      ...sample, lesson: { ...sample.lesson, references: [{ file: '.env', startLine: 1, endLine: 2 }] }
    }, firstRequest, files)).toThrow('verified source');
    const first = parseGuidedResponse(sample, firstRequest, files);
    expect(() => validateGuidedPath({ ...first, currentIndex: 99 })).toThrow();
    expect(() => validateGuidedRequest({ ...firstRequest, mode: 'next', goal: 'Other', path: first })).toThrow('goal changed');
  });

  it('persists a guided path independently of challenge entries and other chats', () => {
    const first = parseGuidedResponse(sample, firstRequest, files);
    let store = newConversation(emptyConversations());
    const id = store.activeId!;
    store = updateConversationById(store, id, archive => ({ ...archive, guidedPath: first }));
    store = newConversation(store);
    const restored = validateConversationStore(JSON.parse(JSON.stringify(store)));
    expect(restored.conversations.find(c => c.id === id)?.archive.guidedPath).toEqual(first);
    expect(restored.conversations.find(c => c.id === restored.activeId)?.archive.guidedPath).toBeUndefined();
    expect(validateArchive(emptyArchive()).guidedPath).toBeUndefined();
  });

  it('generates a source-grounded roadmap without a coding challenge', async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'studyrepo-guided-')));
    try {
      await mkdir(path.join(root, 'src'));
      await writeFile(path.join(root, 'src', 'game.py'), 'count = 1\nprint(count)');
      await writeFile(path.join(root, '.env'), 'OPENAI_API_KEY=should-not-leak');
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
      const mocked = vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { store: boolean; input: string; text: { format: { type: string } }; instructions: string };
        expect(body.store).toBe(false);
        expect(body.text.format.type).toBe('json_schema');
        expect(body.input).toContain('src/game.py');
        expect(body.input).not.toContain('should-not-leak');
        expect(body.instructions).toContain('one concept per lesson');
        expect(body.instructions).toContain('Do not create coding challenges');
        return { ok: true, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(sample) }] }] }) };
      });
      vi.stubGlobal('fetch', mocked);
      const result = await generateGuidedLesson({ ...firstRequest, repository: root });
      expect(result.topics).toHaveLength(2);
      expect(result.lesson.references[0].file).toBe('src/game.py');
      expect(mocked).toHaveBeenCalledTimes(1);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
