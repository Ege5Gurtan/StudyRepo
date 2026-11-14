import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LearningWorkspace } from '../src/components/LearningWorkspace';
import type { LearningSession } from '../src/shared/types';

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-editor">Editor</div>
}));

const session: LearningSession = {
  goal: 'Learn JavaScript',
  topicIndex: 0,
  topics: [{ id: 'functions', title: 'Functions', objective: 'Understand functions' }],
  sourceContext: 'function sample() {}',
  lesson: {
    introduction: 'THIS_IS_CHAT_INTRODUCTION',
    explanation: 'THIS_IS_CHAT_EXPLANATION',
    references: [{ file: 'src/sample.js', startLine: 1, endLine: 1 }],
    challenge: {
      title: 'Write a function',
      description: 'Return the given input.',
      language: 'javascript',
      starterCode: 'function identity(x) {}',
      criteria: ['Return input unchanged']
    }
  }
};

describe('adaptive practice layout', () => {
  it('keeps the coding challenge, editor and evaluation controls without duplicating the chat explanation', () => {
    const html = renderToStaticMarkup(
      <LearningWorkspace
        session={session}
        challengeId="challenge-1"
        entries={[{ id: 'challenge-1', session, code: 'function identity(x) { return x; }', attempts: [], status: 'active', createdAt: '2026-11-14T00:00:00Z' }]}
        activeIndex={0}
        attempts={[]}
        code="function identity(x) { return x; }"
        onCodeChange={() => {}}
        evaluation={null}
        busy={false}
        error=""
        onEvaluate={() => {}}
        onRestart={() => {}}
        onAdvance={() => {}}
        onSkip={() => {}}
        onNavigate={() => {}}
        onRestoreAttempt={() => {}}
        onOpenSource={() => {}}
      />
    );
    expect(html).not.toContain('THIS_IS_CHAT_INTRODUCTION');
    expect(html).not.toContain('THIS_IS_CHAT_EXPLANATION');
    expect(html).toContain('Write a function');
    expect(html).toContain('src/sample.js:1');
    expect(html).toContain('data-testid="monaco-editor"');
    expect(html).toContain('Evaluate my solution');
    expect(html).toContain('Evaluation criteria');
    expect(html).toContain('Challenge history');
    expect(html).toContain('Previous challenge');
    expect(html).toContain('Similar challenge');
  });
});
