import { describe, expect, it } from 'vitest';
import { requestsNewChallenges } from '../src/study/chat-intent';
import { withStudentMessage, withTutorReply } from '../src/study/chat-messages';

describe('AI Tutor challenge actions', () => {
  it('routes clear requests for a new set to the challenge generator', () => {
    expect(requestsNewChallenges('Give me another set of challenges.')).toBe(true);
    expect(requestsNewChallenges('Generate more coding exercises')).toBe(true);
    expect(requestsNewChallenges('I want a new batch of challenges')).toBe(true);
    expect(requestsNewChallenges('/challenges')).toBe(true);
  });
  it('keeps ordinary explanations and hints in conversational mode', () => {
    expect(requestsNewChallenges('Explain this function.')).toBe(false);
    expect(requestsNewChallenges('Can you explain the next challenge?')).toBe(false);
    expect(requestsNewChallenges('Give me another hint about this challenge.')).toBe(false);
  });
  it('retains user turns alongside model replies, including multiple exchanges', () => {
    const one = withStudentMessage([], 'Hello');
    const two = withTutorReply(one, 'Welcome!');
    const three = withStudentMessage(two, 'Give me another set of challenges.');
    const four = withTutorReply(three, 'I added a new lesson set.');
    expect(four).toEqual([
      { role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Welcome!' },
      { role: 'user', content: 'Give me another set of challenges.' },
      { role: 'assistant', content: 'I added a new lesson set.' }
    ]);
    expect(three).toHaveLength(3);
  });
});
