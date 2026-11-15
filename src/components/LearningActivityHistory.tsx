import { useState } from 'react';
import type { ChallengeHistoryEntry, MultipleChoiceActivity } from '../shared/types';

interface Props {
  challenges: ChallengeHistoryEntry[];
  activeChallengeIndex: number;
  quizzes: MultipleChoiceActivity[];
  selectedQuizId: string | null;
  busy: boolean;
  onSelectChallenge: (index: number) => void;
  onSelectQuiz: (id: string) => void;
  onShowTutor: () => void;
  onNewGoal: () => void;
}

export function LearningActivityHistory({ challenges, activeChallengeIndex, quizzes, selectedQuizId, busy, onSelectChallenge, onSelectQuiz, onShowTutor, onNewGoal }: Props) {
  const [open, setOpen] = useState(false);
  const entries = [
    ...challenges.map((entry, index) => ({
      id: entry.id, type: 'Challenge' as const, title: entry.session.lesson.challenge.title,
      createdAt: entry.createdAt, index,
      status: entry.status === 'skipped' ? 'Skipped' : entry.attempts.some(a => a.evaluation.status === 'passed') ? 'AI passed' : entry.attempts.length ? 'Reviewed' : 'Draft'
    })),
    ...quizzes.map(quiz => ({
      id: quiz.id, type: 'MultipleChoice' as const, title: quiz.title,
      createdAt: quiz.createdAt, index: -1,
      status: quiz.checked ? (quiz.selected === quiz.answer ? 'Correct' : 'Try again') : 'Unanswered'
    }))
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

  if (!entries.length) return null;
  const activeId = selectedQuizId ?? challenges[activeChallengeIndex]?.id;
  const selectedIndex = Math.max(0, entries.findIndex(item => item.id === activeId));
  const selected = entries[selectedIndex];
  const choose = (index: number) => {
    const entry = entries[index];
    if (!entry) return;
    if (entry.type === 'Challenge') onSelectChallenge(entry.index);
    else onSelectQuiz(entry.id);
    setOpen(false);
  };

  return <nav className="challenge-history" aria-label="Learning activity history">
    <div className="challenge-navigator">
      <button type="button" className="challenge-history-toggle" aria-expanded={open} aria-controls="learning-activity-history-list" onClick={() => setOpen(value => !value)}>
        <span className="challenge-navigator-label">Activities <span className="muted">{selectedIndex + 1} / {entries.length}</span></span>
        <span className="challenge-navigator-title"><span className="eyebrow">{selected.type}</span> {selected.title}</span>
        <span className="challenge-toggle-icon" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      <div className="challenge-history-arrows">
        <button type="button" aria-label="Previous activity" title="Previous activity" disabled={busy || selectedIndex <= 0} onClick={() => choose(selectedIndex - 1)}>←</button>
        <button type="button" aria-label="Next activity" title="Next activity" disabled={busy || selectedIndex >= entries.length - 1} onClick={() => choose(selectedIndex + 1)}>→</button>
      </div>
      {selected.type === 'Challenge' && <button type="button" className="challenge-chat-link" onClick={onShowTutor}>View instructions in AI Tutor →</button>}
      <button type="button" className="learning-restart" onClick={onNewGoal}>New learning goal</button>
    </div>
    {open && <div id="learning-activity-history-list" className="challenge-history-items">
      {entries.map((entry, index) => <button
        key={entry.id} type="button" disabled={busy}
        aria-current={index === selectedIndex ? 'step' : undefined}
        className={index === selectedIndex ? 'challenge-history-active' : ''}
        title={entry.title}
        onClick={() => choose(index)}>
        <span className="challenge-history-number">{index + 1}</span>
        <span className="activity-history-type">{entry.type}</span>
        <span className="challenge-history-name">{entry.title}</span>
        <small>{entry.status}</small>
      </button>)}
    </div>}
  </nav>;
}
