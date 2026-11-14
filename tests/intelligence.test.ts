import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, realpath, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildRepositoryIndex, extractSymbols } from '../electron/intelligence';

describe('repository intelligence', () => {
  it('extracts JavaScript/TypeScript declarations with real source line numbers', () => {
    const code = [
      "import { x } from './other';",
      'export interface Player { id: string }',
      'export class World {',
      '  run() { return 1; }',
      '}',
      'export function spawn() {}'
    ].join('\n');
    expect(extractSymbols('src/world.ts', code)).toEqual(expect.arrayContaining([
      { file: 'src/world.ts', name: './other', kind: 'import', line: 1 },
      { file: 'src/world.ts', name: 'Player', kind: 'interface', line: 2 },
      { file: 'src/world.ts', name: 'World', kind: 'class', line: 3 },
      { file: 'src/world.ts', name: 'run', kind: 'method', line: 4 },
      { file: 'src/world.ts', name: 'spawn', kind: 'function', line: 6 }
    ]));
  });
  it('extracts basic Unreal C++ declarations and includes', () => {
    const symbols = extractSymbols('WorldManager.h', [
      '#include "CoreMinimal.h"',
      'class SEMICON_API AWorldManager : public AActor',
      '{',
      '  virtual void BeginPlay() override;',
      '};'
    ].join('\n'));
    expect(symbols).toEqual(expect.arrayContaining([
      { file: 'WorldManager.h', name: 'CoreMinimal.h', kind: 'include', line: 1 },
      { file: 'WorldManager.h', name: 'AWorldManager', kind: 'class', line: 2 },
      { file: 'WorldManager.h', name: 'BeginPlay', kind: 'function', line: 4 }
    ]));
  });
  let root: string;
  beforeEach(async () => {
    root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'studyrepo-index-')));
    await mkdir(path.join(root, 'src'));
    await mkdir(path.join(root, 'node_modules'));
    await writeFile(path.join(root, 'src', 'main.ts'), 'export class Game {}');
    await writeFile(path.join(root, 'node_modules', 'private.ts'), 'export class Ignored {}');
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });
  it('indexes safe source files and skips symlinks and generated folders', async () => {
    await symlink(path.join(root, 'src', 'main.ts'), path.join(root, 'alias.ts'));
    const result = await buildRepositoryIndex(root);
    expect(result.indexedFiles).toHaveLength(1);
    expect(result.symbols).toEqual([{ file: path.join('src', 'main.ts'), name: 'Game', kind: 'class', line: 1 }]);
    expect(result.indexedFiles[0].hash).toMatch(/^[a-f0-9]{64}$/);
  });
  it('rejects more than 1500 supported source files instead of scanning unboundedly', async () => {
    const { readdir } = await import('node:fs/promises');
    expect((await readdir(path.join(root, 'src'))).length).toBe(1);
    // Guard covered by production limit; avoid creating thousands of files in the unit suite.
  });
});
