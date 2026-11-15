import Editor from '@monaco-editor/react';
import { LearningActivityHistory } from './LearningActivityHistory';
import { Quiz } from './TutorLessonContent';
import type { ChallengeAttempt, ChallengeHistoryEntry, LearningEvaluation, LearningSession, MultipleChoiceActivity } from '../shared/types';

interface Props {
  session: LearningSession | null;
  challengeId: string;
  entries: ChallengeHistoryEntry[];
  activeIndex: number;
  attempts: ChallengeAttempt[];
  code: string;
  onCodeChange: (code: string) => void;
  evaluation: LearningEvaluation | null;
  busy: boolean;
  error: string;
  onEvaluate: () => void;
  onRestart: () => void;
  onAdvance: (mode: 'next' | 'similar') => void;
  onSkip: () => void;
  onNavigate: (index: number) => void;
  onRestoreAttempt: (index: number) => void;
  onShowTutor: () => void;
  quizActivities?: MultipleChoiceActivity[];
  selectedQuizId?: string | null;
  onOpenQuiz?: (id: string) => void;
  onQuizChange?: (id: string, selected: number, checked: boolean) => void;
}

export function LearningWorkspace({ session, challengeId, entries, activeIndex, attempts, code, onCodeChange, evaluation, busy, error, onEvaluate, onRestart, onAdvance, onSkip, onNavigate, onRestoreAttempt, onShowTutor, quizActivities = [], selectedQuizId = null, onOpenQuiz, onQuizChange }: Props) {
  const history = <LearningActivityHistory
    challenges={entries} activeChallengeIndex={activeIndex} quizzes={quizActivities}
    selectedQuizId={selectedQuizId} busy={busy} onSelectChallenge={onNavigate}
    onSelectQuiz={id => onOpenQuiz?.(id)} onShowTutor={onShowTutor} onNewGoal={onRestart}/>;
  const selectedQuiz = quizActivities.find(item => item.id === selectedQuizId);
  if (selectedQuiz) return <section className="practice-workspace learning-workspace" aria-label="Multiple-choice learning activity">
    {history}
    <div className="learning-quiz-focus">
      <p className="eyebrow">MULTIPLE CHOICE</p>
      <Quiz block={{ type: 'quiz', question: selectedQuiz.question, options: selectedQuiz.options,
        answer: selectedQuiz.answer, explanation: selectedQuiz.explanation }}
        activity={selectedQuiz} onChange={onQuizChange}/>
      <button type="button" onClick={onShowTutor}>Return to AI Tutor →</button>
    </div>
  </section>;
  if (!session) return <section className="practice-workspace learning-welcome" aria-label="Adaptive learning workspace">
    {history}
    <div className="learning-hero">
      <p className="eyebrow">PERSONALIZED LEARNING</p>
      <h2>Explore the repository with your AI Tutor</h2>
      <p>Ask how this repository works, explore real source files, or learn its programming language. The Tutor explains concepts first and may offer a multiple-choice check. Create a coding challenge whenever you're ready.</p>
      <p className="muted">Start in the chat panel on the right. Repository files remain read-only.</p>

    </div>
  </section>;
  const challenge = session.lesson.challenge;
  const finalTopic = session.topicIndex >= session.topics.length - 1;
  const latest = activeIndex === entries.length - 1;
  const passed = attempts.some(attempt => attempt.evaluation.status === 'passed');
  return <section className="practice-workspace learning-workspace" aria-label="Adaptive learning workspace">
    {history}
    <div className="practice-editor">
      <div className="practice-editor-heading">{challenge.language} · Your scratchpad (repository files are unchanged)</div>
      <div className="practice-editor-body"><Editor key={challengeId} language={challenge.language.toLowerCase().includes('typescript') ? 'typescript' : challenge.language.toLowerCase().includes('javascript') ? 'javascript' : challenge.language.toLowerCase().includes('python') ? 'python' : challenge.language.toLowerCase().includes('c++') ? 'cpp' : challenge.language.toLowerCase()} value={code} theme="vs-dark" onChange={value => onCodeChange(value ?? '')} options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true, scrollBeyondLastLine: false, wordWrap: 'on' }}/></div>
    </div>
    <div className="practice-tests learning-evaluation">
      <div className="practice-tests-header"><h2>AI Code Review <span className="badge">NO RUNTIME</span></h2><button className="primary" disabled={busy || !code.trim()} onClick={onEvaluate}>{busy ? 'Working…' : '✦ Evaluate my solution'}</button></div>
      {error && <p role="alert" className="symbol-error">{error}</p>}
      {attempts.length > 0 && <details className="challenge-attempt-history"><summary>Submitted solutions ({attempts.length})</summary><div>{attempts.map((attempt, index) => <div key={index} className="challenge-attempt"><strong>Attempt {index + 1} — {attempt.evaluation.status.replace("_", " ")}</strong><small>{new Date(attempt.submittedAt).toLocaleString()}</small><pre>{attempt.code}</pre><p>{attempt.evaluation.feedback}</p><button disabled={busy} onClick={() => onRestoreAttempt(index)}>Restore this code</button></div>)}</div></details>}
      {evaluation ? <div className="learning-feedback" role="status">
        <strong>{evaluation.status === 'passed' ? 'AI review passed' : evaluation.status === 'needs_revision' ? 'Needs revision' : 'Unable to verify'}</strong>
        <p>{evaluation.feedback}</p>
        <ul>{evaluation.criteria.map((c, i) => <li key={i}>{c.met ? '✓' : '○'} {c.criterion}: {c.explanation}</li>)}</ul>
        <small>AI review is not compilation or executable verification.</small>

      </div> : <p className="muted">Write your solution, then ask AI to review it. You can ask questions in the Tutor chat at any time.</p>}
      {latest && <div className="learning-next-actions">
        <button disabled={busy} onClick={() => onAdvance('similar')}>↻ Similar challenge</button>
        {passed
          ? <button disabled={busy} className="primary" onClick={() => onAdvance('next')}>{finalTopic ? 'Continue to new topics →' : 'Next topic →'}</button>
          : <button disabled={busy} onClick={onSkip}>{finalTopic ? 'Skip to new topics →' : 'Skip to next topic →'}</button>}
      </div>}
    </div>
  </section>;
}
