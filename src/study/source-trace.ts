export interface TutorSourceRead { file: string; startLine: number; endLine: number }

// Only StudyRepo's backend appends this metadata. It is not displayed as model
// Markdown or interpreted as executable UI markup.
const tracePattern = /\n\n<!-- studyrepo-source-reads:([^>\n]+) -->$/;

export function parseTutorSourceTrace(content: string): { body: string; sources: TutorSourceRead[] } {
  const match = content.match(tracePattern);
  if (!match) return { body: content, sources: [] };
  try {
    const value: unknown = JSON.parse(decodeURIComponent(match[1]));
    if (!Array.isArray(value) || value.length > 8 || !value.every(item =>
      item && typeof item === 'object' && typeof item.file === 'string' &&
      item.file.length > 0 && item.file.length <= 512 &&
      Number.isInteger(item.startLine) && item.startLine > 0 &&
      Number.isInteger(item.endLine) && item.endLine >= item.startLine
    )) return { body: content, sources: [] };
    return { body: content.slice(0, match.index), sources: value as TutorSourceRead[] };
  } catch { return { body: content, sources: [] }; }
}
