import { useState } from 'react';
import Editor from '@monaco-editor/react';
import type { ChallengeAttempt, ChallengeHistoryEntry, LearningEvaluation, LearningSession } from '../shared/types';

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
}

export function LearningWorkspace({ session, challengeId, entries, activeIndex, attempts, code, onCodeChange, evaluation, busy, error, onEvaluate, onRestart, onAdvance, onSkip, onNavigate, onRestoreAttempt, onShowTutor }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  if (!session) return <section className="practice-workspace learning-welcome" aria-label="Adaptive learning workspace">
    <div className="learning-hero">
      <p className="eyebrow">PERSONALIZED LEARNING</p>
      <h2>Tell your AI Tutor what you want to learn</h2>
      <p>Describe your experience level and the subjects you want to explore. Your tutor will select relevant files, explain a concept, and create a small coding challenge based on your repository.</p>
      <p className="muted">Start in the chat panel on the right. Repository files remain read-only.</p>
      {entries.length > 0 && <div className="saved-learning-list"><h3>Previous challenges</h3>{entries.map((entry, index) => <button key={entry.id} disabled={busy} onClick={() => onNavigate(index)}>{index + 1}. {entry.session.lesson.challenge.title} <span>↗</span></button>)}</div>}
    </div>
  </section>;
  const challenge = session.lesson.challenge;
  const finalTopic = session.topicIndex >= session.topics.length - 1;
  const latest = activeIndex === entries.length - 1;
  const passed = attempts.some(attempt => attempt.evaluation.status === 'passed');
  return <section className="practice-workspace learning-workspace" aria-label="Adaptive learning workspace">
    <nav className="challenge-history" aria-label="Challenge history">
      <div className="challenge-navigator">
        <button type="button" className="challenge-history-toggle" aria-expanded={historyOpen} aria-controls="challenge-history-list" onClick={() => setHistoryOpen(open => !open)}>
          <span className="challenge-navigator-label">Challenges <span className="muted">{activeIndex + 1} / {entries.length}</span></span>
          <span className="challenge-navigator-title"><span className="eyebrow">#{activeIndex + 1}</span> {challenge.title}</span>
          <span className="challenge-toggle-icon" aria-hidden="true">{historyOpen ? '▴' : '▾'}</span>
        </button>
        <div className="challenge-history-arrows">
          <button type="button" aria-label="Previous challenge" title="Previous challenge" disabled={busy || activeIndex <= 0} onClick={() => onNavigate(activeIndex - 1)}>←</button>
          <button type="button" aria-label="Next saved challenge" title="Next saved challenge" disabled={busy || activeIndex >= entries.length - 1} onClick={() => onNavigate(activeIndex + 1)}>→</button>
        </div>
        <button type="button" className="challenge-chat-link" onClick={onShowTutor}>View instructions in AI Tutor →</button>
        <button type="button" className="learning-restart" onClick={onRestart}>New learning goal</button>
      </div>
      {historyOpen && <div id="challenge-history-list" className="challenge-history-items">{entries.map((entry, index) => <button
        key={entry.id} type="button" disabled={busy}
        aria-current={activeIndex === index ? 'step' : undefined}
        className={activeIndex === index ? 'challenge-history-active' : ''}
        title={entry.session.lesson.challenge.title}
        onClick={() => { onNavigate(index); setHistoryOpen(false); }}>
        <span className="challenge-history-number">{index + 1}</span>
        <span className="challenge-history-name">{entry.session.lesson.challenge.title}</span>
        <small>{entry.status === 'skipped' ? 'Skipped' : entry.attempts.some(a => a.evaluation.status === 'passed') ? 'AI passed' : entry.attempts.length ? 'Reviewed' : 'Draft'}</small>
      </button>)}</div>}
    </nav>
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
