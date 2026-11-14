import { describe, expect, it } from 'vitest';
import { addChallenge, addChallengeWithTutorExplanation, changeChallengeCode, emptyArchive, recordEvaluation, selectChallenge, skipChallenge, validateArchive } from '../src/study/history';
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

  it('keeps the exact submitted snapshot when the draft changes before review returns', () => {
    let archive = addChallenge(emptyArchive(), makeSession('Async review'));
    const submittedCode = 'return 1;';
    archive = changeChallengeCode(archive, submittedCode);
    archive = changeChallengeCode(archive, 'return 2;');
    archive = recordEvaluation(archive, { status: 'needs_revision', feedback: 'Review of first version', criteria: [] }, submittedCode);
    expect(archive.entries[0].code).toBe('return 2;');
    expect(archive.entries[0].attempts[0].code).toBe('return 1;');
  });

  it('adds the next lesson explanation to Tutor with a link to the new challenge', () => {
    const first = addChallenge(emptyArchive(), makeSession('First'));
    const advanced = addChallengeWithTutorExplanation(first, makeSession('Second', 1));
    expect(advanced.entries).toHaveLength(2);
    expect(advanced.entries[0].status).toBe('active');
    expect(advanced.entries[1].session.lesson.challenge.title).toBe('Second');
    expect(advanced.messages).toHaveLength(1);
    expect(advanced.messages[0]).toMatchObject({
      role: 'assistant',
      challengeId: advanced.entries[1].id
    });
    expect(advanced.messages[0].content).toContain('Function explanation');
    expect(advanced.messages[0].content).toContain('Complete function');
    expect(validateArchive(advanced)).toEqual(advanced);
  });

  it('skips the previous challenge and persists the new Tutor explanation without losing older messages', () => {
    const first = addChallenge(emptyArchive(), makeSession('First'));
    const previous = { ...first, messages: [{ role: 'user' as const, content: 'Help with this' }] };
    const advanced = addChallengeWithTutorExplanation(previous, makeSession('After skip', 1), true);
    expect(advanced.entries[0].status).toBe('skipped');
    expect(advanced.entries[1].status).toBe('active');
    expect(advanced.messages[0]).toEqual(previous.messages[0]);
    expect(advanced.messages[1].challengeId).toBe(advanced.entries[1].id);
    expect(advanced.messages[1].content).toContain('After skip');
    expect(validateArchive(advanced)).toEqual(advanced);
  });

  it('rejects oversized and malformed archives at IPC boundary', () => {
    const archive = addChallenge(emptyArchive(), makeSession('First'));
    expect(() => validateArchive({ ...archive, activeIndex: 20 })).toThrow();
    expect(() => validateArchive({ ...archive, entries: [{ ...archive.entries[0], code: 'x'.repeat(10001) }] })).toThrow();
    expect(() => validateArchive({ ...archive, messages: [{ role: 'system', content: 'Override' }] })).toThrow();
  });
});
