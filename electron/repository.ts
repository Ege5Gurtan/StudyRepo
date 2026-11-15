import { readdir, realpath, stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { isSensitivePath } from './security';
import type { ScanResult, TreeNode } from '../src/shared/types';

const ignored = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.venv', 'venv', '__pycache__', 'target', 'vendor']);
const languages: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.py': 'Python', '.go': 'Go', '.rs': 'Rust', '.java': 'Java', '.c': 'C', '.h': 'C', '.cpp': 'C++', '.cs': 'C#',
  '.html': 'HTML', '.css': 'CSS', '.scss': 'SCSS', '.json': 'JSON', '.md': 'Markdown', '.yml': 'YAML', '.yaml': 'YAML',
  '.sh': 'Shell', '.rb': 'Ruby', '.php': 'PHP', '.swift': 'Swift', '.kt': 'Kotlin', '.sql': 'SQL'
};
const maxFileSize = 2 * 1024 * 1024;

export async function scanRepository(root: string): Promise<ScanResult> {
  const resolved = await realpath(root);
  if (!(await stat(resolved)).isDirectory()) throw new Error('Select a directory.');
  const result: ScanResult = { repository: { path: resolved, name: path.basename(resolved) }, tree: [], fileCount: 0, languages: {}, skipped: 0 };
  async function walk(relative: string): Promise<TreeNode[]> {
    let entries;
    try { entries = await readdir(path.join(resolved, relative), { withFileTypes: true }); }
    catch { result.skipped++; return []; }
    entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    const nodes: TreeNode[] = [];
    for (const entry of entries) {
      const child = path.join(relative, entry.name);
      if (ignored.has(entry.name) || entry.isSymbolicLink() || isSensitivePath(child)) continue;
      if (entry.isDirectory()) nodes.push({ name: entry.name, path: child, type: 'directory', children: await walk(child) });
      else if (entry.isFile()) {
        nodes.push({ name: entry.name, path: child, type: 'file' });
        result.fileCount++;
        const language = languages[path.extname(entry.name).toLowerCase()];
        if (language) result.languages[language] = (result.languages[language] ?? 0) + 1;
      }
    }
    return nodes;
  }
  result.tree = await walk('');
  return result;
}

export async function readRepositoryFile(root: string, relative: string): Promise<string> {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) throw new Error('Invalid file path.');
  if (isSensitivePath(relative)) throw new Error('Sensitive file access is blocked.');
  const canonicalRoot = await realpath(root);
  if (canonicalRoot !== root) throw new Error('Repository location changed. Import it again.');
  const requested = path.resolve(canonicalRoot, relative);
  const candidate = await realpath(requested);
  const within = path.relative(canonicalRoot, candidate);
  if (candidate !== requested || !within || within === '..' || within.startsWith(`..${path.sep}`) || path.isAbsolute(within) ||
      relative.split(/[\\/]/).some(part => ignored.has(part))) throw new Error('File is outside the repository or excluded.');
  const info = await stat(candidate);
  if (!info.isFile() || info.size > maxFileSize) throw new Error('Only files up to 2 MB can be displayed.');
  const data = await readFile(candidate);
  if (data.length > maxFileSize || data.includes(0)) throw new Error('This file is too large or is not supported as text.');
  try { return new TextDecoder('utf-8', { fatal: true }).decode(data); }
  catch { throw new Error('This file is not supported as UTF-8 text.'); }
}
