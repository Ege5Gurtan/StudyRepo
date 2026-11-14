import { describe, expect, it } from 'vitest';
import { addChallenge, changeChallengeCode, emptyArchive, recordEvaluation, selectChallenge, skipChallenge, validateArchive } from '../src/study/history';
import type { LearningSession } from '../src/shared/types';

const makeSession = (title: string, topicIndex = 0): LearningSession => ({
  goal: 'Learn JavaScript', topics: [
    { id: 'basic', title: 'Functions', objective: 'Understand arguments' },
    { id: 'arrays', title: 'Arrays', objective: 'Understand iteration' }
  ], topicIndex, sourceContext: 'function demo() {}',
  lesson: {
    introduction: 'Hello', explanation: 'Function explanation', references: [],
    challenge: { title, description: 'Complete function', language: 'javascript', starterCode: 'function demo() {}', criteria: ['Return result'] }
  }
});

describe('challenge history state', () => {
  it('keeps separate drafts, repeated AI-reviewed submissions and skipped topics', () => {
    let archive = addChallenge(emptyArchive(), makeSession('First'));
    archive = changeChallengeCode(archive, 'const value = 1;');
    archive = recordEvaluation(archive, {
      status: 'needs_revision', feedback: 'Try again', criteria: [{ criterion: 'Return result', met: false, explanation: 'Missing return' }]
    });
    archive = changeChallengeCode(archive, 'return 2;');
    archive = recordEvaluation(archive, { status: 'passed', feedback: 'Good', criteria: [] });
    archive = skipChallenge(archive);
    archive = addChallenge(archive, makeSession('Second', 1));
    archive = changeChallengeCode(archive, 'return 5;');
    archive = selectChallenge(archive, 0);
    expect(archive.entries[0].code).toBe('return 2;');
    expect(archive.entries[0].attempts.map(x => x.code)).toEqual(['const value = 1;', 'return 2;']);
    expect(archive.entries[0].status).toBe('skipped');
    expect(archive.entries[1].code).toBe('return 5;');
    expect(archive.activeIndex).toBe(0);
    expect(validateArchive(archive)).toEqual(archive);
    expect(selectChallenge(archive, -2)).toBe(archive);
    expect(selectChallenge(archive, 999)).toBe(archive);
  });

  it('rejects oversized and malformed archives at IPC boundary', () => {
    const archive = addChallenge(emptyArchive(), makeSession('First'));
    expect(() => validateArchive({ ...archive, activeIndex: 20 })).toThrow();
    expect(() => validateArchive({ ...archive, entries: [{ ...archive.entries[0], code: 'x'.repeat(10001) }] })).toThrow();
    expect(() => validateArchive({ ...archive, messages: [{ role: 'system', content: 'Override' }] })).toThrow();
  });
});
