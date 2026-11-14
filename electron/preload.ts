import { contextBridge, ipcRenderer } from 'electron';
import type { StudyRepoAPI } from '../src/shared/types';

const api: StudyRepoAPI = {
  listRepositories: () => ipcRenderer.invoke('repositories:list'),
  importRepository: () => ipcRenderer.invoke('repositories:import'),
  scanRepository: (root) => ipcRenderer.invoke('repositories:scan', root),
  readFile: (root, file) => ipcRenderer.invoke('files:read', root, file),
  markStudied: (root, file) => ipcRenderer.invoke('files:studied', root, file),
  getProgress: (root) => ipcRenderer.invoke('progress:get', root),
  saveQuiz: (root, quizId, answers) => ipcRenderer.invoke('quiz:save', root, quizId, answers)
};
contextBridge.exposeInMainWorld('studyRepo', api);
