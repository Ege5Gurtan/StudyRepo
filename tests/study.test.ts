import { describe, expect, it } from 'vitest';
import { scoreQuiz } from '../src/study/quiz';

describe('sample quiz', () => {
  it('scores correct and incorrect answers', () => {
    expect(scoreQuiz([0, 1, 2])).toEqual({ score: 3, total: 3 });
    expect(scoreQuiz([1, 1, 0])).toEqual({ score: 1, total: 3 });
  });
  it('rejects incomplete, sparse and invalid answers', () => {
    expect(() => scoreQuiz([0])).toThrow();
    const sparse = new Array(3); sparse[2] = 2;
    expect(() => scoreQuiz(sparse)).toThrow();
    expect(() => scoreQuiz([0, 1, 9])).toThrow();
  });
});
