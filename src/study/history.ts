import type { ChallengeHistoryEntry, LearningArchive, LearningEvaluation, LearningSession, TutorMessage } from '../shared/types';

export const emptyArchive = (): LearningArchive => ({ entries: [], activeIndex: -1, messages: [] });

export function addChallenge(archive: LearningArchive, session: LearningSession): LearningArchive {
  const entry: ChallengeHistoryEntry = {
    id: crypto.randomUUID(), session, code: session.lesson.challenge.starterCode,
    attempts: [], status: 'active', createdAt: new Date().toISOString()
  };
  return { ...archive, entries: [...archive.entries, entry], activeIndex: archive.entries.length };
}

export function selectChallenge(archive: LearningArchive, index: number): LearningArchive {
  if (!Number.isInteger(index) || index < 0 || index >= archive.entries.length) return archive;
  return { ...archive, activeIndex: index };
}

export function changeChallengeCode(archive: LearningArchive, code: string): LearningArchive {
  if (archive.activeIndex < 0 || archive.activeIndex >= archive.entries.length) return archive;
  return { ...archive, entries: archive.entries.map((entry, i) => i === archive.activeIndex ? { ...entry, code } : entry) };
}

export function recordEvaluation(archive: LearningArchive, evaluation: LearningEvaluation, submittedCode?: string): LearningArchive {
  return { ...archive, entries: archive.entries.map((entry, i) => i === archive.activeIndex ? {
    ...entry, attempts: [...entry.attempts, { code: submittedCode ?? entry.code, evaluation, submittedAt: new Date().toISOString() }]
  } : entry) };
}

export function skipChallenge(archive: LearningArchive): LearningArchive {
  return { ...archive, entries: archive.entries.map((entry, i) => i === archive.activeIndex ? { ...entry, status: 'skipped' as const } : entry) };
}

export function setChatMessages(archive: LearningArchive, messages: TutorMessage[]): LearningArchive {
  return { ...archive, messages: messages.slice(-40) };
}

export function validateArchive(value: unknown): LearningArchive {
  if (!value || typeof value !== 'object') throw new Error('Invalid learning archive.');
  const archive = value as Partial<LearningArchive>;
  if (!Array.isArray(archive.entries) || archive.entries.length > 10000 ||
    !Number.isInteger(archive.activeIndex) ||
    (archive.activeIndex ?? -2) < -1 || (archive.activeIndex ?? -1) >= archive.entries.length ||
    (archive.entries.length === 0 && archive.activeIndex !== -1) ||
    (archive.entries.length > 0 && archive.activeIndex === -1)) throw new Error('Invalid challenge history.');
  if (!Array.isArray(archive.messages) || archive.messages.length > 40 || !archive.messages.every(m =>
    !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.length <= 16000 &&
    (m.challengeId === undefined || (typeof m.challengeId === 'string' && m.challengeId.length <= 100))
  )) throw new Error('Invalid tutor messages.');
  for (const entry of archive.entries) {
    if (!entry || typeof entry.id !== 'string' || entry.id.length > 100 ||
      (entry.status !== 'active' && entry.status !== 'skipped') ||
      typeof entry.createdAt !== 'string' || entry.createdAt.length > 64 ||
      typeof entry.code !== 'string' || entry.code.length > 10000 ||
      !entry.session || typeof entry.session.goal !== 'string' || entry.session.goal.length > 1500 ||
      typeof entry.session.sourceContext !== 'string' || entry.session.sourceContext.length > 12000 ||
      !Array.isArray(entry.session.topics) || entry.session.topics.length < 1 || entry.session.topics.length > 5 ||
      !Number.isInteger(entry.session.topicIndex) ||
      entry.session.topicIndex < 0 || entry.session.topicIndex >= entry.session.topics.length ||
      !entry.session.lesson || !entry.session.lesson.challenge ||
      typeof entry.session.lesson.challenge.title !== 'string' || entry.session.lesson.challenge.title.length > 160 ||
      typeof entry.session.lesson.challenge.description !== 'string' || entry.session.lesson.challenge.description.length > 1800 ||
      typeof entry.session.lesson.challenge.starterCode !== 'string' || entry.session.lesson.challenge.starterCode.length > 8000 ||
      !Array.isArray(entry.attempts) || entry.attempts.length > 50) throw new Error('Invalid challenge record.');
    for (const attempt of entry.attempts) {
      if (!attempt || typeof attempt.code !== 'string' || attempt.code.length > 10000 ||
        typeof attempt.submittedAt !== 'string' || attempt.submittedAt.length > 64 ||
        !attempt.evaluation || !['passed','needs_revision','unable_to_verify'].includes(attempt.evaluation.status) ||
        typeof attempt.evaluation.feedback !== 'string' || attempt.evaluation.feedback.length > 3000 ||
        !Array.isArray(attempt.evaluation.criteria) || attempt.evaluation.criteria.length > 10) throw new Error('Invalid challenge attempt.');
    }
  }
  return archive as LearningArchive;
}
