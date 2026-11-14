import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { BookOpen, ChartNoAxesColumnIncreasing, CheckCircle2, ChevronDown, CircleAlert, Code2, Copy, FileCode2, FileText, Info, Layers3, Play, Send, Sparkles, TerminalSquare } from 'lucide-react';

type NavItem = 'Practice' | 'Learn' | 'Progress' | 'Library';
type ChatMessage = { role: 'tutor' | 'student'; text: string };
const starterCode = `TArray<FIntPoint> FindMissing(\n    TArray<FIntPoint> Required,\n    TArray<FIntPoint> Loaded)\n{\n    TArray<FIntPoint> Missing;\n    for (i = 0; i < Required.Num(); i++)\n    {\n        // Your code\n    }\n    return Missing;\n}`;

const containsDeclaration = (code: string) => /for\s*\(\s*(?:int|int32|auto)\s+i\s*=/.test(code) || /\b(?:int|int32)\s+i\s*=/.test(code);
const includesContains = (code: string) => /Loaded\.Contains\s*\(/.test(code);
const includesAdd = (code: string) => /Missing\.Add\s*\(/.test(code);

function makeFeedback(code: string) {
  const errors: string[] = [];
  if (!containsDeclaration(code)) errors.push("Line 6: 'i' was not declared in this scope (demo check)");
  if (!includesContains(code)) errors.push('Exercise incomplete: check whether Loaded contains each required chunk.');
  if (!includesAdd(code)) errors.push('Exercise incomplete: add missing chunks to the Missing array.');
  return errors;
}

export default function App() {
  const [nav, setNav] = useState<NavItem>('Practice');
  const [code, setCode] = useState(starterCode);
  const [ran, setRan] = useState(false);
  const [consoleExpanded, setConsoleExpanded] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([{role:'tutor',text:"You've set up your loop correctly, but `i` isn't declared. Remember how you declared loop variables in Exercise 3?"}]);
  const [activeTab, setActiveTab] = useState<'Tests'|'Hints'|'Concepts'>('Tests');
  const errors = makeFeedback(code);
  const startingError = !containsDeclaration(code);

  function send(text: string) {
    const q = text.trim(); if (!q) return;
    const answer = /hint/i.test(q) ? 'Try declaring the loop index: `int32 i = 0`. Then check `!Loaded.Contains(Required[i])` and add missing entries.' : /concept/i.test(q) ? '`TArray` is Unreal Engine’s dynamic array. `Contains()` checks whether a value is in the array; `Add()` appends one.' : 'This is a static demo tutor. The next milestone is connecting an AI provider and sending the selected code plus your question.';
    setMessages(old => [...old,{role:'student',text:q},{role:'tutor',text:answer}]); setInput('');
  }

  function runDemo() { setRan(true); setConsoleExpanded(true); }

  return <div className="app">
    <header className="topbar"><div className="brand"><span className="brand-mark"><Layers3 size={21}/></span><strong>Study<span>Repo</span></strong></div><div className="top-divider"/>
      <nav aria-label="Main navigation">
        {([['Practice',Code2],['Learn',BookOpen],['Progress',ChartNoAxesColumnIncreasing],['Library',Layers3]] as const).map(([name,Icon])=><button key={name} className={`nav-item ${nav===name?'active':''}`} onClick={()=>setNav(name)}><Icon size={19}/>{name}</button>)}
      </nav><div className="top-status">Local prototype</div>
    </header>
    {nav !== 'Practice' ? <main className="placeholder"><span className="eyebrow">StudyRepo</span><h1>{nav}</h1><p>This section is reserved for the full desktop app. Open <strong>Practice</strong> to try the working exercise interface.</p><button className="primary" onClick={()=>setNav('Practice')}>Go to Practice</button></main> :
    <main className="workspace">
      <section className="panel problem"><div className="panel-header"><FileText size={19}/><strong>Problem</strong></div><div className="problem-body"><span className="eyebrow">C++ / UNREAL ENGINE · EXERCISE 4</span><h1>Find Missing Chunks</h1><p>Compare the required and loaded terrain chunks.</p><p>Use <code>TArray</code> and <code>Contains()</code> to build the result.</p>
        <div className="example"><strong>Example</strong><div>Required: A, B, C</div><div>Loaded: A</div><div className="success">Missing: B, C</div></div>
        <div className="tabs" aria-label="Exercise resources">{(['Tests','Hints','Concepts'] as const).map(t=><button key={t} className={activeTab===t?'selected':''} onClick={()=>setActiveTab(t)}>{t}</button>)}</div>
        <div className="tab-content">{activeTab==='Tests' ? 'Expected output: required chunks that are not already loaded.' : activeTab==='Hints' ? 'Loop through Required, check Loaded.Contains(), and add missing elements.' : 'TArray is Unreal Engine’s dynamically sized array. Contains() searches for a value.'}</div>
      </div></section>
      <section className="middle"><div className="editor-panel panel"><div className="panel-header editor-header"><div className="title-with-icon"><FileCode2 size={19}/><strong>main.cpp</strong><span className="file-dot"/></div><button className="icon-button" title="Copy code" onClick={()=>navigator.clipboard?.writeText(code)}><Copy size={17}/></button></div><div className="code-area"><Editor language="cpp" value={code} onChange={value=>{setCode(value??'');setRan(false)}} theme="vs-dark" options={{fontSize:14,fontFamily:"'Cascadia Code', Consolas, monospace",minimap:{enabled:false},automaticLayout:true,scrollBeyondLastLine:false,wordWrap:'on',padding:{top:20},renderLineHighlight:'all',lineNumbersMinChars:2,overviewRulerBorder:false}}/></div></div>
        <div className="panel compiler"><div className="panel-header"><TerminalSquare size={19}/><strong>Compiler / Tests</strong><div className="spacer"/><button className="icon-button" aria-label="Toggle test output" onClick={()=>setConsoleExpanded(x=>!x)}><ChevronDown size={18} className={consoleExpanded?'':'rotate'}/></button></div>{consoleExpanded&&<div className="console-content">{ran ? errors.length ? errors.map((e,i)=><div className="error-line" key={i}><CircleAlert size={18}/>{e}</div>) : <div className="success-line"><CheckCircle2 size={18}/>Demo checks passed. This is not a real C++ compilation.</div> : startingError ? <div className="error-line"><CircleAlert size={18}/>Line 6: 'i' was not declared (demo check)</div> : <div className="muted-line">Run the demo checks to inspect your answer.</div>}<div className="console-actions"><button className="primary" onClick={runDemo}><Play size={14} fill="currentColor"/>Run demo checks</button><small>Pattern checks only — no C++ compiler connected</small></div></div>}</div>
      </section>
      <section className="panel tutor"><div className="panel-header"><Sparkles size={20}/><strong>AI Tutor</strong><span className="demo-label">DEMO</span></div><div className="tutor-inner"><div className="conversation" aria-live="polite">{messages.map((m,i)=><div className={`message ${m.role}`} key={i}>{m.role==='tutor'&&<span className="robot">✦</span>}<span>{m.text}</span></div>)}</div><form className="chat-input" onSubmit={e=>{e.preventDefault();send(input)}}><input aria-label="Ask tutor" value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask about this error..."/><button aria-label="Send message" type="submit"><Send size={18}/></button></form><div className="suggestions"><button onClick={()=>send('Give hint')}>Give hint</button><span>·</span><button onClick={()=>send('Explain concept')}>Explain concept</button></div><p className="tutor-note">Demo responses only. AI integration comes later.</p></div></section>
    </main>}
    <footer className="footer"><Info size={17}/>Desktop layout prototype · Resizable panels later <span className="footer-badge">Prototype</span></footer>
  </div>;
}
