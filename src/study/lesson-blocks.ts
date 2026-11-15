export type LessonBlock =
  | { type: 'markdown'; content: string }
  | { type: 'quiz'; question: string; options: string[]; answer: number; explanation: string }
  | { type: 'steps'; title: string; steps: { title: string; description: string }[] }
  | { type: 'memory'; title: string; cells: { name: string; value: string; note: string }[] }
  | { type: 'diagram'; title: string; nodes: { id: string; label: string }[]; edges: { from: string; to: string; label?: string }[] };

// Model-generated diagrams are validated data. No arbitrary SVG, JSX, HTML or code.
export function parseLessonBlocks(content: string): LessonBlock[] {
  const blocks: LessonBlock[] = [];
  const pattern = /(^|\n)```studyrepo-(quiz|diagram|steps|memory)\s*\n([\s\S]*?)\n```(?=\n|$)/g;
  let start = 0;
  for (const match of content.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > start) blocks.push({ type: 'markdown', content: content.slice(start, index) });
    let parsed: LessonBlock | null = null;
    if (match[3].length <= 4000) {
      try {
        const data: unknown = JSON.parse(match[3]);
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          const value = data as Record<string, unknown>;
          if (match[2] === 'quiz' && typeof value.question === 'string' && value.question.length <= 500 &&
            Array.isArray(value.options) && value.options.length >= 2 && value.options.length <= 5 &&
            value.options.every((o: unknown) => typeof o === 'string' && o.length <= 200) &&
            Number.isInteger(value.answer) && (value.answer as number) >= 0 && (value.answer as number) < value.options.length &&
            typeof value.explanation === 'string' && value.explanation.length <= 800) {
            parsed = { type: 'quiz', question: value.question, options: value.options as string[], answer: value.answer as number, explanation: value.explanation };
          }
          if (match[2] === 'steps' && typeof value.title === 'string' && value.title.length <= 160 &&
            Array.isArray(value.steps) && value.steps.length >= 2 && value.steps.length <= 8 &&
            value.steps.every((step: unknown) => step && typeof step === 'object' &&
              typeof (step as {title?:unknown}).title === 'string' && (step as {title:string}).title.length <= 100 &&
              typeof (step as {description?:unknown}).description === 'string' && (step as {description:string}).description.length <= 400)) {
            parsed = { type: 'steps', title: value.title, steps: value.steps as {title:string;description:string}[] };
          }
          if (match[2] === 'memory' && typeof value.title === 'string' && value.title.length <= 160 &&
            Array.isArray(value.cells) && value.cells.length >= 1 && value.cells.length <= 12 &&
            value.cells.every((cell: unknown) => cell && typeof cell === 'object' &&
              typeof (cell as {name?:unknown}).name === 'string' && (cell as {name:string}).name.length <= 40 &&
              typeof (cell as {value?:unknown}).value === 'string' && (cell as {value:string}).value.length <= 80 &&
              typeof (cell as {note?:unknown}).note === 'string' && (cell as {note:string}).note.length <= 250)) {
            parsed = { type: 'memory', title: value.title, cells: value.cells as {name:string;value:string;note:string}[] };
          }
          if (match[2] === 'diagram' && typeof value.title === 'string' && value.title.length <= 160 &&
            Array.isArray(value.nodes) && value.nodes.length >= 2 && value.nodes.length <= 8 &&
            value.nodes.every((n: unknown) => n && typeof n === 'object' && typeof (n as {id?:unknown}).id === 'string' &&
              /^[a-zA-Z0-9_-]{1,24}$/.test((n as {id:string}).id) &&
              typeof (n as {label?:unknown}).label === 'string' && (n as {label:string}).label.length <= 75) &&
            Array.isArray(value.edges) && value.edges.length <= 12) {
            const nodes = value.nodes as { id: string; label: string }[];
            const ids = new Set(nodes.map(n => n.id));
            if (ids.size === nodes.length && value.edges.every((e: unknown) =>
              e && typeof e === 'object' &&
              ids.has((e as {from:string}).from) && ids.has((e as {to:string}).to) &&
              ((e as {label?:unknown}).label === undefined || (typeof (e as {label?:unknown}).label === 'string' && ((e as {label:string}).label.length <= 50))))) {
              parsed = { type: 'diagram', title: value.title, nodes, edges: value.edges as {from:string;to:string;label?:string}[] };
            }
          }
        }
      } catch { /* Render invalid blocks as inert code via Markdown. */ }
    }
    blocks.push(parsed ?? { type: 'markdown', content: match[0] });
    start = index + match[0].length;
  }
  if (start < content.length) blocks.push({ type: 'markdown', content: content.slice(start) });
  return blocks.length ? blocks : [{ type: 'markdown', content }];
}
