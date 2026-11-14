import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { readRepositoryFile, scanRepository } from '../electron/repository';

describe('repository services', () => {
  let base: string;
  let root: string;
  beforeEach(async () => {
    base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'studyrepo-')));
    root = path.join(base, 'repo');
    await mkdir(path.join(root, 'src'), { recursive: true });
    await mkdir(path.join(root, 'node_modules'));
    await writeFile(path.join(root, 'src', 'app.ts'), 'export const value = 1;');
    await writeFile(path.join(root, 'README.md'), '# Hello');
    await writeFile(path.join(root, 'node_modules', 'ignored.js'), 'ignored');
    await writeFile(path.join(base, 'outside.txt'), 'private');
    await symlink(path.join(base, 'outside.txt'), path.join(root, 'link.txt'));
  });
  afterEach(async () => { await rm(base, { recursive: true, force: true }); });
  it('scans files, languages, and excludes generated directories and links', async () => {
    const scan = await scanRepository(root);
    expect(scan.fileCount).toBe(2);
    expect(scan.languages).toEqual({ TypeScript: 1, Markdown: 1 });
    expect(scan.tree.map(node => node.name)).toEqual(['src', 'README.md']);
    expect(await readRepositoryFile(root, path.join('src', 'app.ts'))).toContain('value');
  });
  it('rejects traversal, external links, ignored files and binary data', async () => {
    await writeFile(path.join(root, 'binary'), Buffer.from([0, 1, 2]));
    await expect(readRepositoryFile(root, '../outside.txt')).rejects.toThrow();
    await expect(readRepositoryFile(root, 'link.txt')).rejects.toThrow();
    await expect(readRepositoryFile(root, 'node_modules/ignored.js')).rejects.toThrow();
    await expect(readRepositoryFile(root, 'binary')).rejects.toThrow();
    await expect(scanRepository(path.join(base, 'missing'))).rejects.toThrow();
  });
});
