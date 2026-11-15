import type { ChallengeHistoryEntry, LearningArchive, LearningEvaluation, LearningSession, TutorMessage } from '../shared/types';
import { parseLessonBlocks } from './lesson-blocks';
import { validateGuidedPath } from '../../electron/learning-path';

export const emptyArchive = (): LearningArchive => ({ entries: [], activeIndex: -1, messages: [] });

export function addChallenge(archive: LearningArchive, session: LearningSession): LearningArchive {
  const entry: ChallengeHistoryEntry = {
    id: crypto.randomUUID(), session, code: session.lesson.challenge.starterCode,
    attempts: [], status: 'active', createdAt: new Date().toISOString()
  };
  return { ...archive, entries: [...archive.entries, entry], activeIndex: archive.entries.length };
}

// Quizzes are lightweight learning activities, not hidden coding challenges.
// Each generated check has a stable ID and can be revisited or answered later.
export function appendTutorReplyWithActivities(archive: LearningArchive, content: string, challengeId?: string): LearningArchive {
  const quizzes = parseLessonBlocks(content).filter(block => block.type === 'quiz').slice(0, 3);
  const createdAt = new Date().toISOString();
  const activities = quizzes.map(quiz => ({
    id: crypto.randomUUID(), type: 'MultipleChoice' as const, title: quiz.question.slice(0, 100),
    question: quiz.question, options: quiz.options, answer: quiz.answer,
    explanation: quiz.explanation, createdAt
  }));
  const message: TutorMessage = { role: 'assistant', content };
  if (challengeId) message.challengeId = challengeId;
  if (activities.length) message.activityIds = activities.map(activity => activity.id);
  return {
    ...archive,
    activities: [...(archive.activities ?? []), ...activities],
    messages: [...archive.messages, message].slice(-40)
  };
}

export function setQuizAnswer(archive: LearningArchive, id: string, selected: number, checked: boolean): LearningArchive {
  return { ...archive, activities: (archive.activities ?? []).map(activity =>
    activity.id === id && Number.isInteger(selected) && selected >= 0 && selected < activity.options.length
      ? { ...activity, selected, checked } : activity) };
}

// For challenges started by workspace actions (Skip / Next / Similar), persist
// the generated lesson in Tutor alongside its challenge, rather than only
// updating the Monaco scratchpad. Keep this atomic within the conversation.
export function addChallengeWithTutorExplanation(archive: LearningArchive, session: LearningSession, skipPrevious = false): LearningArchive {
  const updated = addChallenge(skipPrevious ? skipChallenge(archive) : archive, session);
  const challengeId = updated.entries[updated.activeIndex].id;
  const content = [
    '### ' + session.lesson.challenge.title,
    session.lesson.introduction,
    session.lesson.explanation,
    'Challenge: ' + session.lesson.challenge.description
  ].filter(Boolean).join('\n\n').slice(0, 16000);
  return { ...updated, messages: [...updated.messages, { role: 'assistant' as const, content, challengeId }].slice(-40) };
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
    !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.length <= 20000 &&
    (m.challengeId === undefined || (typeof m.challengeId === 'string' && m.challengeId.length <= 100)) &&
    (m.activityIds === undefined || (Array.isArray(m.activityIds) && m.activityIds.length <= 3 &&
      m.activityIds.every(id => typeof id === 'string' && id.length <= 100)))
  )) throw new Error('Invalid tutor messages.');
  if (archive.activities !== undefined && (!Array.isArray(archive.activities) || archive.activities.length > 10000 ||
    !archive.activities.every(a => a && a.type === 'MultipleChoice' && typeof a.id === 'string' && a.id.length > 0 && a.id.length <= 100 &&
      typeof a.title === 'string' && a.title.length <= 100 && typeof a.question === 'string' && a.question.length <= 500 &&
      Array.isArray(a.options) && a.options.length >= 2 && a.options.length <= 5 &&
      a.options.every(o => typeof o === 'string' && o.length <= 200) &&
      Number.isInteger(a.answer) && a.answer >= 0 && a.answer < a.options.length &&
      typeof a.explanation === 'string' && a.explanation.length <= 800 &&
      typeof a.createdAt === 'string' && a.createdAt.length <= 64 &&
      (a.selected === undefined || (Number.isInteger(a.selected) && a.selected >= 0 && a.selected < a.options.length)) &&
      (a.checked === undefined || typeof a.checked === 'boolean')))) throw new Error('Invalid multiple-choice activity history.');
  if (archive.guidedPath !== undefined) validateGuidedPath(archive.guidedPath);
  const ids = new Set((archive.activities ?? []).map(a => a.id));
  if (ids.size !== (archive.activities ?? []).length) throw new Error('Duplicate activity ID.');
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
