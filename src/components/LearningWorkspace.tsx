import Editor from '@monaco-editor/react';
import type { LearningEvaluation, LearningSession } from '../shared/types';

interface Props {
  session: LearningSession | null;
  code: string;
  onCodeChange: (code: string) => void;
  evaluation: LearningEvaluation | null;
  busy: boolean;
  error: string;
  onEvaluate: () => void;
  onRestart: () => void;
  onAdvance: (mode: 'next' | 'similar') => void;
  onOpenSource: (file: string, line: number) => void;
}

export function LearningWorkspace({ session, code, onCodeChange, evaluation, busy, error, onEvaluate, onRestart, onAdvance, onOpenSource }: Props) {
  if (!session) return <section className="practice-workspace learning-welcome" aria-label="Adaptive learning workspace">
    <div className="learning-hero">
      <p className="eyebrow">PERSONALIZED LEARNING</p>
      <h2>Tell your AI Tutor what you want to learn</h2>
      <p>Describe your experience level and the subjects you want to explore. Your tutor will select relevant files, explain a concept, and create a small coding challenge based on your repository.</p>
      <p className="muted">Start in the chat panel on the right. Repository files remain read-only.</p>
    </div>
  </section>;
  const topic = session.topics[session.topicIndex];
  const challenge = session.lesson.challenge;
  const finalTopic = session.topicIndex >= session.topics.length - 1;
  return <section className="practice-workspace learning-workspace" aria-label="Adaptive learning workspace">
    <div className="practice-problem learning-problem">
      <div className="learning-topline"><span className="eyebrow">ADAPTIVE LEARNING · TOPIC {session.topicIndex + 1} OF {session.topics.length}</span><button className="learning-restart" onClick={onRestart}>New learning goal</button></div>
      <h2>{topic?.title ?? challenge.title}</h2>
      <p className="muted">{topic?.objective}</p>
      <div className="learning-plan">{session.topics.map((item, index) => <span className={index === session.topicIndex ? 'learning-active-topic' : ''} key={item.id}>{index + 1}. {item.title}</span>)}</div>
      <div className="learning-explanation">
        <strong>{session.lesson.introduction}</strong>
        <p>{session.lesson.explanation}</p>
      </div>
      {session.lesson.references.length > 0 && <div className="learning-references"><span className="eyebrow">FROM YOUR REPOSITORY</span>{session.lesson.references.map((ref, index) => <button key={index} onClick={() => onOpenSource(ref.file, ref.startLine)}>{ref.file}:{ref.startLine}–{ref.endLine} ↗</button>)}</div>}
      <h2 className="learning-challenge-title">{challenge.title}</h2>
      <p>{challenge.description}</p>
      <div className="learning-criteria"><strong>What the AI will review:</strong><ul>{challenge.criteria.map((criterion, index) => <li key={index}>{criterion}</li>)}</ul></div>
    </div>
    <div className="practice-editor">
      <div className="practice-editor-heading">{challenge.language} · Your scratchpad (repository files are unchanged)</div>
      <div className="practice-editor-body"><Editor key={session.goal + ':' + session.topicIndex + ':' + challenge.title} language={challenge.language.toLowerCase().includes('typescript') ? 'typescript' : challenge.language.toLowerCase().includes('javascript') ? 'javascript' : challenge.language.toLowerCase().includes('python') ? 'python' : challenge.language.toLowerCase().includes('c++') ? 'cpp' : challenge.language.toLowerCase()} value={code} theme="vs-dark" onChange={value => onCodeChange(value ?? '')} options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true, scrollBeyondLastLine: false, wordWrap: 'on' }}/></div>
    </div>
    <div className="practice-tests learning-evaluation">
      <div className="practice-tests-header"><h2>AI Code Review <span className="badge">NO RUNTIME</span></h2><button className="primary" disabled={busy || !code.trim()} onClick={onEvaluate}>{busy ? 'Working…' : '✦ Evaluate my solution'}</button></div>
      {error && <p role="alert" className="symbol-error">{error}</p>}
      {evaluation ? <div className="learning-feedback" role="status">
        <strong>{evaluation.status === 'passed' ? 'AI review passed' : evaluation.status === 'needs_revision' ? 'Needs revision' : 'Unable to verify'}</strong>
        <p>{evaluation.feedback}</p>
        <ul>{evaluation.criteria.map((c, i) => <li key={i}>{c.met ? '✓' : '○'} {c.criterion}: {c.explanation}</li>)}</ul>
        <small>AI review is not compilation or executable verification.</small>
        {evaluation.status === 'passed' && <div className="learning-next-actions">
          <button disabled={busy} onClick={() => onAdvance('similar')}>↻ Similar challenge</button>
          <button disabled={busy} className="primary" onClick={() => onAdvance('next')}>{finalTopic ? 'Another challenge →' : 'Next topic →'}</button>
        </div>}
      </div> : <p className="muted">Write your solution, then ask AI to review it. You can ask questions in the Tutor chat at any time.</p>}
    </div>
  </section>;
}
