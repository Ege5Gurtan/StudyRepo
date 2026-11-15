import { useMemo, useState } from 'react';
import { parseLessonBlocks, type LessonBlock } from '../study/lesson-blocks';
import { RichTutorMessage } from './RichTutorMessage';

function Quiz({ block }: { block: Extract<LessonBlock, { type: 'quiz' }> }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  return <section className="tutor-learning-widget" aria-label="Knowledge check">
    <span className="tutor-widget-eyebrow">CHECK YOUR UNDERSTANDING</span>
    <h4>{block.question}</h4>
    <div className="tutor-quiz-options">
      {block.options.map((option, index) => <label key={index} className={selected === index ? 'selected' : ''}>
        <input type="radio" name="tutor-answer" checked={selected === index} onChange={() => { setSelected(index); setChecked(false); }} />
        <span>{option}</span>
      </label>)}
    </div>
    <button type="button" disabled={selected === null} onClick={() => setChecked(true)}>Check answer</button>
    {checked && <p className="tutor-quiz-feedback" role="status">
      <strong>{selected === block.answer ? 'Correct!' : 'Not quite.'}</strong> {block.explanation}
    </p>}
  </section>;
}
function Grid({ block }: { block: Extract<LessonBlock, { type: 'grid' }> }) {
  const [bx, setBx] = useState(block.b[0]);
  const [by, setBy] = useState(block.b[1]);
  const dx = Math.abs(bx - block.a[0]);
  const dy = Math.abs(by - block.a[1]);
  return <section className="tutor-learning-widget" aria-label="Interactive chunk distance diagram">
    <span className="tutor-widget-eyebrow">INTERACTIVE GRID</span>
    <h4>{block.title}</h4>
    <svg viewBox="0 0 336 298" role="img" aria-label={`Chunk A at (${block.a.join(', ')}), chunk B at (${bx}, ${by}). Grid distance ${Math.max(dx, dy)}`}>
      {Array.from({ length: 36 }, (_, index) => {
        const x = index % 6, y = Math.floor(index / 6);
        return <rect key={index} x={22 + x * 49} y={5 + (5 - y) * 44} width="46" height="41" rx="5"
          className={x === block.a[0] && y === block.a[1] ? 'grid-a' : x === bx && y === by ? 'grid-b' : 'grid-empty'}/>;
      })}
      <path d={`M ${45 + block.a[0] * 49} ${25 + (5 - block.a[1]) * 44} H ${45 + bx * 49} V ${25 + (5 - by) * 44}`} stroke="#d9a34a" strokeWidth="3" strokeDasharray="6 5" fill="none" />
      <text x={45 + block.a[0] * 49} y={22 + (5 - block.a[1]) * 44} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">A</text>
      <text x={45 + block.a[0] * 49} y={35 + (5 - block.a[1]) * 44} textAnchor="middle" fill="white" fontSize="10">({block.a.join(',')})</text>
      <text x={45 + bx * 49} y={22 + (5 - by) * 44} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">B</text>
      <text x={45 + bx * 49} y={35 + (5 - by) * 44} textAnchor="middle" fill="white" fontSize="10">({bx},{by})</text>
      {Array.from({length: 6}, (_, x) => <text key={x} x={45 + x * 49} y="285" textAnchor="middle" fontSize="12" fill="currentColor">{x}</text>)}
    </svg>
    <div className="tutor-grid-controls">
      <label>B X: {bx}<input type="range" min="0" max="5" value={bx} onChange={event => setBx(Number(event.target.value))}/></label>
      <label>B Y: {by}<input type="range" min="0" max="5" value={by} onChange={event => setBy(Number(event.target.value))}/></label>
    </div>
    <p className="tutor-grid-result">ΔX = {dx} · ΔY = {dy} · <strong>GridDistance = {Math.max(dx, dy)}</strong></p>
  </section>;
}
export function TutorLessonContent({ content }: { content: string }) {
  const blocks = useMemo(() => parseLessonBlocks(content), [content]);
  return <div className="tutor-lesson-content">{blocks.map((block, index) =>
    block.type === 'quiz' ? <Quiz key={index} block={block}/> :
      block.type === 'grid' ? <Grid key={index} block={block}/> :
        <RichTutorMessage key={index} content={block.content}/>)}</div>;
}
