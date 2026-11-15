import { describe, expect, it } from 'vitest';
import { appendSourceTrace } from '../electron/tutor-retrieval';
import { parseTutorSourceTrace } from '../src/study/source-trace';

describe('Tutor source provenance', () => {
  it('shows only verified backend source ranges and preserves original answer', () => {
    const answer = 'BeginPlay calls SpawnChunks.';
    const traced = appendSourceTrace(answer, [
      { file: 'Source/WorldManager.cpp', startLine: 2, endLine: 4 },
      { file: 'Source/WorldManager.cpp', startLine: 2, endLine: 4 }
    ]);
    const parsed = parseTutorSourceTrace(traced);
    expect(parsed.body).toBe(answer);
    expect(parsed.sources).toEqual([{ file: 'Source/WorldManager.cpp', startLine: 2, endLine: 4 }]);
  });

  it('leaves historical messages, malformed traces and uninspected answers unchanged', () => {
    expect(parseTutorSourceTrace('Old message')).toEqual({ body: 'Old message', sources: [] });
    expect(appendSourceTrace('No source inspection', [])).toBe('No source inspection');
    expect(parseTutorSourceTrace('Hello\n\n<!-- studyrepo-source-reads:%7Bbad -->').sources).toEqual([]);
  });
});
