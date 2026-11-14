import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../electron/database';

describe('local database', () => {
  it('persists searchable symbols and atomically replaces an index', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'studyrepo-symbol-db-'));
    const filename = path.join(directory, 'db.sqlite');
    try {
      const db = new Database(filename);
      db.addRepository({ name: 'project', path: '/project' });
      const initial = { repository: '/project', indexedFiles: [{ file: 'one.ts', hash: 'abc' }],
        symbols: [{ file: 'one.ts', name: 'Engine', kind: 'class' as const, line: 2 }],
        skipped: 0, indexedAt: new Date().toISOString() };
      expect(db.saveIndex(initial).symbols).toBe(1);
      expect(db.searchSymbols('/project', 'eng')).toHaveLength(1);
      expect(db.searchSymbols('/project', 'other')).toEqual([]);
      db.saveIndex({ ...initial, indexedFiles: [{ file: 'two.ts', hash: 'def' }],
        symbols: [{ file: 'two.ts', name: 'Manager', kind: 'function', line: 4 }] });
      expect(db.searchSymbols('/project', 'Engine')).toEqual([]);
      db.close();
      const reopened = new Database(filename);
      expect(reopened.getIndexSummary('/project')).toMatchObject({ indexedFiles: 1, symbols: 1, skipped: 0 });
      expect(reopened.searchSymbols('/project', 'manager')).toEqual([{ file: 'two.ts', name: 'Manager', kind: 'function', line: 4 }]);
      reopened.close();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it('persists repositories, studied files and quiz attempts across restarts', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'studyrepo-db-'));
    const filename = path.join(directory, 'db.sqlite');
    try {
      const db = new Database(filename);
      db.addRepository({ name: 'project', path: '/project' });
      db.markStudied('/project', 'index.ts');
      db.markStudied('/project', 'index.ts');
      db.saveQuiz('/project', 'code-reading-basics', 2, 3);
      db.close();
      const reopened = new Database(filename);
      expect(reopened.listRepositories()).toEqual([{ name: 'project', path: '/project' }]);
      expect(reopened.getProgress('/project').studiedFiles).toHaveLength(1);
      expect(reopened.getProgress('/project').quizResults[0]).toMatchObject({ score: 2, total: 3 });
      reopened.close();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
