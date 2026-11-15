import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { requestsCurrentLessonChallenge } from '../src/study/guided-intent';
import { buildTutorInput, validateTutorRequest } from '../electron/tutor';
import { askTutorWithActions } from '../electron/tutor-actions';
import { generateLesson, retrieveGuidedChallengeContext, validateGenerateRequest, parseLesson } from '../electron/learning';
import type { GuidedLessonFocus, LearningGenerateRequest } from '../src/shared/types';

const lesson: GuidedLessonFocus = {
  title: 'How updates work',
  objective: 'Understand when an update callback runs',
  references: [{ file: 'src/actor.py', startLine: 2, endLine: 3 }]
};
const focusRequest = (root: string): LearningGenerateRequest => ({
  repository: root, goal: 'Understand this project', mode: 'focused',
  topics: [{ id: 'update', title: 'Update callbacks', objective: lesson.objective }],
  topicIndex: 0, focus: 'Practice the current guided lesson',
  guidedLesson: lesson
});
const payload = {
  topics: [{ id: 'update', title: 'Update callbacks', objective: lesson.objective }],
  introduction: 'Practice the callback.',
  explanation: 'Consider the condition.',
  references: [{ file: 'src/actor.py', startLine: 2, endLine: 3 }],
  challenge: {
    title: 'Change a condition',
    description: 'Change one condition, then predict when an update happens.',
    language: 'python',
    starterCode: 'def update(enabled):\n    # TODO: update if enabled\n    pass',
    criteria: ['Condition correctly controls updates']
  }
};

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('guided lesson to practice alignment', () => {
  it('routes generic one-off challenges to the current lesson, not requested custom topics or quiz', () => {
    expect(requestsCurrentLessonChallenge('Create a coding challenge using this repository.')).toBe(true);
    expect(requestsCurrentLessonChallenge('Practice this lesson')).toBe(true);
    expect(requestsCurrentLessonChallenge('Challenge me on the current lesson')).toBe(true);
    expect(requestsCurrentLessonChallenge('Create a challenge about memory allocators')).toBe(false);
    expect(requestsCurrentLessonChallenge('Give me another set of challenges')).toBe(false);
    expect(requestsCurrentLessonChallenge('Ask me a multiple-choice question')).toBe(false);
  });

  it('adds lesson objective and verified file ranges to the normal tutor request', async () => {
    const req = {
      repository: '/repo', context: 'Practice' as const, code: '', history: [],
      question: 'Why does the update callback run?', guidedLesson: lesson
    };
    expect(validateTutorRequest(req)).toEqual(req);
    const input = buildTutorInput(req);
    expect(input[0].content).toContain('Learning objective: ' + lesson.objective);
    expect(input[0].content).toContain('src/actor.py:2-3');
    expect(() => validateTutorRequest({ ...req, guidedLesson: { ...lesson, references: [{ file: '.env', startLine: 2, endLine: 999 }] } })).toThrow();
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const fetchMock = vi.fn(async (_url: string, opts: RequestInit) => {
      const body = JSON.parse(String(opts.body)) as { tool_choice: string; tools: { name: string }[] };
      expect(body.tool_choice).toBe('required');
      expect(body.tools.map(t => t.name)).toContain('read_source');
      return { ok: true, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Runs when enabled.' }] }] }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await askTutorWithActions(req)).toEqual({ type: 'message', text: 'Runs when enabled.' });
  });

  it('rejects missing guided source, out-of-range references and unsupported guided modes', async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'studyrepo-guided-practice-')));
    try {
      await mkdir(path.join(root, 'src'));
      await writeFile(path.join(root, 'src', 'actor.py'), 'class Actor:\n    def update(self):\n        return True');
      await writeFile(path.join(root, '.env'), 'secret=PRIVATE');
      const files = await retrieveGuidedChallengeContext(root, lesson);
      expect(files).toHaveLength(1);
      expect(files[0].code).toContain('2 |');
      expect(files[0].code).not.toContain('class Actor');
      expect(files[0].code).not.toContain('PRIVATE');
      expect(() => parseLesson({ ...payload, references: [{ file: 'src/actor.py', startLine: 1, endLine: 2 }] }, files, focusRequest(root))).not.toThrow();
      const parsed = parseLesson({ ...payload, references: [{ file: 'src/actor.py', startLine: 1, endLine: 2 }] }, files, focusRequest(root));
      expect(parsed.lesson.references).toEqual([]);
      await expect(retrieveGuidedChallengeContext(root, { ...lesson, references: [{ file: '.env', startLine: 1, endLine: 1 }] })).rejects.toThrow('not available');
      expect(() => validateGenerateRequest({ ...focusRequest(root), mode: 'start' })).toThrow('lesson-aligned');
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('generates a small challenge tied to lesson objective rather than a broad reconstruction request', async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'studyrepo-objective-')));
    try {
      await mkdir(path.join(root, 'src'));
      await writeFile(path.join(root, 'src', 'actor.py'), 'class Actor:\n    def update(self):\n        return True');
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
      const mock = vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { input: string; instructions: string; store: boolean };
        expect(body.store).toBe(false);
        expect(body.input).toContain('SINGLE LEARNING OBJECTIVE');
        expect(body.input).toContain(lesson.objective);
        expect(body.input).toContain('src/actor.py');
        expect(body.input).not.toContain('class Actor');
        expect(body.instructions).toContain('not memorization or reconstruction');
        return { ok: true, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(payload) }] }] }) };
      });
      vi.stubGlobal('fetch', mock);
      const result = await generateLesson(focusRequest(root));
      expect(result.lesson.challenge.title).toBe('Change a condition');
      expect(result.lesson.references).toEqual(lesson.references);
      expect(mock).toHaveBeenCalledTimes(1);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
