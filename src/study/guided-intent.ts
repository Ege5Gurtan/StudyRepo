import type { GuidedLearningPath } from '../shared/types';

// Only explicit roadmap/tutorial requests change guided state. Other questions,
// hints, and coding challenges continue to use the existing conversational tutor.
export function guidedLearningIntent(question: string, active?: GuidedLearningPath): 'start' | 'next' | null {
  const text = question.trim();
  if (active && /^(?:next lesson|continue (?:the )?(?:lesson|tutorial|learning)|move to (?:the )?next (?:lesson|topic)|teach (?:me )?the next (?:lesson|topic))[.!?\s]*$/i.test(text)) return 'next';
  const asksToLearn = /\b(?:tutorial|learning path|learning roadmap|curriculum|teach me|help me learn|guide me through)\b/i.test(text);
  const project = /\b(?:repo(?:sitory)?|codebase|source(?:\s+code)?|project|code|files?|modules?|functions?)\b/i.test(text);
  if (asksToLearn && project && (!active || /\b(?:new|start over|from scratch|restart)\b/i.test(text))) return 'start';
  return null;
}

// Use the active lesson for generic one-off practice requests. A requested
// different topic or new set must keep the existing challenge workflow.
export function requestsCurrentLessonChallenge(question: string): boolean {
  return /^(?:(?:create|generate|make|give me)\s+(?:a|an|one)\s+(?:coding\s+)?(?:challenge|exercise)(?:\s+(?:using|from|based on)\s+(?:(?:this|the|my)\s+)?(?:repo(?:sitory)?|codebase|project))?|challenge\s+me\s+on\s+(?:this|the|current)\s+lesson|practice\s+(?:this|the|current)\s+lesson)[.!?\s]*$/i.test(question.trim());
}

export function formatGuidedLesson(path: GuidedLearningPath, showRoadmap: boolean): string {
  const lesson = '### Lesson ' + (path.currentIndex + 1) + ' of ' + path.topics.length + ': ' + path.lesson.title;
  const roadmap = showRoadmap ? '## Your learning roadmap\n\n' +
    path.topics.map((topic, index) => (index + 1) + '. ' + topic.title + ' — ' + topic.objective).join('\n') + '\n\n' : '';
  const sources = path.lesson.references.map(ref => ref.file + ':' + ref.startLine + '–' + ref.endLine).join(', ');
  const end = path.currentIndex === path.topics.length - 1
    ? 'This roadmap is complete. Ask about this lesson or start a new tutorial.'
    : 'Ask about this lesson, or say **Next lesson** when you are ready.';
  return (roadmap + lesson + '\n\n' + path.lesson.explanation +
    '\n\n**Source:** ' + sources + '\n\n' + end).slice(0, 18000);
}
