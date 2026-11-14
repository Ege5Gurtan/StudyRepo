import type { TutorMessage } from '../shared/types';

// Keep the exact message list used to submit the request until its response arrives.
// This prevents an async reply from replacing the student's message in controlled chat.
export function withStudentMessage(history: TutorMessage[], question: string): TutorMessage[] {
  return [...history, { role: 'user', content: question }];
}

export function withTutorReply(pending: TutorMessage[], answer: string): TutorMessage[] {
  return [...pending, { role: 'assistant', content: answer }];
}
