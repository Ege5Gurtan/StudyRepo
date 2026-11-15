import { readRepositoryFile, scanRepository } from './repository';
import { isSensitivePath } from './security';
import type { TreeNode, TutorRequest } from '../src/shared/types';

const sourceExtensions = /\.(?:c|cc|cpp|cxx|h|hpp|hxx|ts|tsx|js|jsx|mjs|py|go|rs|java|cs)$/i;
const MAX_EXCERPT = 26000;

export function namedFileInQuestion(question: string): string | null {
  // Matching only source-looking names avoids opening arbitrary private files.
  const match = question.match(/[a-zA-Z0-9_.-]+(?:[\\/][a-zA-Z0-9_.-]+)*\.(?:c|cc|cpp|cxx|h|hpp|hxx|ts|tsx|js|jsx|mjs|py|go|rs|java|cs)\b/i);
  return match?.[0] ?? null;
}

export function findNamedSource(tree: TreeNode[], target: string): string[] {
  const candidate = target.replace(/\\/g, '/').toLowerCase();
  const matches: string[] = [];
  const visit = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.type === 'directory') visit(node.children ?? []);
      else {
        const filename = node.path.replace(/\\/g, '/').toLowerCase();
        if (sourceExtensions.test(filename) && !isSensitivePath(filename) &&
          (filename === candidate || filename.endsWith('/' + candidate))) matches.push(node.path);
      }
    }
  };
  visit(tree);
  return matches.sort();
}

export function excerptSource(content: string, file: string, question: string): string {
  const lines = content.split(/\r?\n/);
  const range = question.match(/\blines?\s+(\d+)\s*(?:-|–|to)\s*(\d+)\b/i);
  let start = 0;
  let end = lines.length;
  if (range) {
    start = Math.max(0, Number(range[1]) - 1);
    end = Math.min(lines.length, Number(range[2]));
    if (end <= start || end - start > 250) return 'Please request an increasing line range of at most 250 lines.';
  }
  let consumed = 0;
  const shown: string[] = [];
  for (let i = start; i < end; i++) {
    const line = String(i + 1).padStart(5) + ' | ' + lines[i];
    if (consumed + line.length + 1 > MAX_EXCERPT) break;
    shown.push(line);
    consumed += line.length + 1;
  }
  const lastLine = start + shown.length;
  const truncated = lastLine < end;
  return 'Verified source file: ' + file + '\n' +
    'Showing lines ' + (start + 1) + '-' + lastLine + ' of ' + lines.length + '.\n' +
    (truncated ? 'PARTIAL EXCERPT: more source exists. Do not claim to have read the remaining lines. Suggest asking for a specific later line range.\n' : '') +
    '<read_only_source>\n' + shown.join('\n') + '\n</read_only_source>';
}

export async function retrieveNamedFileContext(request: TutorRequest): Promise<string | null> {
  const name = namedFileInQuestion(request.question);
  if (!name) return null;
  const result = await scanRepository(request.repository);
  if (result.repository.path !== request.repository) throw new Error('Repository location changed. Reimport it.');
  const files = findNamedSource(result.tree, name);
  if (!files.length) return 'The named source file "' + name + '" was not found among the readable, allowlisted source files in the imported repository.';
  if (files.length > 1) return 'Multiple matching source files exist: ' + files.slice(0, 8).join(', ') + '. Ask the student to specify the relative path.';
  const text = await readRepositoryFile(request.repository, files[0]);
  return excerptSource(text, files[0], request.question);
}
