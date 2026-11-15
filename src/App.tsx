import { useEffect, useRef, useState } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker';
import CssWorker from 'monaco-editor/language/css/css.worker.js?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker.js?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';
import type { ConversationStore, LearningArchive, IndexSummary, Repository, ScanResult } from './shared/types';
import { FileTree } from './components/FileTree';
import { SymbolExplorer } from './components/SymbolExplorer';
import { LearningWorkspace } from './components/LearningWorkspace';
import { TutorPanel } from './components/TutorPanel';
import { addChallenge, addChallengeWithTutorExplanation, changeChallengeCode, recordEvaluation, selectChallenge, setChatMessages, appendTutorReplyWithActivities, setQuizAnswer } from './study/history';
import { emptyConversations, newConversation, selectConversation, changeConversationArchive, updateConversationById, titleConversationIfNew, appendConversationMessage, nameConversationById, renameConversation, deleteConversation } from './study/conversations';

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
  const learningEpoch = useRef(0);
  const conversationRef = useRef<string | null>(null);
  const pendingRef = useRef(new Set<string>());
  const [pendingConversations, setPendingConversations] = useState<string[]>([]);
  const [page, setPage] = useState<Page>('Overview');
  const [tabs, setTabs] = useState<OpenFile[]>([]);
  const [active, setActive] = useState('');
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => localStorage.getItem('theme') === 'light' ? 'light' : 'dark');
  const [tutorVisible, setTutorVisible] = useState(true);
  const [tutorExpanded, setTutorExpanded] = useState(false);
  const [focusChatChallengeId, setFocusChatChallengeId] = useState<string | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [conversationStore, setConversationStore] = useState<ConversationStore>(emptyConversations);
  const activeConversation = conversationStore.conversations.find(item => item.id === conversationStore.activeId);
  conversationRef.current = conversationStore.activeId;
  const archive: LearningArchive = activeConversation?.archive ?? { entries: [], activeIndex: -1, messages: [] };
  const setArchive = (update: LearningArchive | ((archive: LearningArchive) => LearningArchive)) => {
    setConversationStore(old => changeConversationArchive(old, current =>
      typeof update === 'function' ? update(current) : update));
  };
  const [archiveReady, setArchiveReady] = useState(false);
  const [awaitingGoal, setAwaitingGoal] = useState(true);
  const [learningBusy, setLearningBusy] = useState(false);
  const [learningError, setLearningError] = useState('');
  const [selection, setSelection] = useState({ startLine: 1, endLine: 1, code: '' });

  useEffect(() => {
    window.studyRepo.listRepositories().then(setRepositories).catch(e => setError(String(e)));
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme); }, [theme]);

  async function loadRepository(repo: Repository) {
    const epoch = ++learningEpoch.current;
    const previousRepository = scan?.repository.path;
    const previousStore = conversationStore;
    const shouldFlush = archiveReady && !!previousRepository;
    setArchiveReady(false);
    try {
      setError('');
      if (shouldFlush) await window.studyRepo.saveConversations(previousRepository!, previousStore);
      const [nextScan, nextIndex, saved] = await Promise.all([window.studyRepo.scanRepository(repo.path), window.studyRepo.getIndexSummary(repo.path), window.studyRepo.loadConversations(repo.path)]);
      if (epoch !== learningEpoch.current) return;
      const readyStore = saved.activeId ? saved : newConversation(saved);
      setLearningBusy(false); setConversationStore(readyStore); setArchiveReady(true); setAwaitingGoal(!(readyStore.conversations.find(item => item.id === readyStore.activeId)?.archive.entries.length)); setScan(nextScan); setIndexSummary(nextIndex); setJump(null); setTabs([]); setActive(''); setPage('Practice'); setSelectedQuizId(null); setLearningError('');
    } catch (e) { if (epoch === learningEpoch.current) setError(String(e)); }
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
        learningEpoch.current++;
        setLearningBusy(false); setScan(null); setTabs([]); setActive(''); setIndexSummary(null); setJump(null); setConversationStore(emptyConversations()); setArchiveReady(false); setAwaitingGoal(true);
        setPage('Overview');
      }
    } catch (e) { setError(String(e)); }
  }
  const activeEntry = archive.entries[archive.activeIndex];
  const learning = awaitingGoal ? null : activeEntry?.session ?? null;
  const practiceCode = awaitingGoal ? '' : activeEntry?.code ?? '';
  const evaluation = activeEntry?.attempts.at(-1)?.evaluation ?? null;
  const evaluationCode = activeEntry?.attempts.at(-1)?.code ?? null;

  useEffect(() => {
    if (!archiveReady || !scan) return;
    const root = scan.repository.path;
    const timer = setTimeout(() => {
      window.studyRepo.saveConversations(root, conversationStore).catch(e => setLearningError(String(e)));
    }, 300);
    return () => clearTimeout(timer);
  }, [conversationStore, archiveReady, scan?.repository.path]);

  async function startLearning(goal: string): Promise<string> {
    if (!scan || !archiveReady) throw new Error('Import a repository first.');
    const epoch = learningEpoch.current;
    const conversationId = conversationStore.activeId;
    if (!conversationId) throw new Error('Create a conversation first.');
    setLearningBusy(true); setLearningError('');
    try {
      const session = await window.studyRepo.generateLesson({ repository: scan.repository.path, goal, mode: 'start' });
      if (epoch !== learningEpoch.current) throw new Error('Repository changed; learning request cancelled.');
      setConversationStore(old => titleConversationIfNew(
        updateConversationById(old, conversationId, current => addChallenge(current, session)), goal));
      setAwaitingGoal(false);
      return session.lesson.introduction + '\n\n' + session.lesson.explanation;
    } catch (e) { if (epoch === learningEpoch.current) setLearningError(String(e)); throw e; }
    finally { if (epoch === learningEpoch.current) setLearningBusy(false); }
  }
  async function evaluateCode() {
    if (!scan || !activeEntry || !archiveReady) return;
    const epoch = learningEpoch.current;
    const conversationId = conversationStore.activeId;
    const id = activeEntry.id;
    const submittedCode = activeEntry.code;
    setLearningBusy(true); setLearningError('');
    try {
      const result = await window.studyRepo.evaluateSolution({ repository: scan.repository.path, lesson: activeEntry.session.lesson, code: submittedCode });
      if (epoch === learningEpoch.current) {
        setConversationStore(old => conversationId
          ? updateConversationById(old, conversationId, previous => previous.entries[previous.activeIndex]?.id === id
            ? recordEvaluation(previous, result, submittedCode) : previous)
          : old);
      }
    } catch (e) { if (epoch === learningEpoch.current) setLearningError(String(e)); }
    finally { if (epoch === learningEpoch.current) setLearningBusy(false); }
  }
  async function advanceLearning(mode: 'next' | 'similar' | 'extend' | 'focused', skip = false, focus?: string): Promise<string> {
    if (!scan || !activeEntry || !archiveReady) throw new Error('Import a repository and start learning first.');
    if (archive.activeIndex !== archive.entries.length - 1 && !focus) throw new Error('Open your latest challenge before advancing.');
    const epoch = learningEpoch.current;
    const conversationId = conversationStore.activeId;
    const currentEntry = activeEntry;
    const currentSession = currentEntry.session;
    const index = mode === 'next' ? currentSession.topicIndex + 1 : currentSession.topicIndex;
    // A plan is only a short batch. After its final topic, generate a new plan.
    const extend = mode === 'extend' || (mode === 'next' && index >= currentSession.topics.length);
    const focused = mode === 'focused';
    setLearningBusy(true); setLearningError('');
    try {
      const session = await window.studyRepo.generateLesson({
        repository: scan.repository.path, goal: currentSession.goal,
        mode: extend ? 'extend' : mode,
        topics: currentSession.topics,
        topicIndex: extend || focused ? currentSession.topicIndex : index,
        previousChallenge: currentSession.lesson.challenge,
        focus: focus?.slice(0, 1500)
      });
      if (epoch !== learningEpoch.current) throw new Error('Repository changed; new challenge request cancelled.');
      setConversationStore(old => conversationId ? updateConversationById(old, conversationId, previous => {
        if (previous.entries[previous.activeIndex]?.id !== currentEntry.id) return previous;
        return addChallengeWithTutorExplanation(previous, session, skip);
      }) : old);
      return extend
        ? 'I created a new learning set with ' + session.topics.length + ' topics. The first challenge, "' + session.lesson.challenge.title + '", is now in your code workspace. The rest will be generated as you continue.'
        : 'Created "' + session.lesson.challenge.title + '" in your code workspace and saved it in this conversation\'s challenge history.';
    } catch (e) {
      if (epoch === learningEpoch.current) setLearningError(String(e));
      throw e;
    } finally { if (epoch === learningEpoch.current) setLearningBusy(false); }
  }
  async function generateChallengesFromChat(request: string, scope: 'single' | 'set'): Promise<string> {
    return advanceLearning(scope === 'set' ? 'extend' : 'focused', false, request);
  }
  async function sendConversationMessage(question: string) {
    const q = question.trim();
    const repository = scan?.repository.path;
    const conversationId = conversationStore.activeId;
    if (!q || !repository || !conversationId || !archiveReady) return;
    const pendingKey = repository + ':' + conversationId;
    if (pendingRef.current.has(pendingKey)) return;
    pendingRef.current.add(pendingKey);
    setPendingConversations(current => [...current, pendingKey]);
    const previousMessages = archive.messages;
    const previousEntry = archive.entries[archive.activeIndex];
    const requestContext = page === 'Explorer' ? 'Explorer' : 'Practice';
    const requestCode = requestContext === 'Explorer'
      ? (selection.code || current?.content.slice(0, 12000) || '')
      : tutorLearningCode;
    const requestFile = requestContext === 'Explorer' ? current?.path : undefined;
    setConversationStore(old => nameConversationById(appendConversationMessage(old, conversationId, { role: 'user', content: q }), conversationId, q));
    let generatedChallenge = false;
    try {
      let answer: string;
      if (requestContext === 'Practice') {
        const action = await window.studyRepo.askTutorWithActions({
          repository, context: 'Practice', code: requestCode.slice(0, 12000),
          question: q, history: previousMessages.slice(-10)
        });
        if (action.type === 'message') answer = action.text;
        else {
          const currentSession = previousEntry?.session;
          const mode = currentSession
            ? (action.scope === 'set' ? 'extend' : 'focused') : 'start';
          const lesson = await window.studyRepo.generateLesson({
            repository,
            goal: currentSession?.goal ?? action.focus,
            mode,
            topics: currentSession?.topics,
            topicIndex: currentSession?.topicIndex,
            previousChallenge: currentSession?.lesson.challenge,
            focus: action.focus
          });
          generatedChallenge = true;
          setConversationStore(old => updateConversationById(old, conversationId, a => addChallenge(a, lesson)));
          if (conversationRef.current === conversationId) {
            setAwaitingGoal(false);
            setSelectedQuizId(null);
          }
          answer = [lesson.lesson.introduction, lesson.lesson.explanation,
            '### Coding challenge: ' + lesson.lesson.challenge.title,
            lesson.lesson.challenge.description].join('\n\n');
        }
      } else {
        answer = await window.studyRepo.askTutor({
          repository, context: 'Explorer', sourceFile: requestFile,
          code: requestCode.slice(0, 12000), question: q, history: previousMessages.slice(-10)
        });
      }
      setConversationStore(old => updateConversationById(old, conversationId, a =>
        appendTutorReplyWithActivities(a, answer, generatedChallenge ? a.entries.at(-1)?.id : undefined)));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setConversationStore(old => appendConversationMessage(old, conversationId, { role: 'assistant', content: 'Unable to complete the request: ' + message }));
    } finally {
      pendingRef.current.delete(pendingKey);
      setPendingConversations(current => current.filter(key => key !== pendingKey));
    }
  }
  function createChat() {
    setLearningBusy(false);
    setConversationStore(old => newConversation(old));
    setAwaitingGoal(true);
    setLearningError('');
    setFocusChatChallengeId(null);
    setSelectedQuizId(null);
    setPage('Practice');
  }
  function openChat(id: string) {
    if (id === conversationStore.activeId) { setPage('Practice'); return; }
    setLearningBusy(false);
    setConversationStore(old => selectConversation(old, id));
    setSelectedQuizId(null);
    const next = conversationStore.conversations.find(item => item.id === id);
    setAwaitingGoal(!next?.archive.entries.length);
    setLearningError('');
    setPage('Practice');
  }
  function removeChat(id: string) {
    const found = conversationStore.conversations.find(item => item.id === id);
    if (!found || !window.confirm('Delete conversation "' + found.title + '" and its challenges?')) return;
    learningEpoch.current++;
    setLearningBusy(false);
    const deleted = deleteConversation(conversationStore, id);
    const next = deleted.activeId ? deleted : newConversation(deleted);
    setConversationStore(next);
    setSelectedQuizId(null);
    setAwaitingGoal(!(next.conversations.find(item => item.id === next.activeId)?.archive.entries.length));
    setLearningError('');
  }
  function renameChat(id: string) {
    const found = conversationStore.conversations.find(item => item.id === id);
    if (!found) return;
    const name = window.prompt('Conversation name', found.title);
    if (name?.trim()) setConversationStore(old => renameConversation(old, id, name));
  }
  function navigateHistory(index: number) {
    if (learningBusy) return;
    setSelectedQuizId(null);
    setArchive(old => selectChallenge(old, index));
    setAwaitingGoal(false);
    setLearningError('');
  }
  function showChallengeInTutor() {
    setTutorVisible(true);
    if (selectedQuizId) { setTutorExpanded(true); return; }
    if (!activeEntry) { setTutorExpanded(true); return; }
    setFocusChatChallengeId(activeEntry.id);
  }
  function showChallengeFromTutor(index: number) {
    if (index < 0 || index >= archive.entries.length) return;
    navigateHistory(index);
    setFocusChatChallengeId(null);
    setPage('Practice');
    document.querySelector('.practice-editor')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  const tutorLearningCode = learning
    ? ('Current topic: ' + learning.topics[learning.topicIndex]?.title + '\\nChallenge: ' + learning.lesson.challenge.description +
       '\\nCriteria: ' + learning.lesson.challenge.criteria.join('; ') + '\\nRelevant source excerpts:\\n' +
       learning.sourceContext + '\\nStudent scratchpad:\\n' + practiceCode).slice(0, 12000)
    : '';
  const current = tabs.find(tab => tab.path === active);

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">S</span><div>StudyRepo<small>LEARN YOUR CODE</small></div></div>
      <button className="import-button" onClick={importRepository}>+ Import repository</button>
      <div className="sidebar-label">WORKSPACE</div>
      <nav>{pages.map((item, index) => <button key={item} className={page === item ? 'nav-active' : ''} onClick={() => setPage(item)}><span className="nav-icon">{['◫', '▤', '⌘', '⚙'][index]}</span>{item}</button>)}</nav>
      {scan && <section className="conversation-sidebar" aria-label="Recent conversations">
        <div className="conversation-heading"><span>RECENT CONVERSATIONS</span><button onClick={createChat}>+ New chat</button></div>
        <div className="conversation-list">{[...conversationStore.conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(item =>
          <div className={item.id === conversationStore.activeId ? 'conversation-item active-conversation' : 'conversation-item'} key={item.id}>
            <button className="conversation-open" title={item.title} onClick={() => openChat(item.id)}>{item.title}</button>
            <button className="conversation-action" title="Rename conversation" aria-label={'Rename '+item.title} onClick={() => renameChat(item.id)}>✎</button>
            <button className="conversation-action" title="Delete conversation" aria-label={'Delete '+item.title} onClick={() => removeChat(item.id)}>×</button>
          </div>)}
        </div>
      </section>}
      <div className="sidebar-label">RECENT REPOSITORIES</div>
      <div className="recent">{repositories.length ? repositories.map(repo => <div className={`recent-item ${scan?.repository.path === repo.path ? 'selected-repo' : ''}`} key={repo.path}><button title={repo.path} className="recent-open" onClick={() => { void loadRepository(repo); }}>{repo.name}</button><button className="recent-remove" aria-label={`Remove ${repo.name} from StudyRepo`} title="Remove from StudyRepo (files stay on disk)" onClick={() => { void removeImportedRepository(repo); }}>×</button></div>) : <p>No repositories yet</p>}</div>
      <div className="sidebar-footer">Local-first · Private by design</div>
    </aside>
    <main className={tutorExpanded && tutorVisible && scan && (page === 'Practice' || page === 'Explorer') ? 'tutor-reading-mode' : undefined}>
      <header><div><span className="muted">WORKSPACE</span><span className="header-separator">/</span>{scan?.repository.name ?? 'No repository'}</div><div className="header-actions"><span className="header-page">{page}</span><button type="button" className="panel-toggle" aria-label={tutorVisible ? 'Hide AI Tutor' : 'Show AI Tutor'} aria-pressed={tutorVisible} onClick={() => setTutorVisible(value => !value)}>{tutorVisible ? '◧ Hide Tutor' : '◨ Show Tutor'}</button></div></header>
      {error && <div className="error" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}
      {!scan && page !== 'Settings' ? <div className="empty"><div className="empty-icon">⌘</div><h1>Learn the code you build.</h1><p>Import a local repository to explore its structure and start studying.</p><button className="primary" onClick={importRepository}>Import a repository</button></div> :
      page === 'Settings' ? <section className="content"><p className="eyebrow">PREFERENCES</p><h1>Settings</h1><p className="muted">Customize your workspace.</p><div className="card setting-row"><div><strong>Appearance</strong><p className="muted">Choose your preferred color theme.</p></div><select value={theme} onChange={e => setTheme(e.target.value as 'dark' | 'light')}><option value="dark">Dark</option><option value="light">Light</option></select></div><div className="card"><strong>AI provider</strong><p className="muted">OpenAI Responses API. Set OPENAI_API_KEY in the environment before launching StudyRepo. Optional: OPENAI_MODEL (default gpt-6-luna). Your key is only read by the Electron main process.</p></div></section> :
      scan && page === 'Overview' ? <section className="content"><p className="eyebrow">REPOSITORY OVERVIEW</p><h1>{scan.repository.name}</h1><p className="muted path">{scan.repository.path}</p><div className="stats"><div className="card"><span>FILES</span><strong>{scan.fileCount}</strong><small>in repository</small></div><div className="card"><span>LANGUAGES</span><strong>{Object.keys(scan.languages).length}</strong><small>detected by extension</small></div></div>
        {scan.skipped > 0 && <p className="notice">{scan.skipped} inaccessible folders could not be scanned.</p>}
        <div className="card modules"><div><p className="eyebrow">START HERE</p><h2>Practice with AI</h2><p className="muted">Tell the AI Tutor what you want to study. It will explain repository code and generate a small coding challenge.</p></div><button className="primary" onClick={() => setPage('Practice')}>Open Practice →</button></div>
        <div className="card modules"><div><h2>Browse source code</h2><p className="muted">Find source files and symbols in the imported repository. {indexSummary?.indexedAt ? `${indexSummary.symbols} symbols indexed.` : 'Source index not built yet.'}</p></div><button onClick={() => setPage('Explorer')}>Open Explorer →</button></div>
      </section> :
      scan && page === 'Explorer' ? <div className="workspace-with-tutor"><div className="explorer"><div className="file-panel"><div className="panel-title">EXPLORER <span>{scan.fileCount} files</span></div><div className="repo-heading">▾ {scan.repository.name}</div><FileTree nodes={scan.tree} open={file => { void openFile(file); }}/><SymbolExplorer repository={scan.repository.path} summary={indexSummary} onIndexed={setIndexSummary} onOpen={(file, line) => { void openFile(file, line); }}/></div><div className="editor-area"><div className="tabs">{tabs.map(tab => <div className={`tab ${active === tab.path ? 'active-tab' : ''}`} key={tab.path}><button title={tab.path} onClick={() => { setActive(tab.path); setSelection({ startLine: 1, endLine: 1, code: '' }); }}>{tab.path.split(/[\\\\/]/).pop()}</button><button aria-label={`Close ${tab.path}`} onClick={() => { const rest = tabs.filter(t => t.path !== tab.path); setTabs(rest); if (active === tab.path) setActive(rest.at(-1)?.path ?? ''); }}>×</button></div>)}</div>{current ? <Editor path={current.path} value={current.content} theme={theme === 'dark' ? 'vs-dark' : 'light'} options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, automaticLayout: true }} onMount={editor => { explorerEditor.current = editor; if (jump && jump.file === active) { editor.revealLineInCenter(jump.line); editor.setPosition({ lineNumber: jump.line, column: 1 }); } editor.onDidChangeCursorSelection(event => { const range = event.selection; setSelection({ startLine: range.startLineNumber, endLine: range.endLineNumber, code: editor.getModel()?.getValueInRange(range) ?? '' }); }); }} /> : <div className="editor-empty">Select a file to explore</div>}</div></div></div> :
      scan && page === 'Practice' ? <div className="workspace-with-tutor"><LearningWorkspace session={learning} challengeId={activeEntry?.id ?? ''} code={practiceCode} onCodeChange={value => { const id = activeConversation?.id; if (id) setConversationStore(old => updateConversationById(old, id, a => changeChallengeCode(a, value))); }} evaluation={evaluationCode === practiceCode ? evaluation : null} attempts={activeEntry?.attempts ?? []} entries={archive.entries} activeIndex={archive.activeIndex} busy={learningBusy || !archiveReady} error={learningError} onEvaluate={() => { void evaluateCode(); }} onRestart={createChat} onAdvance={mode => { void advanceLearning(mode).catch(() => {}); }} onSkip={() => { void advanceLearning('next', true).catch(() => {}); }} onNavigate={navigateHistory} onRestoreAttempt={index => { const attempt = activeEntry?.attempts[index]; if (attempt && activeConversation) setConversationStore(old => updateConversationById(old, activeConversation.id, a => changeChallengeCode(a, attempt.code))); }} onShowTutor={showChallengeInTutor} quizActivities={archive.activities ?? []} selectedQuizId={selectedQuizId} onOpenQuiz={id => { setSelectedQuizId(id); setTutorVisible(true); }} onQuizChange={(id, selected, checked) => setArchive(old => setQuizAnswer(old, id, selected, checked))}/></div> :
      null}
      {scan && <TutorPanel
        key={scan.repository.path + ':tutor:' + (conversationStore.activeId ?? 'none')}
        hidden={!tutorVisible || (page !== 'Practice' && page !== 'Explorer')}
        expanded={tutorExpanded}
        onToggleExpanded={() => setTutorExpanded(value => !value)}
        repository={scan.repository.path}
        context={page === 'Explorer' ? 'Explorer' : 'Practice'}
        sourceFile={page === 'Explorer' ? current?.path : undefined}
        code={page === 'Explorer' ? (selection.code || current?.content.slice(0, 12000) || '') : tutorLearningCode}
        learningStarted={!!learning}
        onStartLearning={page === 'Practice' ? startLearning : undefined}
        onGenerateChallenges={page === 'Practice' ? generateChallengesFromChat : undefined}
        messages={archive.messages}
        quizActivities={archive.activities ?? []}
        onQuizChange={(id, selected, checked) => setArchive(old => setQuizAnswer(old, id, selected, checked))}
        activeChallenge={page === 'Practice' ? activeEntry : undefined}
        challengeEntries={archive.entries}
        focusChallengeId={focusChatChallengeId}
        onOpenChallenge={showChallengeFromTutor}
        onOpenSource={(file, line) => { void openFile(file, line); }}
        pending={pendingConversations.includes(scan.repository.path + ':' + (conversationStore.activeId ?? ''))}
        onSendMessage={question => { void sendConversationMessage(question); }}
        onMessagesChange={messages => {
          const id = conversationStore.activeId;
          if (id) setConversationStore(old => updateConversationById(old, id, a => setChatMessages(a, messages)));
        }}
      />}
    </main>
  </div>;
}
