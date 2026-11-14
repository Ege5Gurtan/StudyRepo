import { marked } from 'marked';

const greek: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε',
  theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', sigma: 'σ',
  phi: 'φ', omega: 'ω', Delta: 'Δ', Gamma: 'Γ', Sigma: 'Σ',
  Omega: 'Ω', times: '×', cdot: '·', pm: '±', infty: '∞',
  leq: '≤', geq: '≥', neq: '≠', approx: '≈', sum: '∑'
};
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function normalizeTutorText(content: string): string {
  // An older lesson response could contain literal backslash-n escapes.
  // Only normalize double escaped newlines, not standalone code escapes.
  if (content.includes('\n') || !content.includes('\\n\\n')) return content;
  return content.replace(/\\n\\n/g, '\n\n');
}

export function latexToMathML(source: string, display = false): string {
  // A safe subset of TeX, rendered as native MathML. Unsupported commands
  // remain visible as text, rather than executing any embedded markup.
  let i = 0;
  const text = source.slice(0, 800);
  function group(): string {
    while (text[i] === ' ') i++;
    if (text[i] === '{') { i++; const inner = sequence('}'); if (text[i] === '}') i++; return inner; }
    return atom();
  }
  function atom(): string {
    while (text[i] === ' ') i++;
    if (i >= text.length) return '<mrow></mrow>';
    if (text[i] === '\\') {
      i++;
      const match = text.slice(i).match(/^[a-zA-Z]+/);
      if (!match) return '<mo>\\</mo>';
      const name = match[0]; i += name.length;
      if (name === 'frac') return '<mfrac>' + group() + group() + '</mfrac>';
      if (name === 'sqrt') return '<msqrt>' + group() + '</msqrt>';
      return '<mi>' + xml(greek[name] ?? '\\' + name) + '</mi>';
    }
    if (text[i] === '{') return group();
    const match = text.slice(i).match(/^(?:\d+(?:\.\d+)?|[a-zA-Z]+)/);
    if (match) {
      i += match[0].length;
      const tag = /^\d/.test(match[0]) ? 'mn' : 'mi';
      return '<' + tag + '>' + xml(match[0]) + '</' + tag + '>';
    }
    return '<mo>' + xml(text[i++]) + '</mo>';
  }
  function sequence(end?: string): string {
    const children: string[] = [];
    while (i < text.length && (!end || text[i] !== end)) {
      if (/\s/.test(text[i])) { i++; continue; }
      let base = atom();
      let sub: string | null = null; let sup: string | null = null;
      while (text[i] === '_' || text[i] === '^') {
        const op = text[i++];
        if (op === '_') sub = group();
        else sup = group();
      }
      if (sub && sup) base = '<msubsup>' + base + sub + sup + '</msubsup>';
      else if (sub) base = '<msub>' + base + sub + '</msub>';
      else if (sup) base = '<msup>' + base + sup + '</msup>';
      children.push(base);
    }
    return '<mrow>' + children.join('') + '</mrow>';
  }
  return '<math xmlns="http://www.w3.org/1998/Math/MathML" display="' +
    (display ? 'block' : 'inline') + '">' + sequence() + '</math>';
}

function insertMath(markdown: string): string {
  const tick = String.fromCharCode(96);
  const fence = tick.repeat(3);
  const blocks = new RegExp('(' + fence + '[\\s\\S]*?' + fence + '|' + tick + '[^' + tick + ']*' + tick + ')', 'g');
  // Never transform math syntax inside fenced and inline code.
  return markdown.split(blocks).map((chunk, index) => {
    if (index % 2) return chunk;
    return chunk
      .replace(/\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$/g, (_match, a: string | undefined, b: string | undefined) =>
        latexToMathML(a ?? b ?? '', true))
      .replace(/\\\((.+?)\\\)|(?<!\$)\$([^$\n]+)\$(?!\$)/g, (_match, a: string | undefined, b: string | undefined) =>
        latexToMathML(a ?? b ?? '', false));
  }).join('');
}

export function markdownToHtml(content: string): string {
  return marked.parse(insertMath(normalizeTutorText(content)), { async: false, gfm: true, breaks: true }) as string;
}
