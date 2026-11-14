import { useState } from 'react';
import type { TutorMessage } from '../shared/types';

interface Props {
  repository: string;
  context: 'Practice' | 'Explorer';
  code: string;
  sourceFile?: string;
  diagnostics?: string[];
}

export function TutorPanel({ repository, context, code, sourceFile, diagnostics = [] }: Props) {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function send(question: string, retry = false) {
    const q = question.trim();
    if (!q || busy) return;
    const history = retry ? messages.slice(0, -1) : messages;
    const updated: TutorMessage[] = [...history, { role: 'user', content: q }];
    setMessages(updated);
    setInput('');
    setBusy(true);
    setError('');
    try {
      const answer = await window.studyRepo.askTutor({
        repository, context, code: code.slice(0, 12000), sourceFile,
        question: q, diagnostics, history: history.slice(-10)
      });
      setMessages(current => [...current, { role: 'assistant', content: answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return <aside className="tutor-panel" aria-label="AI Tutor">
    <div className="tutor-heading"><span>✦ AI Tutor</span><button className="tutor-clear" onClick={() => { setMessages([]); setError(''); }} disabled={busy || messages.length === 0}>Clear chat</button></div>
    <div className="tutor-context">{repository} / {context}{sourceFile ? ` / ${sourceFile}` : ''}</div>
    <div className="tutor-chat" aria-live="polite">
      {messages.length === 0 && <p className="muted">Ask about your code, errors, or concepts. I'll guide you through the reasoning.</p>}
      {messages.map((message, index) => <div className={`tutor-message ${message.role === 'user' ? 'student' : 'tutor'}`} key={index}>{message.content}</div>)}
      {busy && <p role="status" className="muted">Thinking…</p>}
    </div>
    {error && <p className="tutor-error" role="alert">{error} <button onClick={() => { void send(messages.at(-1)?.role === 'user' ? messages.at(-1)?.content ?? '' : '', true); }}>Retry</button></p>}
    <div className="tutor-actions">
      <button disabled={busy} onClick={() => { void send('Give me a hint, without revealing the full solution.'); }}>Give hint</button>
      <button disabled={busy} onClick={() => { void send('Explain the programming concepts in this code.'); }}>Explain concepts</button>
      {diagnostics.length > 0 && <button disabled={busy} onClick={() => { void send('Explain these test diagnostics and guide me toward fixing them.'); }}>Explain errors</button>}
    </div>
    <form className="tutor-compose" onSubmit={event => { event.preventDefault(); void send(input); }}>
      <input aria-label="Ask AI Tutor" maxLength={3000} value={input} disabled={busy} onChange={event => setInput(event.target.value)} placeholder="Ask about this code…" />
      <button type="submit" disabled={busy || !input.trim()} aria-label="Send message">➤</button>
    </form>
    <small className="muted">OpenAI API · Sends the current code context and recent messages. Requires OPENAI_API_KEY.</small>
  </aside>;
}
