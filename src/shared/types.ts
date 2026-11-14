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
export type SymbolKind = 'class' | 'struct' | 'interface' | 'type' | 'enum' | 'function' | 'method' | 'import' | 'include';
export interface CodeSymbol {
  file: string;
  name: string;
  kind: SymbolKind;
  line: number;
}
export interface RepositoryIndex {
  repository: string;
  indexedFiles: { file: string; hash: string }[];
  symbols: CodeSymbol[];
  skipped: number;
  indexedAt: string;
}
export interface IndexSummary {
  indexedFiles: number;
  symbols: number;
  skipped: number;
  indexedAt: string | null;
}
export interface TutorMessage { role: 'user' | 'assistant'; content: string }
export interface TutorRequest {
  repository: string;
  context: 'Practice' | 'Explorer';
  sourceFile?: string;
  question: string;
  code: string;
  diagnostics?: string[];
  history: TutorMessage[];
}
export interface StudyRepoAPI {
  listRepositories(): Promise<Repository[]>;
  importRepository(): Promise<Repository | null>;
  removeRepository(path: string): Promise<void>;
  askTutor(request: TutorRequest): Promise<string>;
  scanRepository(path: string): Promise<ScanResult>;
  readFile(repository: string, path: string): Promise<string>;
  markStudied(repository: string, path: string): Promise<void>;
  getProgress(repository: string): Promise<Progress>;
  saveQuiz(repository: string, quizId: string, answers: number[]): Promise<QuizResult>;
  indexRepository(repository: string): Promise<IndexSummary>;
  getIndexSummary(repository: string): Promise<IndexSummary>;
  searchSymbols(repository: string, query: string): Promise<CodeSymbol[]>;
}
