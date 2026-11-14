import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LearningWorkspace } from '../src/components/LearningWorkspace';
import { TutorPanel } from '../src/components/TutorPanel';
import type { LearningSession } from '../src/shared/types';

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-editor">Editor</div>
}));

vi.mock('../src/components/RichTutorMessage', () => ({
  RichTutorMessage: ({ content }: { content: string }) => <div>{content}</div>
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
        onShowTutor={() => {}}
      />
    );
    expect(html).not.toContain('THIS_IS_CHAT_INTRODUCTION');
    expect(html).not.toContain('THIS_IS_CHAT_EXPLANATION');
    expect(html).toContain('Write a function');
    expect(html).toContain('View instructions in AI Tutor');
    expect(html).not.toContain('src/sample.js:1');
    expect(html).not.toContain('Understand functions');
    expect(html).toContain('data-testid="monaco-editor"');
    expect(html).toContain('Evaluate my solution');
    expect(html).not.toContain('Evaluation criteria');
    expect(html).toContain('Challenge history');
    expect(html).toContain('Previous challenge');
    expect(html).toContain('Similar challenge');
  });
  it('shows challenge instructions and source references in AI Tutor with navigation back to editor', () => {
    const entry = { id: 'challenge-1', session, code: 'function identity(x) {}', attempts: [], status: 'active' as const, createdAt: '2026-11-14T00:00:00Z' };
    const html = renderToStaticMarkup(
      <TutorPanel
        repository="/repo"
        context="Practice"
        code=""
        activeChallenge={entry}
        challengeEntries={[entry]}
        focusChallengeId="challenge-1"
        onOpenChallenge={() => {}}
        onOpenSource={() => {}}
        messages={[{ role: 'user', content: 'Create another challenge', challengeId: 'challenge-1' }, { role: 'assistant', content: 'Here is your challenge', challengeId: 'challenge-1' }]}
      />
    );
    expect(html).toContain('CURRENT CHALLENGE');
    expect(html).toContain('Return the given input.');
    expect(html).toContain('THIS_IS_CHAT_EXPLANATION');
    expect(html).toContain('src/sample.js:1');
    expect(html).toContain('Return input unchanged');
    expect(html).toContain('Open in editor');
    expect(html).toContain('Open linked challenge');
    expect(html.match(/Open linked challenge/g)).toHaveLength(1);
    expect(html).toContain('Create another challenge');
  });

});
