import { contextBridge, ipcRenderer } from 'electron';
import type { StudyRepoAPI } from '../src/shared/types';

const api: StudyRepoAPI = {
  listRepositories: () => ipcRenderer.invoke('repositories:list'),
  importRepository: () => ipcRenderer.invoke('repositories:import'),
  removeRepository: (root) => ipcRenderer.invoke('repositories:remove', root),
  askTutor: (request) => ipcRenderer.invoke('tutor:ask', request),
  generateLesson: (request) => ipcRenderer.invoke('learning:generate', request),
  evaluateSolution: (request) => ipcRenderer.invoke('learning:evaluate', request),
  scanRepository: (root) => ipcRenderer.invoke('repositories:scan', root),
  readFile: (root, file) => ipcRenderer.invoke('files:read', root, file),
  markStudied: (root, file) => ipcRenderer.invoke('files:studied', root, file),
  getProgress: (root) => ipcRenderer.invoke('progress:get', root),
  saveQuiz: (root, quizId, answers) => ipcRenderer.invoke('quiz:save', root, quizId, answers),
  indexRepository: (root) => ipcRenderer.invoke('index:build', root),
  getIndexSummary: (root) => ipcRenderer.invoke('index:summary', root),
  searchSymbols: (root, query) => ipcRenderer.invoke('index:search', root, query)
};
contextBridge.exposeInMainWorld('studyRepo', api);
