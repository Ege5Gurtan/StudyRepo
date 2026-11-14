import { DatabaseSync } from 'node:sqlite';
import type { Progress, QuizResult, Repository } from '../src/shared/types';

export class Database {
  private db: DatabaseSync;
  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS repositories (path TEXT PRIMARY KEY, name TEXT NOT NULL, opened_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS studied_files (repository TEXT NOT NULL REFERENCES repositories(path), path TEXT NOT NULL, studied_at TEXT NOT NULL, PRIMARY KEY(repository, path));
      CREATE TABLE IF NOT EXISTS quiz_results (id INTEGER PRIMARY KEY, repository TEXT NOT NULL REFERENCES repositories(path), quiz_id TEXT NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL, completed_at TEXT NOT NULL);
    `);
  }
  addRepository(repo: Repository): void {
    this.db.prepare('INSERT INTO repositories VALUES (?, ?, ?) ON CONFLICT(path) DO UPDATE SET name=excluded.name, opened_at=excluded.opened_at').run(repo.path, repo.name, new Date().toISOString());
  }
  hasRepository(root: string): boolean {
    return !!this.db.prepare('SELECT path FROM repositories WHERE path = ?').get(root);
  }
  listRepositories(): Repository[] {
    return this.db.prepare('SELECT path, name FROM repositories ORDER BY opened_at DESC').all() as unknown as Repository[];
  }
  markStudied(root: string, file: string): void {
    this.db.prepare('INSERT INTO studied_files VALUES (?, ?, ?) ON CONFLICT(repository, path) DO UPDATE SET studied_at=excluded.studied_at').run(root, file, new Date().toISOString());
  }
  getProgress(root: string): Progress {
    return {
      studiedFiles: this.db.prepare('SELECT path, studied_at AS studiedAt FROM studied_files WHERE repository = ? ORDER BY studied_at DESC').all(root) as unknown as Progress['studiedFiles'],
      quizResults: this.db.prepare('SELECT id, quiz_id AS quizId, score, total, completed_at AS completedAt FROM quiz_results WHERE repository = ? ORDER BY id DESC').all(root) as unknown as QuizResult[]
    };
  }
  saveQuiz(root: string, quizId: string, score: number, total: number): QuizResult {
    const completedAt = new Date().toISOString();
    const result = this.db.prepare('INSERT INTO quiz_results (repository, quiz_id, score, total, completed_at) VALUES (?, ?, ?, ?, ?)').run(root, quizId, score, total, completedAt);
    return { id: Number(result.lastInsertRowid), quizId, score, total, completedAt };
  }
  close(): void { this.db.close(); }
}
