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
    expect(html).toContain('Learning activity history');
    expect(html).toContain('Previous activity');
    expect(html).toContain('Similar challenge');
  });
  it('shows saved MultipleChoice activity in the same history without opening a code editor', () => {
    const quiz = { id: 'quiz-1', type: 'MultipleChoice' as const, title: 'What is a reference?',
      question: 'Which declaration passes by reference?', options: ['int x', 'int& x'], answer: 1,
      explanation: 'The & parameter is a reference.', selected: 1, checked: true, createdAt: '2026-11-15T08:00:00Z' };
    const html = renderToStaticMarkup(<LearningWorkspace
      session={null} challengeId="" entries={[]} activeIndex={-1} attempts={[]}
      code="" onCodeChange={() => {}} evaluation={null} busy={false} error=""
      onEvaluate={() => {}} onRestart={() => {}} onAdvance={() => {}}
      onSkip={() => {}} onNavigate={() => {}} onRestoreAttempt={() => {}}
      onShowTutor={() => {}} selectedQuizId={quiz.id} quizActivities={[quiz]}
      onOpenQuiz={() => {}} onQuizChange={() => {}}/>);
    expect(html).toContain('Learning activity history');
    expect(html).toContain('MultipleChoice');
    expect(html).toContain('Which declaration passes by reference?');
    expect(html).toContain('Correct!');
    expect(html).not.toContain('data-testid="monaco-editor"');
  });
  it('offers a toggle for expanded AI Tutor reading mode', () => {
    const html = renderToStaticMarkup(<TutorPanel repository="/repo" context="Practice" code="" expanded={true} onToggleExpanded={() => {}} messages={[]} />);
    expect(html).toContain('tutor-expanded');
    expect(html).toContain('Exit reading mode');
    expect(html).toContain('Back to code');
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
        messages={[{ role: 'assistant', content: 'Here is your challenge', challengeId: 'challenge-1' }]}
      />
    );
    expect(html).toContain('CURRENT CHALLENGE');
    expect(html).toContain('Return the given input.');
    expect(html).toContain('THIS_IS_CHAT_EXPLANATION');
    expect(html).toContain('src/sample.js:1');
    expect(html).toContain('Return input unchanged');
    expect(html).toContain('Open in editor');
    expect(html).toContain('Open linked challenge');
  });

});
