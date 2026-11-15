import type { GuidedLearningPath } from '../shared/types';

const short = (value: unknown, length: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= length;

export function validateGuidedPath(value: unknown): GuidedLearningPath {
  if (!value || typeof value !== 'object') throw new Error('Invalid guided learning path.');
  const path = value as Partial<GuidedLearningPath>;
  if (!short(path.goal, 1500) || !Array.isArray(path.topics) ||
      path.topics.length < 1 || path.topics.length > 6 ||
      !path.topics.every(t => t && short(t.id, 80) && short(t.title, 120) && short(t.objective, 500)) ||
      new Set(path.topics.map(t => t.id)).size !== path.topics.length ||
      !Number.isInteger(path.currentIndex) || path.currentIndex! < 0 || path.currentIndex! >= path.topics.length ||
      !Array.isArray(path.completed) || path.completed.length > 6 ||
      !path.completed.every(id => typeof id === 'string' && path.topics!.some(t => t.id === id)) ||
      new Set(path.completed).size !== path.completed.length ||
      !path.lesson || !short(path.lesson.title, 160) || !short(path.lesson.explanation, 12000) ||
      !Array.isArray(path.lesson.references) || path.lesson.references.length > 5 ||
      !path.lesson.references.every(r => r && short(r.file, 512) &&
        Number.isInteger(r.startLine) && Number.isInteger(r.endLine) &&
        r.startLine >= 1 && r.endLine >= r.startLine && r.endLine - r.startLine < 181)) {
    throw new Error('Invalid guided learning path.');
  }
  return path as GuidedLearningPath;
}
