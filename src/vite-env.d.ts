/// <reference types="vite/client" />
import type { StudyRepoAPI } from './shared/types';
declare global {
  interface Window { studyRepo: StudyRepoAPI }
}
