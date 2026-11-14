import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { Database } from './database';
import { readRepositoryFile, scanRepository } from './repository';
import { buildRepositoryIndex } from './intelligence';
import { askTutor } from './tutor';
import { generateLesson, evaluateSolution } from './learning';
import { sampleQuiz, scoreQuiz } from '../src/study/quiz';

let db: Database;
function requireRepository(root: unknown): asserts root is string {
  if (typeof root !== 'string' || !db.hasRepository(root)) throw new Error('Repository has not been imported.');
}

function registerHandlers() {
  ipcMain.handle('repositories:list', () => db.listRepositories());
  ipcMain.handle('repositories:import', async () => {
    const selection = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (selection.canceled || !selection.filePaths[0]) return null;
    const result = await scanRepository(selection.filePaths[0]);
    db.addRepository(result.repository);
    return result.repository;
  });
  ipcMain.handle('repositories:remove', (_event, root: unknown) => {
    requireRepository(root);
    db.removeRepository(root);
  });
  ipcMain.handle('tutor:ask', async (_event, request: unknown) => {
    if (!request || typeof request !== 'object') throw new Error('Invalid tutor request.');
    const root = (request as { repository?: unknown }).repository;
    requireRepository(root);
    return askTutor(request);
  });
  ipcMain.handle('learning:history:get', (_event, root: unknown) => {
    requireRepository(root);
    return db.loadLearningArchive(root);
  });
  ipcMain.handle('learning:history:save', (_event, root: unknown, archive: unknown) => {
    requireRepository(root);
    db.saveLearningArchive(root, archive);
  });
  ipcMain.handle('learning:generate', async (_event, request: unknown) => {
    if (!request || typeof request !== 'object') throw new Error('Invalid learning request.');
    requireRepository((request as { repository?: unknown }).repository);
    return generateLesson(request);
  });
  ipcMain.handle('learning:evaluate', async (_event, request: unknown) => {
    if (!request || typeof request !== 'object') throw new Error('Invalid evaluation request.');
    requireRepository((request as { repository?: unknown }).repository);
    return evaluateSolution(request);
  });
  ipcMain.handle('repositories:scan', async (_event, root: unknown) => {
    requireRepository(root);
    const scan = await scanRepository(root);
    if (scan.repository.path !== root) throw new Error('Repository location changed. Import it again.');
    return scan;
  });
  ipcMain.handle('files:read', async (_event, root: unknown, file: string) => {
    requireRepository(root);
    return readRepositoryFile(root, file);
  });
  ipcMain.handle('files:studied', async (_event, root: unknown, file: string) => {
    requireRepository(root);
    await readRepositoryFile(root, file);
    db.markStudied(root, file);
  });
  ipcMain.handle('index:build', async (_event, root: unknown) => {
    requireRepository(root);
    const index = await buildRepositoryIndex(root);
    return db.saveIndex(index);
  });
  ipcMain.handle('index:summary', (_event, root: unknown) => {
    requireRepository(root);
    return db.getIndexSummary(root);
  });
  ipcMain.handle('index:search', (_event, root: unknown, query: unknown) => {
    requireRepository(root);
    if (typeof query !== 'string' || query.length > 120) throw new Error('Invalid symbol query.');
    return db.searchSymbols(root, query);
  });
  ipcMain.handle('progress:get', (_event, root: unknown) => {
    requireRepository(root);
    return db.getProgress(root);
  });
  ipcMain.handle('quiz:save', (_event, root: unknown, quizId: string, answers: number[]) => {
    requireRepository(root);
    if (quizId !== sampleQuiz.id) throw new Error('Unknown quiz.');
    const { score, total } = scoreQuiz(answers);
    return db.saveQuiz(root, quizId, score, total);
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440, height: 900, minWidth: 800, minHeight: 600, backgroundColor: '#111318',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  if (process.env.STUDYREPO_DEV_URL === 'http://127.0.0.1:5173') window.loadURL(process.env.STUDYREPO_DEV_URL);
  else window.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(() => {
  db = new Database(path.join(app.getPath('userData'), 'studyrepo.sqlite'));
  registerHandlers();
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => db?.close());
