import { describe, expect, it } from 'vitest';
import { parseLessonBlocks } from '../src/study/lesson-blocks';

describe('repository-agnostic Tutor lesson blocks', () => {
  it('preserves Markdown and parses a generic diagram and quiz', () => {
    const content = 'Explanation.\n\n' +
      '```studyrepo-diagram\n{"title":"Flow","nodes":[{"id":"a","label":"Input"},{"id":"b","label":"Output"}],"edges":[{"from":"a","to":"b"}]}\n```\n\n' +
      '```studyrepo-quiz\n{"question":"What comes first?","options":["Input","Output"],"answer":0,"explanation":"Input is first."}\n```';
    const blocks = parseLessonBlocks(content);
    expect(blocks.some(b => b.type === 'markdown' && b.content.includes('Explanation'))).toBe(true);
    expect(blocks.find(b => b.type === 'diagram')).toMatchObject({ title: 'Flow', edges: [{ from: 'a', to: 'b' }] });
    expect(blocks.find(b => b.type === 'quiz')).toMatchObject({ answer: 0 });
  });
  it('rejects unknown diagram node references and excessive diagrams', () => {
    const broken = '{"title":"Flow","nodes":[{"id":"a","label":"A"},{"id":"b","label":"B"}],"edges":[{"from":"a","to":"missing"}]}';
    expect(parseLessonBlocks('```studyrepo-diagram\n'+broken+'\n```')[0].type).toBe('markdown');
    const big = JSON.stringify({title:'Too big',nodes:Array.from({length:10},(_,i)=>({id:'n'+i,label:'Node'})),edges:[]});
    expect(parseLessonBlocks('```studyrepo-diagram\n'+big+'\n```')[0].type).toBe('markdown');
    expect(parseLessonBlocks('Regular response')).toEqual([{type:'markdown',content:'Regular response'}]);
  });
});
