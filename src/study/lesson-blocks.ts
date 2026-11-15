export type LessonBlock =
  | { type: 'markdown'; content: string }
  | { type: 'quiz'; question: string; options: string[]; answer: number; explanation: string }
  | { type: 'grid'; title: string; a: [number, number]; b: [number, number] };

// Structured lesson blocks are inert data. Never interpret model output as React,
// HTML, SVG markup, or executable JavaScript.
export function parseLessonBlocks(content: string): LessonBlock[] {
  const blocks: LessonBlock[] = [];
  const pattern = /(^|\n)```studyrepo-(quiz|grid)\s*\n([\s\S]*?)\n```(?=\n|$)/g;
  let start = 0;
  for (const match of content.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > start) blocks.push({ type: 'markdown', content: content.slice(start, index) });
    const raw = match[3];
    let parsed: LessonBlock | null = null;
    if (raw.length <= 4000) {
      try {
        const data: unknown = JSON.parse(raw);
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          const value = data as Record<string, unknown>;
          if (match[2] === 'quiz' && typeof value.question === 'string' && value.question.length <= 500 &&
            Array.isArray(value.options) && value.options.length >= 2 && value.options.length <= 5 &&
            value.options.every((o: unknown) => typeof o === 'string' && o.length <= 200) &&
            Number.isInteger(value.answer) && (value.answer as number) >= 0 && (value.answer as number) < value.options.length &&
            typeof value.explanation === 'string' && value.explanation.length <= 800) {
            parsed = { type: 'quiz', question: value.question, options: value.options as string[], answer: value.answer as number, explanation: value.explanation };
          }
          const coord = (v: unknown): v is [number, number] =>
            Array.isArray(v) && v.length === 2 && v.every(n => Number.isInteger(n) && n >= 0 && n <= 5);
          if (match[2] === 'grid' && typeof value.title === 'string' && value.title.length <= 160 &&
            coord(value.a) && coord(value.b)) {
            parsed = { type: 'grid', title: value.title, a: value.a, b: value.b };
          }
        }
      } catch { /* Invalid or unexpected model data is displayed as normal Markdown. */ }
    }
    blocks.push(parsed ?? { type: 'markdown', content: match[0] });
    start = index + match[0].length;
  }
  if (start < content.length) blocks.push({ type: 'markdown', content: content.slice(start) });
  return blocks.length ? blocks : [{ type: 'markdown', content }];
}
