import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../electron/database';
import { addChallenge, emptyArchive } from '../src/study/history';
import { newConversation, changeConversationArchive, selectConversation, emptyConversations } from '../src/study/conversations';

describe('local database', () => {
  it('migrates legacy history and persists multiple independent conversations across restarts', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'studyrepo-conversations-'));
    const filename = path.join(directory, 'db.sqlite');
    const session = { goal: 'Learn functions', topicIndex: 0, sourceContext: 'function a() {}',
      topics: [{ id: 'functions', title: 'Functions', objective: 'Understand functions' }],
      lesson: { introduction: 'Start', explanation: 'Learn', references: [],
        challenge: { title: 'Function', description: 'Write a function', language: 'javascript', starterCode: 'function a() {}', criteria: ['Return'] } } };
    try {
      const db = new Database(filename);
      db.addRepository({ name: 'project', path: '/project' });
      const legacy = addChallenge(emptyArchive(), session);
      db.saveLearningArchive('/project', legacy);
      let store = db.loadConversations('/project');
      expect(store.conversations).toHaveLength(1);
      expect(store.conversations[0].archive.entries).toEqual(legacy.entries);
      const original = store.activeId!;
      store = newConversation(store);
      const second = store.activeId!;
      store = changeConversationArchive(store, archive => addChallenge(archive, { ...session, goal: 'Learn loops' }));
      store = selectConversation(store, original);
      db.saveConversations('/project', store);
      db.close();
      const reopened = new Database(filename);
      const saved = reopened.loadConversations('/project');
      expect(saved.activeId).toBe(original);
      expect(saved.conversations.find(c => c.id === original)?.archive.entries).toHaveLength(1);
      expect(saved.conversations.find(c => c.id === second)?.archive.entries[0].session.goal).toBe('Learn loops');
      reopened.removeRepository('/project');
      expect(reopened.loadConversations('/project')).toEqual(emptyConversations());
      reopened.close();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });


  it('persists challenge drafts and evaluated solutions across database restarts and isolates repositories', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'studyrepo-history-db-'));
    const filename = path.join(directory, 'db.sqlite');
    const session = { goal: 'Practice functions', topicIndex: 0, sourceContext: 'function example() {}',
      topics: [{ id: 'functions', title: 'Functions', objective: 'Learn functions' }],
      lesson: { introduction: 'Welcome', explanation: 'Function lesson', references: [],
        challenge: { title: 'Example', description: 'Write a function', language: 'javascript',
          starterCode: 'function example() {}', criteria: ['Returns a number'] } } };
    try {
      const db = new Database(filename);
      db.addRepository({ path: '/one', name: 'one' });
      db.addRepository({ path: '/two', name: 'two' });
      const archive = addChallenge(emptyArchive(), session);
      db.saveLearningArchive('/one', archive);
      expect(db.loadLearningArchive('/two')).toEqual(emptyArchive());
      db.close();
      const reopened = new Database(filename);
      expect(reopened.loadLearningArchive('/one')).toEqual(archive);
      reopened.removeRepository('/one');
      expect(reopened.loadLearningArchive('/one')).toEqual(emptyArchive());
      expect(reopened.listRepositories()).toEqual([{ path: '/two', name: 'two' }]);
      reopened.close();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it('removes imported repository metadata without touching any source folder', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'studyrepo-remove-db-'));
    const filename = path.join(directory, 'db.sqlite');
    try {
      const db = new Database(filename);
      db.addRepository({ path: '/one', name: 'one' });
      db.addRepository({ path: '/two', name: 'two' });
      db.markStudied('/one', 'main.ts');
      db.saveQuiz('/one', 'code-reading-basics', 1, 3);
      db.saveIndex({
        repository: '/one', indexedFiles: [{ file: 'main.ts', hash: 'hash' }],
        symbols: [{ file: 'main.ts', line: 1, name: 'App', kind: 'class' }],
        skipped: 0, indexedAt: new Date().toISOString()
      });
      db.removeRepository('/one');
      expect(db.hasRepository('/one')).toBe(false);
      expect(db.listRepositories()).toEqual([{ path: '/two', name: 'two' }]);
      expect(db.getIndexSummary('/one').symbols).toBe(0);
      expect(db.getProgress('/one').quizResults).toHaveLength(0);
      expect(() => db.removeRepository('/one')).toThrow('Repository has not been imported.');
      db.close();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

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
