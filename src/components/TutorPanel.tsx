import { useState } from 'react';

type Message = { role: 'student' | 'tutor'; text: string };
interface Props {
  repository: string;
  context: string;
  selection?: string;
  diagnostics?: string[];
  explanation?: string;
  onExplain?: () => Promise<string>;
}

export function TutorPanel({ repository, context, selection, diagnostics = [], explanation, onExplain }: Props) {
  const [messages, setMessages] = useState<Message[]>([{ role: 'tutor', text: 'I am a demo tutor. Select code or ask for a hint; responses are examples, not AI analysis.' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  function respond(question: string) {
    const q = question.trim();
    if (!q) return;
    const answer = /hint/i.test(q) ? 'For the sample C++ exercise, declare int32 i = 0 in the loop, then test !Loaded.Contains(Required[i]) before adding the chunk.' :
      /error|diagnostic/i.test(q) && diagnostics.length ? `Demo checks currently report: ${diagnostics.join(' ')}` :
      /concept/i.test(q) ? 'In Unreal C++, TArray stores a dynamic sequence. Contains() checks membership, while Add() appends an item.' :
      'This is a local demo response. Repository-aware AI will be connected in a later phase.';
    setMessages(old => [...old, {role: 'student', text: q}, {role: 'tutor', text: answer}]);
    setInput('');
  }
  async function explain() {
    if (!onExplain) return;
    setBusy(true);
    try {
      const answer = await onExplain();
      setMessages(old => [...old, {role: 'tutor', text: answer}]);
    } catch {
      setMessages(old => [...old, {role: 'tutor', text: 'The mock explanation could not be generated.'}]);
    } finally { setBusy(false); }
  }
  return <aside className="tutor-panel" aria-label="AI Tutor">
    <div className="tutor-heading"><span>✦ AI Tutor</span><span className="badge">DEMO</span></div>
    <div className="tutor-context">{repository} / {context}</div>
    <div className="tutor-chat" aria-live="polite">{messages.map((message, index) => <div className={`tutor-message ${message.role}`} key={index}>{message.text}</div>)}</div>
    {explanation && <div className="tutor-context">Latest explanation: {explanation}</div>}
    <div className="tutor-actions">
      {onExplain && <button disabled={busy || !selection?.trim()} onClick={explain}>Explain selection</button>}
      <button onClick={() => respond('Give hint')}>Give hint</button>
      <button onClick={() => respond('Explain concept')}>Explain concept</button>
      {diagnostics.length > 0 && <button onClick={() => respond('Explain error')}>Explain error</button>}
    </div>
    <form className="tutor-compose" onSubmit={event => { event.preventDefault(); respond(input); }}><input aria-label="Ask AI Tutor" value={input} onChange={event => setInput(event.target.value)} placeholder="Ask about this code..." /><button type="submit" aria-label="Send message">➤</button></form>
    <small className="muted">Mock responses only. No AI model connected.</small>
  </aside>;
}
