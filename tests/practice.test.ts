import { describe, expect, it } from 'vitest';
import { checkPractice, initialPracticeCode } from '../src/components/PracticeWorkspace';

describe('sample practice pattern checks', () => {
  it('reports incomplete starter code', () => {
    expect(checkPractice(initialPracticeCode)).toHaveLength(3);
  });

  it('accepts an answer containing the required patterns', () => {
    const answer = initialPracticeCode.replace('for (i = 0;', 'for (int32 i = 0;').replace('// Your code', 'if (!Loaded.Contains(Required[i])) Missing.Add(Required[i]);');
    expect(checkPractice(answer)).toEqual([]);
  });

  it('does not present declarations alone as a complete solution', () => {
    const answer = initialPracticeCode.replace('for (i = 0;', 'for (int i = 0;');
    expect(checkPractice(answer)).toHaveLength(2);
  });
});
