import { useEffect, useRef, useState } from 'react';
import type { ChallengeHistoryEntry, MultipleChoiceActivity, TutorMessage } from '../shared/types';
import { withStudentMessage, withTutorReply } from '../study/chat-messages';
import { TutorLessonContent } from './TutorLessonContent';
import { CopyTutorMessageButton } from './CopyTutorMessageButton';
import { parseTutorSourceTrace } from '../study/source-trace';

interface Props {
  repository: string;
  context: 'Practice' | 'Explorer';
  hidden?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  learningStarted?: boolean;
  onGenerateChallenges?: (request: string, scope: 'single' | 'set') => Promise<string>;
  messages?: TutorMessage[];
  quizActivities?: MultipleChoiceActivity[];
  onQuizChange?: (id: string, selected: number, checked: boolean) => void;
  pending?: boolean;
  onSendMessage?: (question: string) => void;
  onMessagesChange?: (messages: TutorMessage[]) => void;
  code: string;
  sourceFile?: string;
  diagnostics?: string[];
  activeChallenge?: ChallengeHistoryEntry;
  challengeEntries?: ChallengeHistoryEntry[];
  focusChallengeId?: string | null;
  onOpenChallenge?: (index: number) => void;
  onOpenSource?: (file: string, line: number) => void;
}

