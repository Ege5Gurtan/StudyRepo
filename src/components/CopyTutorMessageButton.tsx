import { useState } from 'react';
import { parseTutorSourceTrace } from '../study/source-trace';
import type { TutorMessage } from '../shared/types';

// Copy the message as written, not the HTML representation of Markdown or
// application-only source provenance metadata.
export function messageTextToCopy(message: TutorMessage): string {
  return message.role === 'assistant' ? parseTutorSourceTrace(message.content).body : message.content;
}

export function CopyTutorMessageButton({ message }: { message: TutorMessage }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  async function copy() {
    try {
      await navigator.clipboard.writeText(messageTextToCopy(message));
      setStatus('copied');
    } catch {
      setStatus('error');
    }
  }
  return <button type="button" className="tutor-message-copy" onClick={() => { void copy(); }}
    aria-label={message.role === 'user' ? 'Copy user message' : 'Copy AI message'}
    title="Copy message text">
    {status === 'copied' ? '✓ Copied' : status === 'error' ? 'Copy failed · Retry' : 'Copy'}
  </button>;
}
