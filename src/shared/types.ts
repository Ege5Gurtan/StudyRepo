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
export type TutorAction =
  | { type: 'message'; text: string }
  | { type: 'generate_challenge'; focus: string; scope: 'single' | 'set' };
export interface LearningReference {
  file: string;
  startLine: number;
  endLine: number;
}
export interface LearningTopic {
  id: string;
  title: string;
  objective: string;
}
export interface CodingChallenge {
  title: string;
  description: string;
  language: string;
  starterCode: string;
  criteria: string[];
}
export interface LearningLesson {
  introduction: string;
  explanation: string;
  references: LearningReference[];
  challenge: CodingChallenge;
}
export interface LearningSession {
  goal: string;
  topics: LearningTopic[];
  topicIndex: number;
  lesson: LearningLesson;
  sourceContext: string;
}
export interface LearningEvaluation {
  status: 'passed' | 'needs_revision' | 'unable_to_verify';
  feedback: string;
  criteria: { criterion: string; met: boolean; explanation: string }[];
}
export interface LearningGenerateRequest {
  repository: string;
  goal: string;
  mode: 'start' | 'next' | 'similar' | 'extend' | 'focused';
  topics?: LearningTopic[];
  topicIndex?: number;
  previousChallenge?: CodingChallenge;
  focus?: string;
}
export interface LearningEvaluateRequest {
  repository: string;
  lesson: LearningLesson;
  code: string;
}
export interface ChallengeAttempt {
  code: string;
  evaluation: LearningEvaluation;
  submittedAt: string;
}
export interface ChallengeHistoryEntry {
  id: string;
  session: LearningSession;
  code: string;
  attempts: ChallengeAttempt[];
  status: 'active' | 'skipped';
  createdAt: string;
}
export interface LearningArchive {
  entries: ChallengeHistoryEntry[];
  activeIndex: number;
  messages: TutorMessage[];
}
export interface LearningConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archive: LearningArchive;
}
export interface ConversationStore {
  conversations: LearningConversation[];
  activeId: string | null;
}
export interface StudyRepoAPI {
  listRepositories(): Promise<Repository[]>;
  importRepository(): Promise<Repository | null>;
  removeRepository(path: string): Promise<void>;
  askTutor(request: TutorRequest): Promise<string>;
  askTutorWithActions(request: TutorRequest): Promise<TutorAction>;
  generateLesson(request: LearningGenerateRequest): Promise<LearningSession>;
  evaluateSolution(request: LearningEvaluateRequest): Promise<LearningEvaluation>;
  loadLearningArchive(repository: string): Promise<LearningArchive>;
  saveLearningArchive(repository: string, archive: LearningArchive): Promise<void>;
  loadConversations(repository: string): Promise<ConversationStore>;
  saveConversations(repository: string, store: ConversationStore): Promise<void>;
  scanRepository(path: string): Promise<ScanResult>;
  readFile(repository: string, path: string): Promise<string>;
  markStudied(repository: string, path: string): Promise<void>;
  getProgress(repository: string): Promise<Progress>;
  saveQuiz(repository: string, quizId: string, answers: number[]): Promise<QuizResult>;
  indexRepository(repository: string): Promise<IndexSummary>;
  getIndexSummary(repository: string): Promise<IndexSummary>;
  searchSymbols(repository: string, query: string): Promise<CodeSymbol[]>;
}
