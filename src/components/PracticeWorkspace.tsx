import { useState } from 'react';
import Editor from '@monaco-editor/react';

export const initialPracticeCode = `TArray<FIntPoint> FindMissing(
    TArray<FIntPoint> Required,
    TArray<FIntPoint> Loaded)
{
    TArray<FIntPoint> Missing;
    for (i = 0; i < Required.Num(); i++)
    {
        // Your code
    }
    return Missing;
}`;

export function checkPractice(code: string): string[] {
  const issues: string[] = [];
  if (!/for\s*\(\s*(?:int|int32|auto)\s+i\s*=/.test(code) && !/\b(?:int|int32)\s+i\s*=/.test(code)) issues.push("Loop variable 'i' is not declared (demo pattern check).");
  if (!/Loaded\.Contains\s*\(/.test(code)) issues.push('Check whether Loaded contains the required chunk.');
  if (!/Missing\.Add\s*\(/.test(code)) issues.push('Add missing chunks to the Missing array.');
  return issues;
}

interface Props {
  code: string;
  onCodeChange: (value: string) => void;
  diagnostics: string[];
  onDiagnostics: (errors: string[]) => void;
}

export function PracticeWorkspace({ code, onCodeChange, diagnostics, onDiagnostics }: Props) {
  const [resource, setResource] = useState<'Tests'|'Hints'|'Concepts'>('Tests');
  const [ran, setRan] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const effectiveCode = code || initialPracticeCode;
  const resourceText = {
    Tests: 'Expected: chunks in Required but not in Loaded.',
    Hints: 'Iterate over Required, use !Loaded.Contains(Required[i]), then Missing.Add().',
    Concepts: 'TArray is an Unreal Engine dynamic array; Contains tests membership and Add appends values.'
  };
  return <section className="practice-workspace" aria-label="Practice workspace">
    <div className="practice-problem">
      <p className="eyebrow">C++ / UNREAL ENGINE · SAMPLE EXERCISE</p>
      <h2>Find Missing Chunks</h2>
      <p>Compare required and loaded terrain chunks using <code>TArray</code> and <code>Contains()</code>.</p>
      <div className="practice-resources" aria-label="Exercise resources">
        {(['Tests','Hints','Concepts'] as const).map(item => <button key={item} className={resource === item ? 'active' : ''} onClick={() => setResource(item)}>{item}</button>)}
      </div>
      <p className="muted">{resourceText[resource]}</p>
    </div>
    <div className="practice-editor">
      <div className="practice-editor-heading">main.cpp · Exercise scratchpad</div>
      <div className="practice-editor-body"><Editor language="cpp" value={effectiveCode} theme="vs-dark" onChange={value => { onCodeChange(value ?? ''); onDiagnostics([]); setRan(false); }} options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true, scrollBeyondLastLine: false, wordWrap: 'on' }}/></div>
    </div>
    <div className="practice-tests">
      <div className="practice-tests-header"><h2>Compiler / Tests <span className="badge">DEMO ONLY</span></h2><div><button className="panel-toggle" aria-label="Toggle test output" onClick={() => setExpanded(value => !value)}>{expanded ? 'Hide' : 'Show'}</button> <button className="primary" onClick={() => { onDiagnostics(checkPractice(effectiveCode)); setRan(true); setExpanded(true); }}>▶ Run demo checks</button></div></div>
      {expanded && <>{ran ? diagnostics.length ? <pre role="alert">{diagnostics.join('\n')}</pre> : <p className="pass" role="status">Demo checks passed. Code has NOT been compiled.</p> : <p className="muted">Run the checks to see pattern-based feedback.</p>}<small>No real C++ compiler or Unreal Engine runner is connected.</small></>}
    </div>
  </section>;
}