export function TutorPanel({ repository, context, code, sourceFile, diagnostics = [], hidden = false, expanded = false, onToggleExpanded, learningStarted = true, onGenerateChallenges, messages: controlledMessages, quizActivities = [], onQuizChange, onMessagesChange, pending = false, onSendMessage, activeChallenge, challengeEntries = [], focusChallengeId, onOpenChallenge, onOpenSource }: Props) {
  const chatRef = useRef<HTMLDivElement>(null);
  const instructionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusChallengeId && activeChallenge?.id === focusChallengeId) {
      instructionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focusChallengeId, activeChallenge?.id]);
  const [localMessages, setLocalMessages] = useState<TutorMessage[]>([]);
  const messages = controlledMessages ?? localMessages;
  const setMessages = (update: TutorMessage[] | ((old: TutorMessage[]) => TutorMessage[])) => {
    const next = typeof update === 'function' ? update(messages) : update;
    if (onMessagesChange) onMessagesChange(next);
    else setLocalMessages(next);
  };
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function send(question: string, retry = false) {
    const q = question.trim();
    if (!q || busy || pending) return;
    if (onSendMessage) { setInput(''); onSendMessage(q); return; }
    const history = retry ? messages.slice(0, -1) : messages;
    const updated = withStudentMessage(history, q);
    setMessages(updated);
    setInput('');
    setBusy(true);
    setError('');
    try {
      const answer = context === 'Practice' && onGenerateChallenges
          ? await (async () => {
              const action = await window.studyRepo.askTutorWithActions({
                repository, context, code: code.slice(0, 12000), sourceFile,
                question: q, diagnostics, history: history.slice(-10)
              });
              return action.type === 'generate_challenge'
                ? await onGenerateChallenges(action.focus, action.scope)
                : action.text;
            })()
          : await window.studyRepo.askTutor({
              repository, context, code: code.slice(0, 12000), sourceFile,
              question: q, diagnostics, history: history.slice(-10)
            });
      // The controlled parent callback uses an immutable archive update. Do not
      // derive this from a stale props closure or the student's message disappears.
      setMessages(withTutorReply(updated, answer));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return <aside className={`tutor-panel ${hidden ? "tutor-hidden" : ""} ${expanded ? "tutor-expanded" : ""}`} aria-label="AI Tutor" aria-hidden={hidden}>
    <div className="tutor-heading"><span>✦ AI Tutor</span>
      {onToggleExpanded && <button type="button" className="tutor-expand-button" aria-label={expanded ? 'Exit reading mode' : 'Expand AI Tutor for reading'} aria-pressed={expanded}
        onClick={onToggleExpanded}>{expanded ? '↙ Back to code' : '⤢ Expand'}</button>}
    </div>
    <div className="tutor-context">{repository} / {context}{sourceFile ? ` / ${sourceFile}` : ''}</div>
    <div className="tutor-chat" aria-live="polite" ref={chatRef}>
      {context === 'Practice' && activeChallenge && <div className="tutor-challenge-details" ref={instructionsRef} tabIndex={-1} aria-label="Current challenge instructions">
        <div className="tutor-challenge-heading"><span className="eyebrow">CURRENT CHALLENGE</span><button type="button" onClick={() => onOpenChallenge?.(challengeEntries.findIndex(entry => entry.id === activeChallenge.id))}>Open in editor ↗</button></div>
        <h3>{activeChallenge.session.lesson.challenge.title}</h3>
        <p>{activeChallenge.session.lesson.challenge.description}</p>
        <details><summary>Learning context and evaluation criteria</summary>
          <p><strong>{activeChallenge.session.topics[activeChallenge.session.topicIndex]?.title}</strong></p>
          <p>{activeChallenge.session.topics[activeChallenge.session.topicIndex]?.objective}</p>
          <p>{activeChallenge.session.lesson.introduction}</p>
          <TutorLessonContent content={activeChallenge.session.lesson.explanation}/>
          <ul>{activeChallenge.session.lesson.challenge.criteria.map((criterion, index) => <li key={index}>{criterion}</li>)}</ul>
        </details>
        {activeChallenge.session.lesson.references.length > 0 && <div className="tutor-challenge-sources">{activeChallenge.session.lesson.references.map((ref, index) => <button key={index} onClick={() => onOpenSource?.(ref.file, ref.startLine)}>{ref.file}:{ref.startLine}–{ref.endLine} ↗</button>)}</div>}
      </div>}
      {messages.length === 0 && <p className="muted">Ask about this repository, a programming concept, or a source file. We'll start by exploring the code; exercises are optional.</p>}
      {messages.map((message, index) => {
        const { body, sources } = message.role === 'assistant' ? parseTutorSourceTrace(message.content) : { body: message.content, sources: [] };
        return <div id={'tutor-message-' + index} className={`tutor-message ${message.role === 'user' ? 'student' : 'tutor'}`} key={index}>
          {message.role === 'assistant' ? <TutorLessonContent content={body} quizActivities={(message.activityIds ?? []).map(id => quizActivities.find(a => a.id === id)).filter((a): a is MultipleChoiceActivity => !!a)} onQuizChange={onQuizChange}/> : body}
          {sources.length > 0 && <details className="tutor-source-trace"><summary>Files inspected ({sources.length})</summary><ul>
            {sources.map((source, sourceIndex) => <li key={sourceIndex}><button type="button" onClick={() => onOpenSource?.(source.file, source.startLine)}
              title="Open verified source in Explorer">{source.file}:{source.startLine}–{source.endLine} ↗</button></li>)}
          </ul></details>}
          <div className="tutor-message-controls"><CopyTutorMessageButton message={message}/></div>
          {message.challengeId && challengeEntries.some(entry => entry.id === message.challengeId) && <button type="button" className="tutor-message-challenge-link" onClick={() => onOpenChallenge?.(challengeEntries.findIndex(entry => entry.id === message.challengeId))}>Open linked challenge ↗</button>}
        </div>;
      })}
      {(busy || pending) && <p role="status" className="muted">Thinking…</p>}
    </div>
    {error && <p className="tutor-error" role="alert">{error} <button onClick={() => { void send(messages.at(-1)?.role === 'user' ? messages.at(-1)?.content ?? '' : '', true); }}>Retry</button></p>}
    <div className="tutor-actions">
      {context === 'Practice' && <button disabled={busy || pending} onClick={() => { void send('Create a coding challenge using this repository.'); }}>Coding challenge</button>}
      {context === 'Practice' && <button disabled={busy || pending} onClick={() => { void send('Ask me a multiple-choice question about the concepts we have discussed.'); }}>Multiple choice</button>}
      {learningStarted && <button disabled={busy} onClick={() => { void send('Give me a hint, without revealing the full solution.'); }}>Give hint</button>}
      {<button disabled={busy || pending} onClick={() => { void send('Explain a useful beginner programming concept from this repository.'); }}>Explain concepts</button>}
      {diagnostics.length > 0 && <button disabled={busy} onClick={() => { void send('Explain these test diagnostics and guide me toward fixing them.'); }}>Explain errors</button>}
    </div>
    <form className="tutor-compose" onSubmit={event => { event.preventDefault(); void send(input); }}>
      <input aria-label="Ask AI Tutor" maxLength={3000} value={input} disabled={busy} onChange={event => setInput(event.target.value)} placeholder={!learningStarted ? 'Ask about the repository or a concept…' : 'Ask about this code…'} />
      <button type="submit" disabled={busy || !input.trim()} aria-label="Send message">➤</button>
    </form>
    <small className="muted">OpenAI API · Sends the current code context and recent messages. Requires OPENAI_API_KEY.</small>
  </aside>;
}
