import { useEffect, useState } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker';
import CssWorker from 'monaco-editor/language/css/css.worker.js?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker.js?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';
import { MockExplanationProvider } from './ai/provider';
import { sampleQuiz } from './study/quiz';
import type { Progress, Repository, ScanResult } from './shared/types';
import { FileTree } from './components/FileTree';
import { PracticeWorkspace, initialPracticeCode } from './components/PracticeWorkspace';
import { TutorPanel } from './components/TutorPanel';

self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'json') return new JsonWorker();
    if (['css', 'scss', 'less'].includes(label)) return new CssWorker();
    if (['html', 'handlebars', 'razor'].includes(label)) return new HtmlWorker();
    if (['typescript', 'javascript'].includes(label)) return new TsWorker();
    return new EditorWorker();
  }
};
loader.config({ monaco });

type Page = 'Overview' | 'Explorer' | 'Learn' | 'Practice' | 'Progress' | 'Settings';
type OpenFile = { path: string; content: string };
const pages: Page[] = ['Overview', 'Explorer', 'Learn', 'Practice', 'Progress', 'Settings'];
const emptyProgress: Progress = { studiedFiles: [], quizResults: [] };
const provider = new MockExplanationProvider();

export default function App() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [page, setPage] = useState<Page>('Overview');
  const [tabs, setTabs] = useState<OpenFile[]>([]);
  const [active, setActive] = useState('');
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => localStorage.getItem('theme') === 'light' ? 'light' : 'dark');
  const [answers, setAnswers] = useState<number[]>([]);
  const [feedback, setFeedback] = useState('');
  const [tutorVisible, setTutorVisible] = useState(true);
  const [practiceCode, setPracticeCode] = useState(initialPracticeCode);
  const [practiceDiagnostics, setPracticeDiagnostics] = useState<string[]>([]);
  const [explanation, setExplanation] = useState('Select code in the editor, then request a mock explanation.');
  const [selection, setSelection] = useState({ startLine: 1, endLine: 1, code: '' });

  useEffect(() => {
    window.studyRepo.listRepositories().then(setRepositories).catch(e => setError(String(e)));
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme); }, [theme]);

  async function loadRepository(repo: Repository) {
    try {
      setError('');
      const [nextScan, nextProgress] = await Promise.all([window.studyRepo.scanRepository(repo.path), window.studyRepo.getProgress(repo.path)]);
      setScan(nextScan); setProgress(nextProgress); setTabs([]); setActive(''); setPage('Overview'); setAnswers([]); setFeedback('');
    } catch (e) { setError(String(e)); }
  }
  async function importRepository() {
    try {
      setError('');
      const repo = await window.studyRepo.importRepository();
      if (repo) { setRepositories(await window.studyRepo.listRepositories()); await loadRepository(repo); }
    } catch (e) { setError(String(e)); }
  }
  async function openFile(file: string) {
    if (!scan) return;
    try {
      setError('');
      const content = await window.studyRepo.readFile(scan.repository.path, file);
      setTabs(current => current.some(tab => tab.path === file) ? current.map(tab => tab.path === file ? { path: file, content } : tab) : [...current, { path: file, content }]);
      setActive(file); setPage('Explorer'); setSelection({ startLine: 1, endLine: 1, code: '' });
      await window.studyRepo.markStudied(scan.repository.path, file);
      setProgress(await window.studyRepo.getProgress(scan.repository.path));
    } catch (e) { setError(String(e)); }
  }
  async function submitQuiz() {
    if (!scan) return;
    try {
      const result = await window.studyRepo.saveQuiz(scan.repository.path, sampleQuiz.id, answers);
      setFeedback(`Completed: ${result.score} / ${result.total} correct. Your result was saved locally.`);
      setProgress(await window.studyRepo.getProgress(scan.repository.path));
    } catch (e) { setFeedback(String(e)); }
  }
  const current = tabs.find(tab => tab.path === active);
  const percent = scan?.fileCount ? Math.min(100, Math.round(progress.studiedFiles.length / scan.fileCount * 100)) : 0;

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">S</span><div>StudyRepo<small>LEARN YOUR CODE</small></div></div>
      <button className="import-button" onClick={importRepository}>+ Import repository</button>
      <div className="sidebar-label">WORKSPACE</div>
      <nav>{pages.map((item, index) => <button key={item} className={page === item ? 'nav-active' : ''} onClick={() => setPage(item)}><span className="nav-icon">{['◫', '▤', '◇', '⌘', '◴', '⚙'][index]}</span>{item}</button>)}</nav>
      <div className="sidebar-label">RECENT REPOSITORIES</div>
      <div className="recent">{repositories.length ? repositories.map(repo => <button key={repo.path} title={repo.path} className={scan?.repository.path === repo.path ? 'selected-repo' : ''} onClick={() => loadRepository(repo)}>{repo.name}</button>) : <p>No repositories yet</p>}</div>
      <div className="sidebar-footer">Local-first · Private by design</div>
    </aside>
    <main>
      <header><div><span className="muted">WORKSPACE</span><span className="header-separator">/</span>{scan?.repository.name ?? 'No repository'}</div><div className="header-actions"><span className="header-page">{page}</span><button type="button" className="panel-toggle" aria-label={tutorVisible ? 'Hide AI Tutor' : 'Show AI Tutor'} aria-pressed={tutorVisible} onClick={() => setTutorVisible(value => !value)}>{tutorVisible ? '◧ Hide Tutor' : '◨ Show Tutor'}</button></div></header>
      {error && <div className="error" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}
      {!scan && page !== 'Settings' ? <div className="empty"><div className="empty-icon">⌘</div><h1>Learn the code you build.</h1><p>Import a local repository to explore its structure and start studying.</p><button className="primary" onClick={importRepository}>Import a repository</button></div> :
      page === 'Settings' ? <section className="content"><p className="eyebrow">PREFERENCES</p><h1>Settings</h1><p className="muted">Customize your workspace.</p><div className="card setting-row"><div><strong>Appearance</strong><p className="muted">Choose your preferred color theme.</p></div><select value={theme} onChange={e => setTheme(e.target.value as 'dark' | 'light')}><option value="dark">Dark</option><option value="light">Light</option></select></div><div className="card"><strong>AI provider</strong><p className="muted">Mock mode · No API key required. Explanations are examples, not analysis.</p></div></section> :
      scan && page === 'Overview' ? <section className="content"><p className="eyebrow">REPOSITORY OVERVIEW</p><h1>{scan.repository.name}</h1><p className="muted path">{scan.repository.path}</p><div className="stats"><div className="card"><span>FILES</span><strong>{scan.fileCount}</strong><small>in repository</small></div><div className="card"><span>LANGUAGES</span><strong>{Object.keys(scan.languages).length}</strong><small>detected by extension</small></div><div className="card"><span>STUDY PROGRESS</span><strong>{percent}%</strong><small>files opened</small></div></div>
        {scan.skipped > 0 && <p className="notice">{scan.skipped} inaccessible folders could not be scanned.</p>}
        <div className="dashboard-grid"><div className="card"><h2>Languages</h2>{Object.keys(scan.languages).length ? Object.entries(scan.languages).sort((a,b) => b[1]-a[1]).map(([name, count]) => <div className="list-row" key={name}><span>{name}</span><span className="muted">{count} files</span></div>) : <p className="muted">No supported languages detected.</p>}</div><div className="card"><h2>Recently studied</h2>{progress.studiedFiles.length ? progress.studiedFiles.slice(0, 5).map(file => <button className="list-row link" key={file.path} onClick={() => openFile(file.path)}>{file.path}</button>) : <p className="muted">Open a file to start studying.</p>}</div></div>
        <div className="card modules"><div><p className="eyebrow">EXAMPLE LEARNING MODULE</p><h2>Get to know your codebase</h2><p className="muted">Explore your files, then try a sample C++ practice exercise.</p></div><button onClick={() => setPage('Practice')}>Open practice →</button></div>
      </section> :
      scan && page === 'Explorer' ? <div className="workspace-with-tutor"><div className="explorer"><div className="file-panel"><div className="panel-title">EXPLORER <span>{scan.fileCount} files</span></div><div className="repo-heading">▾ {scan.repository.name}</div><FileTree nodes={scan.tree} open={openFile}/></div><div className="editor-area"><div className="tabs">{tabs.map(tab => <div className={`tab ${active === tab.path ? 'active-tab' : ''}`} key={tab.path}><button title={tab.path} onClick={() => { setActive(tab.path); setSelection({ startLine: 1, endLine: 1, code: '' }); }}>{tab.path.split(/[\\\\/]/).pop()}</button><button aria-label={`Close ${tab.path}`} onClick={() => { const rest = tabs.filter(t => t.path !== tab.path); setTabs(rest); if (active === tab.path) setActive(rest.at(-1)?.path ?? ''); }}>×</button></div>)}</div>{current ? <Editor path={current.path} value={current.content} theme={theme === 'dark' ? 'vs-dark' : 'light'} options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, automaticLayout: true }} onMount={editor => { editor.onDidChangeCursorSelection(event => { const range = event.selection; setSelection({ startLine: range.startLineNumber, endLine: range.endLineNumber, code: editor.getModel()?.getValueInRange(range) ?? '' }); }); }} /> : <div className="editor-empty">Select a file to explore</div>}</div></div>{tutorVisible && <TutorPanel key={scan.repository.path} repository={scan.repository.name} context={current ? `Explorer · ${current.path} · lines ${selection.startLine}–${selection.endLine}` : 'Explorer'} selection={selection.code} onExplain={current ? async () => { const text = await provider.explain({ file: current.path, ...selection }); setExplanation(text); return text; } : undefined} explanation={explanation}/>}</div> :
      scan && page === 'Learn' ? <div className="workspace-with-tutor"><section className="content narrow"><p className="eyebrow">REPOSITORY LEARNING</p><h1>Learn {scan.repository.name}</h1><p className="muted">Start by exploring a source file, or review the introductory sample quiz. Repository-generated lessons are not yet available.</p><div className="card modules"><div><h2>Explore real code</h2><p className="muted">Select files and ask the mock tutor about a highlighted section.</p></div><button onClick={() => setPage('Explorer')}>Open Explorer →</button></div><div className="card quiz"><span className="badge">GENERAL EXAMPLE · NOT REPOSITORY-SPECIFIC</span><h2>{sampleQuiz.title}</h2>{sampleQuiz.questions.map((question, index) => <fieldset key={question.prompt}><legend>{index + 1}. {question.prompt}</legend>{question.options.map((option, optionIndex) => <label key={option}><input type="radio" name={`question-${index}`} checked={answers[index] === optionIndex} onChange={() => setAnswers(current => { const next = [...current]; next[index] = optionIndex; return next; })}/>{option}</label>)}</fieldset>)}<button className="primary" onClick={submitQuiz}>Submit answers</button>{feedback && <p role="status">{feedback}</p>}</div></section>{tutorVisible && <TutorPanel key={scan.repository.path} repository={scan.repository.name} context="Learn · introductory quiz"/>}</div> :
      scan && page === 'Practice' ? <div className="workspace-with-tutor"><PracticeWorkspace code={practiceCode} onCodeChange={setPracticeCode} diagnostics={practiceDiagnostics} onDiagnostics={setPracticeDiagnostics}/>{tutorVisible && <TutorPanel key={scan.repository.path} repository={scan.repository.name} context="Practice · Find Missing Chunks" selection={practiceCode} diagnostics={practiceDiagnostics}/>}</div> :
      scan && page === 'Progress' ? <section className="content"><p className="eyebrow">YOUR LEARNING</p><h1>Progress</h1><p className="muted">Stored locally for {scan.repository.name}.</p><div className="stats"><div className="card"><span>FILES STUDIED</span><strong>{progress.studiedFiles.length}</strong><small>of {scan.fileCount} current files</small></div><div className="card"><span>QUIZZES COMPLETED</span><strong>{progress.quizResults.length}</strong><small>attempts saved</small></div></div><div className="card"><h2>Quiz history</h2>{progress.quizResults.length ? progress.quizResults.map(result => <div className="list-row" key={result.id}><span>Sample quiz · {result.score}/{result.total}</span><span className="muted">{new Date(result.completedAt).toLocaleString()}</span></div>) : <p className="muted">No quizzes completed yet.</p>}</div></section> : null}
    </main>
  </div>;
}
