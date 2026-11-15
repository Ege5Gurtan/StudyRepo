import { contextBridge, ipcRenderer } from 'electron';
import type { StudyRepoAPI } from '../src/shared/types';

const api: StudyRepoAPI = {
  listRepositories: () => ipcRenderer.invoke('repositories:list'),
  importRepository: () => ipcRenderer.invoke('repositories:import'),
  removeRepository: (root) => ipcRenderer.invoke('repositories:remove', root),
  askTutor: (request) => ipcRenderer.invoke('tutor:ask', request),
  askTutorWithActions: (request) => ipcRenderer.invoke('tutor:action', request),
  generateLesson: (request) => ipcRenderer.invoke('learning:generate', request),
  generateGuidedLesson: (request) => ipcRenderer.invoke('learning:guided', request),
  loadLearningArchive: (root) => ipcRenderer.invoke('learning:history:get', root),
  loadConversations: (root) => ipcRenderer.invoke('conversations:get', root),
  saveConversations: (root, store) => ipcRenderer.invoke('conversations:save', root, store),
  saveLearningArchive: (root, archive) => ipcRenderer.invoke('learning:history:save', root, archive),
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
