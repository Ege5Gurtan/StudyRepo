export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}
export interface Repository {
  path: string;
  name: string;
}
export interface ScanResult {
  repository: Repository;
  tree: TreeNode[];
  fileCount: number;
  languages: Record<string, number>;
  skipped: number;
}
export interface QuizResult {
  id: number;
  quizId: string;
  score: number;
  total: number;
  completedAt: string;
}
export interface Progress {
  studiedFiles: { path: string; studiedAt: string }[];
  quizResults: QuizResult[];
}
export interface StudyRepoAPI {
  listRepositories(): Promise<Repository[]>;
  importRepository(): Promise<Repository | null>;
  scanRepository(path: string): Promise<ScanResult>;
  readFile(repository: string, path: string): Promise<string>;
  markStudied(repository: string, path: string): Promise<void>;
  getProgress(repository: string): Promise<Progress>;
  saveQuiz(repository: string, quizId: string, answers: number[]): Promise<QuizResult>;
}
