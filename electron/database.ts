import { DatabaseSync } from 'node:sqlite';
import type { CodeSymbol, IndexSummary, Progress, QuizResult, Repository, RepositoryIndex } from '../src/shared/types';

export class Database {
  private db: DatabaseSync;
  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS repositories (path TEXT PRIMARY KEY, name TEXT NOT NULL, opened_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS studied_files (repository TEXT NOT NULL REFERENCES repositories(path), path TEXT NOT NULL, studied_at TEXT NOT NULL, PRIMARY KEY(repository, path));
      CREATE TABLE IF NOT EXISTS quiz_results (id INTEGER PRIMARY KEY, repository TEXT NOT NULL REFERENCES repositories(path), quiz_id TEXT NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL, completed_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS code_symbols (repository TEXT NOT NULL REFERENCES repositories(path), file TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, line INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_code_symbols_repo_name ON code_symbols(repository, name);
      CREATE TABLE IF NOT EXISTS index_files (repository TEXT NOT NULL REFERENCES repositories(path), file TEXT NOT NULL, hash TEXT NOT NULL, PRIMARY KEY(repository, file));
      CREATE TABLE IF NOT EXISTS index_status (repository TEXT PRIMARY KEY REFERENCES repositories(path), indexed_at TEXT NOT NULL, skipped INTEGER NOT NULL);
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
  saveIndex(index: RepositoryIndex): IndexSummary {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM code_symbols WHERE repository = ?').run(index.repository);
      this.db.prepare('DELETE FROM index_files WHERE repository = ?').run(index.repository);
      const putSymbol = this.db.prepare('INSERT INTO code_symbols (repository, file, name, kind, line) VALUES (?, ?, ?, ?, ?)');
      const putFile = this.db.prepare('INSERT INTO index_files (repository, file, hash) VALUES (?, ?, ?)');
      for (const item of index.symbols) putSymbol.run(index.repository, item.file, item.name, item.kind, item.line);
      for (const item of index.indexedFiles) putFile.run(index.repository, item.file, item.hash);
      this.db.prepare('INSERT INTO index_status (repository, indexed_at, skipped) VALUES (?, ?, ?) ON CONFLICT(repository) DO UPDATE SET indexed_at=excluded.indexed_at, skipped=excluded.skipped').run(index.repository, index.indexedAt, index.skipped);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.getIndexSummary(index.repository);
  }
  getIndexSummary(root: string): IndexSummary {
    const row = this.db.prepare('SELECT indexed_at AS indexedAt, skipped FROM index_status WHERE repository = ?').get(root) as { indexedAt: string; skipped: number } | undefined;
    const files = this.db.prepare('SELECT COUNT(*) AS count FROM index_files WHERE repository = ?').get(root) as { count: number };
    const symbols = this.db.prepare('SELECT COUNT(*) AS count FROM code_symbols WHERE repository = ?').get(root) as { count: number };
    return { indexedFiles: files.count, symbols: symbols.count, skipped: row?.skipped ?? 0, indexedAt: row?.indexedAt ?? null };
  }
  searchSymbols(root: string, query: string): CodeSymbol[] {
    const escaped = query.trim().slice(0, 120).replace(/[\\%_]/g, '\\  close(): void { this.db.close(); }');
    const pattern = '%' + escaped + '%';
    return this.db.prepare("SELECT file, name, kind, line FROM code_symbols WHERE repository = ? AND (name LIKE ? ESCAPE '\\' OR file LIKE ? ESCAPE '\\') ORDER BY CASE WHEN name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, name, file, line LIMIT 150").all(root, pattern, pattern, pattern) as unknown as CodeSymbol[];
  }
  close(): void { this.db.close(); }
}
