import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../electron/database';

describe('local database', () => {
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
