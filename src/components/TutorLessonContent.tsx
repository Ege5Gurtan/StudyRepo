import { useId, useMemo, useState } from 'react';
import { parseLessonBlocks, type LessonBlock } from '../study/lesson-blocks';
import { RichTutorMessage } from './RichTutorMessage';

function Quiz({ block }: { block: Extract<LessonBlock, { type: 'quiz' }> }) {
  const radioName = useId();
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  return <section className="tutor-learning-widget" aria-label="Knowledge check">
    <span className="tutor-widget-eyebrow">CHECK YOUR UNDERSTANDING</span>
    <h4>{block.question}</h4>
    <div className="tutor-quiz-options">
      {block.options.map((option, index) => <label key={index} className={selected === index ? 'selected' : ''}>
        <input type="radio" name={radioName} checked={selected === index} onChange={() => { setSelected(index); setChecked(false); }} />
        <span>{option}</span>
      </label>)}
    </div>
    <button type="button" disabled={selected === null} onClick={() => setChecked(true)}>Check answer</button>
    {checked && <p className="tutor-quiz-feedback" role="status">
      <strong>{selected === block.answer ? 'Correct!' : 'Not quite.'}</strong> {block.explanation}
    </p>}
  </section>;
}
function Diagram({ block }: { block: Extract<LessonBlock, { type: 'diagram' }> }) {
  const rowHeight = 75;
  const positions = new Map(block.nodes.map((node, index) => [node.id, { x: 180, y: 40 + index * rowHeight }]));
  return <section className="tutor-learning-widget" aria-label="Concept diagram">
    <span className="tutor-widget-eyebrow">CONCEPT DIAGRAM</span>
    <h4>{block.title}</h4>
    <svg viewBox={`0 0 360 ${block.nodes.length * rowHeight + 20}`} role="img"
      aria-label={block.title + ': ' + block.nodes.map(node => node.label).join(', ')}>
      <defs><marker id="tutor-diagram-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="none" stroke="#b9a4ef" /></marker></defs>
      {block.edges.map((edge, index) => {
        const from = positions.get(edge.from)!;
        const to = positions.get(edge.to)!;
        const direction = from.y < to.y ? 1 : -1;
        const same = from.y === to.y;
        return <g key={index}>
          <path d={same ? `M 290 ${from.y} C 335 ${from.y - 32} 335 ${from.y + 32} 290 ${from.y+8}` :
            `M ${from.x} ${from.y + direction * 21} L ${to.x} ${to.y - direction * 21}`}
            stroke="#b9a4ef" strokeWidth="2" fill="none" markerEnd="url(#tutor-diagram-arrow)" />
          {edge.label && <text x={same ? 305 : from.x+10} y={(from.y+to.y)/2} fill="currentColor" fontSize="11">{edge.label}</text>}
        </g>;
      })}
      {block.nodes.map(node => {
        const position = positions.get(node.id)!;
        return <g key={node.id}>
          <rect x={position.x - 110} y={position.y - 22} width="220" height="44" rx="8" fill="#343047" stroke="#b9a4ef"/>
          <text x={position.x} y={position.y + 4} textAnchor="middle" fill="#ffffff" fontSize="12">{node.label}</text>
        </g>;
      })}
    </svg>
    <p className="tutor-diagram-caption">{block.edges.map(e => `${block.nodes.find(n => n.id === e.from)?.label} → ${block.nodes.find(n => n.id === e.to)?.label}`).join(' · ')}</p>
  </section>;
}
export function TutorLessonContent({ content }: { content: string }) {
  const blocks = useMemo(() => parseLessonBlocks(content), [content]);
  return <div className="tutor-lesson-content">{blocks.map((block, index) =>
    block.type === 'quiz' ? <Quiz key={index} block={block}/> :
      block.type === 'diagram' ? <Diagram key={index} block={block}/> :
        <RichTutorMessage key={index} content={block.content}/>)}</div>;
}
