import { createHash } from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import { readRepositoryFile, scanRepository } from './repository';
import type { CodeSymbol, RepositoryIndex, SymbolKind, TreeNode } from '../src/shared/types';

const supported = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.cpp', '.cc', '.cxx', '.hpp', '.hh', '.h']);
const MAX_INDEX_FILES = 1500;
const MAX_SYMBOLS = 20000;
const MAX_FILE_BYTES = 256 * 1024;

function symbol(file: string, name: string, kind: SymbolKind, line: number): CodeSymbol {
  return { file, name, kind, line };
}

function parseTypescript(file: string, source: string): CodeSymbol[] {
  const kind = /\.tsx$/.test(file) ? ts.ScriptKind.TSX : /\.jsx$/.test(file) ? ts.ScriptKind.JSX :
    /\.(?:js|mjs|cjs)$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const results: CodeSymbol[] = [];
  function add(node: ts.Node, name: string, type: SymbolKind) {
    results.push(symbol(file, name, type, sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1));
  }
  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node) && node.name) add(node, node.name.text, 'class');
    else if (ts.isInterfaceDeclaration(node)) add(node, node.name.text, 'interface');
    else if (ts.isTypeAliasDeclaration(node)) add(node, node.name.text, 'type');
    else if (ts.isEnumDeclaration(node)) add(node, node.name.text, 'enum');
    else if (ts.isFunctionDeclaration(node) && node.name) add(node, node.name.text, 'function');
    else if (ts.isMethodDeclaration(node) && node.name) add(node, node.name.getText(sf), 'method');
    else if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) add(node, node.moduleSpecifier.text, 'import');
    else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) add(node, node.moduleSpecifier.text, 'import');
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return results;
}

// Conservative C++ declarations/includes. This is not a full C++ parser: macros,
// templates, overloads, multiline signatures and generated Unreal declarations
// may be incomplete. Only recognized syntax is indexed.
function parseCpp(file: string, source: string): CodeSymbol[] {
  const results: CodeSymbol[] = [];
  const lines = source.split(/\r?\n/);
  let blockComment = false;
  lines.forEach((raw, index) => {
    const line = raw.replace(/\/\*.*?\*\//g, '').trim();
    if (line.startsWith('/*')) blockComment = true;
    if (blockComment) {
      if (line.includes('*/')) blockComment = false;
      return;
    }
    if (!line || line.startsWith('//')) return;
    const include = line.match(/^#\s*include\s*[<"]([^>"]+)[>"]/);
    if (include) { results.push(symbol(file, include[1], 'include', index + 1)); return; }
    const declaration = line.match(/^(?:UCLASS\([^)]*\)\s*)?(class|struct|enum(?:\s+class)?)\s+(?:\w+_API\s+)?([A-Za-z_]\w*)\b/);
    if (declaration) {
      results.push(symbol(file, declaration[2], declaration[1].startsWith('enum') ? 'enum' : declaration[1] as 'class' | 'struct', index + 1));
    }
    const fn = line.match(/^(?:(?:virtual|static|inline|constexpr|explicit|FORCEINLINE)\s+)*(?:[\w:<>,*&~]+\s+)+([A-Za-z_]\w*(?:::[A-Za-z_]\w*)?)\s*\([^;]*\)\s*(?:const\s*)?(?:override\s*)?(?:\{|;|$)/);
    if (fn && !/^(?:if|for|while|switch|catch)$/.test(fn[1])) {
      results.push(symbol(file, fn[1], fn[1].includes('::') ? 'method' : 'function', index + 1));
    }
  });
  return results;
}

export function extractSymbols(file: string, source: string): CodeSymbol[] {
  const extension = path.extname(file).toLowerCase();
  if (!supported.has(extension)) return [];
  return /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(extension) ? parseTypescript(file, source) : parseCpp(file, source);
}

function listFiles(nodes: TreeNode[]): string[] {
  const files: string[] = [];
  function walk(items: TreeNode[]) {
    for (const node of items) {
      if (node.type === 'directory') walk(node.children ?? []);
      else if (supported.has(path.extname(node.path).toLowerCase())) files.push(node.path);
    }
  }
  walk(nodes);
  return files;
}

export async function buildRepositoryIndex(root: string): Promise<RepositoryIndex> {
  const scan = await scanRepository(root);
  if (scan.repository.path !== root) throw new Error('Repository location changed. Import it again.');
  const files = listFiles(scan.tree);
  if (files.length > MAX_INDEX_FILES) throw new Error(`Index limit exceeded: maximum ${MAX_INDEX_FILES} supported source files.`);
  const symbols: CodeSymbol[] = [];
  const fileHashes: { file: string; hash: string }[] = [];
  let skipped = 0;
  for (const file of files) {
    try {
      const source = await readRepositoryFile(root, file);
      if (Buffer.byteLength(source, 'utf8') > MAX_FILE_BYTES) { skipped++; continue; }
      const extracted = extractSymbols(file, source);
      if (symbols.length + extracted.length > MAX_SYMBOLS) throw new Error('Symbol index limit exceeded.');
      symbols.push(...extracted);
      fileHashes.push({ file, hash: createHash('sha256').update(source).digest('hex') });
    } catch (error) {
      if (error instanceof Error && error.message === 'Symbol index limit exceeded.') throw error;
      skipped++;
    }
  }
  return { repository: root, indexedFiles: fileHashes, symbols, skipped, indexedAt: new Date().toISOString() };
}
