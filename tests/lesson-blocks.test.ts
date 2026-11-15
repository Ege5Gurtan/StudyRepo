import { describe, expect, it } from 'vitest';
import { parseLessonBlocks } from '../src/study/lesson-blocks';

describe('structured Tutor learning blocks', () => {
  it('keeps surrounding Markdown and parses validated quiz and grid data', () => {
    const content = 'Explain the function.\n\n' +
      '```studyrepo-grid\n{"title":"Chunk distance","a":[1,1],"b":[4,3]}\n```\n\n' +
      '```studyrepo-quiz\n{"question":"What is max(3,2)?","options":["2","3"],"answer":1,"explanation":"The maximum is 3."}\n```';
    const blocks = parseLessonBlocks(content);
    expect(blocks.some(b => b.type === 'markdown' && b.content.includes('Explain'))).toBe(true);
    expect(blocks.find(b => b.type === 'grid')).toMatchObject({ a: [1, 1], b: [4, 3] });
    expect(blocks.find(b => b.type === 'quiz')).toMatchObject({ answer: 1 });
  });
  it('renders invalid, oversized and malicious structured blocks as inert code', () => {
    for (const json of ['{"title":"X","a":[-1,0],"b":[2,1]}', '{"question":"X","options":["a"],"answer":0,"explanation":"x"}', '{"title":"<script>","a":[1,1],"b":[1000,2]}']) {
      expect(parseLessonBlocks('```studyrepo-grid\n' + json + '\n```')[0]).toMatchObject({ type: 'markdown' });
    }
    expect(parseLessonBlocks('Regular message')).toEqual([{ type: 'markdown', content: 'Regular message' }]);
  });
});
