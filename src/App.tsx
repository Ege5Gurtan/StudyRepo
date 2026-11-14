import { useEffect, useRef, useState } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker';
import CssWorker from 'monaco-editor/language/css/css.worker.js?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker.js?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';
import type { IndexSummary, Repository, ScanResult } from './shared/types';
import { FileTree } from './components/FileTree';
import { SymbolExplorer } from './components/SymbolExplorer';
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

type Page = 'Overview' | 'Explorer' | 'Practice' | 'Settings';
type OpenFile = { path: string; content: string };
const pages: Page[] = ['Overview', 'Explorer', 'Practice', 'Settings'];

export default function App() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [indexSummary, setIndexSummary] = useState<IndexSummary | null>(null);
  const [jump, setJump] = useState<{ file: string; line: number } | null>(null);
  const explorerEditor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [page, setPage] = useState<Page>('Overview');
  const [tabs, setTabs] = useState<OpenFile[]>([]);
  const [active, setActive] = useState('');
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => localStorage.getItem('theme') === 'light' ? 'light' : 'dark');
  const [tutorVisible, setTutorVisible] = useState(true);
  const [practiceCode, setPracticeCode] = useState(initialPracticeCode);
  const [practiceDiagnostics, setPracticeDiagnostics] = useState<string[]>([]);
  const [selection, setSelection] = useState({ startLine: 1, endLine: 1, code: '' });

  useEffect(() => {
    window.studyRepo.listRepositories().then(setRepositories).catch(e => setError(String(e)));
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme); }, [theme]);

  async function loadRepository(repo: Repository) {
    try {
      setError('');
      const [nextScan, nextIndex] = await Promise.all([window.studyRepo.scanRepository(repo.path), window.studyRepo.getIndexSummary(repo.path)]);
      setScan(nextScan); setIndexSummary(nextIndex); setJump(null); setTabs([]); setActive(''); setPage('Practice'); setPracticeCode(initialPracticeCode); setPracticeDiagnostics([]);
    } catch (e) { setError(String(e)); }
  }
  async function importRepository() {
    try {
      setError('');
      const repo = await window.studyRepo.importRepository();
      if (repo) { setRepositories(await window.studyRepo.listRepositories()); await loadRepository(repo); }
    } catch (e) { setError(String(e)); }
  }
  async function openFile(file: string, line?: number) {
    if (!scan) return;
    try {
      setError('');
      const content = await window.studyRepo.readFile(scan.repository.path, file);
      setTabs(current => current.some(tab => tab.path === file) ? current.map(tab => tab.path === file ? { path: file, content } : tab) : [...current, { path: file, content }]);
      setActive(file); setPage('Explorer'); setSelection({ startLine: 1, endLine: 1, code: '' }); setJump(line ? { file, line } : null);
      await window.studyRepo.markStudied(scan.repository.path, file);
    } catch (e) { setError(String(e)); }
  }
  useEffect(() => {
    if (jump && jump.file === active && explorerEditor.current) {
      explorerEditor.current.revealLineInCenter(jump.line);
      explorerEditor.current.setPosition({ lineNumber: jump.line, column: 1 });
    }
  }, [active, jump]);

  async function removeImportedRepository(repo: Repository) {
    if (!window.confirm(`Remove "${repo.name}" from StudyRepo? This will clear its local study records and symbol index, but will NOT delete its files from disk.`)) return;
    try {
      setError('');
      await window.studyRepo.removeRepository(repo.path);
      setRepositories(await window.studyRepo.listRepositories());
      if (scan?.repository.path === repo.path) {
        setScan(null); setTabs([]); setActive(''); setIndexSummary(null); setJump(null);
        setPage('Overview');
      }
    } catch (e) { setError(String(e)); }
  }
  const current = tabs.find(tab => tab.path === active);

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">S</span><div>StudyRepo<small>LEARN YOUR CODE</small></div></div>
      <button className="import-button" onClick={importRepository}>+ Import repository</button>
      <div className="sidebar-label">WORKSPACE</div>
      <nav>{pages.map((item, index) => <button key={item} className={page === item ? 'nav-active' : ''} onClick={() => setPage(item)}><span className="nav-icon">{['◫', '▤', '⌘', '⚙'][index]}</span>{item}</button>)}</nav>
      <div className="sidebar-label">RECENT REPOSITORIES</div>
      <div className="recent">{repositories.length ? repositories.map(repo => <div className={`recent-item ${scan?.repository.path === repo.path ? 'selected-repo' : ''}`} key={repo.path}><button title={repo.path} className="recent-open" onClick={() => { void loadRepository(repo); }}>{repo.name}</button><button className="recent-remove" aria-label={`Remove ${repo.name} from StudyRepo`} title="Remove from StudyRepo (files stay on disk)" onClick={() => { void removeImportedRepository(repo); }}>×</button></div>) : <p>No repositories yet</p>}</div>
      <div className="sidebar-footer">Local-first · Private by design</div>
    </aside>
    <main>
      <header><div><span className="muted">WORKSPACE</span><span className="header-separator">/</span>{scan?.repository.name ?? 'No repository'}</div><div className="header-actions"><span className="header-page">{page}</span><button type="button" className="panel-toggle" aria-label={tutorVisible ? 'Hide AI Tutor' : 'Show AI Tutor'} aria-pressed={tutorVisible} onClick={() => setTutorVisible(value => !value)}>{tutorVisible ? '◧ Hide Tutor' : '◨ Show Tutor'}</button></div></header>
      {error && <div className="error" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}
      {!scan && page !== 'Settings' ? <div className="empty"><div className="empty-icon">⌘</div><h1>Learn the code you build.</h1><p>Import a local repository to explore its structure and start studying.</p><button className="primary" onClick={importRepository}>Import a repository</button></div> :
      page === 'Settings' ? <section className="content"><p className="eyebrow">PREFERENCES</p><h1>Settings</h1><p className="muted">Customize your workspace.</p><div className="card setting-row"><div><strong>Appearance</strong><p className="muted">Choose your preferred color theme.</p></div><select value={theme} onChange={e => setTheme(e.target.value as 'dark' | 'light')}><option value="dark">Dark</option><option value="light">Light</option></select></div><div className="card"><strong>AI provider</strong><p className="muted">OpenAI Responses API. Set OPENAI_API_KEY in the environment before launching StudyRepo. Optional: OPENAI_MODEL (default gpt-6-luna). Your key is only read by the Electron main process.</p></div></section> :
      scan && page === 'Overview' ? <section className="content"><p className="eyebrow">REPOSITORY OVERVIEW</p><h1>{scan.repository.name}</h1><p className="muted path">{scan.repository.path}</p><div className="stats"><div className="card"><span>FILES</span><strong>{scan.fileCount}</strong><small>in repository</small></div><div className="card"><span>LANGUAGES</span><strong>{Object.keys(scan.languages).length}</strong><small>detected by extension</small></div></div>
        {scan.skipped > 0 && <p className="notice">{scan.skipped} inaccessible folders could not be scanned.</p>}
        <div className="card modules"><div><p className="eyebrow">START HERE</p><h2>Practice with AI</h2><p className="muted">Solve a sample C++ exercise with the editor and ask your AI Tutor for hints or explanations.</p></div><button className="primary" onClick={() => setPage('Practice')}>Open Practice →</button></div>
        <div className="card modules"><div><h2>Browse source code</h2><p className="muted">Find source files and symbols in the imported repository. {indexSummary?.indexedAt ? `${indexSummary.symbols} symbols indexed.` : 'Source index not built yet.'}</p></div><button onClick={() => setPage('Explorer')}>Open Explorer →</button></div>
      </section> :
      scan && page === 'Explorer' ? <div className="workspace-with-tutor"><div className="explorer"><div className="file-panel"><div className="panel-title">EXPLORER <span>{scan.fileCount} files</span></div><div className="repo-heading">▾ {scan.repository.name}</div><FileTree nodes={scan.tree} open={file => { void openFile(file); }}/><SymbolExplorer repository={scan.repository.path} summary={indexSummary} onIndexed={setIndexSummary} onOpen={(file, line) => { void openFile(file, line); }}/></div><div className="editor-area"><div className="tabs">{tabs.map(tab => <div className={`tab ${active === tab.path ? 'active-tab' : ''}`} key={tab.path}><button title={tab.path} onClick={() => { setActive(tab.path); setSelection({ startLine: 1, endLine: 1, code: '' }); }}>{tab.path.split(/[\\\\/]/).pop()}</button><button aria-label={`Close ${tab.path}`} onClick={() => { const rest = tabs.filter(t => t.path !== tab.path); setTabs(rest); if (active === tab.path) setActive(rest.at(-1)?.path ?? ''); }}>×</button></div>)}</div>{current ? <Editor path={current.path} value={current.content} theme={theme === 'dark' ? 'vs-dark' : 'light'} options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, automaticLayout: true }} onMount={editor => { explorerEditor.current = editor; if (jump && jump.file === active) { editor.revealLineInCenter(jump.line); editor.setPosition({ lineNumber: jump.line, column: 1 }); } editor.onDidChangeCursorSelection(event => { const range = event.selection; setSelection({ startLine: range.startLineNumber, endLine: range.endLineNumber, code: editor.getModel()?.getValueInRange(range) ?? '' }); }); }} /> : <div className="editor-empty">Select a file to explore</div>}</div></div><TutorPanel hidden={!tutorVisible} key={scan.repository.path + ':explorer'} repository={scan.repository.path} context="Explorer" sourceFile={current?.path} code={selection.code || current?.content.slice(0, 12000) || ''}/></div> :
      scan && page === 'Practice' ? <div className="workspace-with-tutor"><PracticeWorkspace code={practiceCode} onCodeChange={setPracticeCode} diagnostics={practiceDiagnostics} onDiagnostics={setPracticeDiagnostics}/><TutorPanel hidden={!tutorVisible} key={scan.repository.path + ":practice"} repository={scan.repository.path} context="Practice" code={practiceCode} diagnostics={practiceDiagnostics}/></div> :
      null}

    </main>
  </div>;
}
