import { useEffect, useState } from 'react';
import type { CodeSymbol, IndexSummary } from '../shared/types';

interface Props {
  repository: string;
  summary: IndexSummary | null;
  onIndexed: (summary: IndexSummary) => void;
  onOpen: (file: string, line: number) => void;
}
export function SymbolExplorer({ repository, summary, onIndexed, onOpen }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CodeSymbol[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    window.studyRepo.searchSymbols(repository, query).then(items => { if (live) setResults(items); }).catch(e => { if (live) setError(String(e)); });
    return () => { live = false; };
  }, [repository, query, summary]);
  async function build() {
    setBusy(true); setError('');
    try {
      const next = await window.studyRepo.indexRepository(repository);
      onIndexed(next);
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }
  return <section className="symbol-explorer" aria-label="Repository symbols">
    <div className="panel-title">SYMBOLS <span>{summary?.symbols ?? 0}</span></div>
    <button className="symbol-index-button" disabled={busy} onClick={build}>{busy ? 'Indexing…' : summary?.indexedAt ? '↻ Reindex source' : '⚡ Analyze source'}</button>
    <p className="muted symbol-help">{summary?.indexedAt ? `${summary.indexedFiles} files indexed · ${summary.skipped} skipped` : 'Analyze this repository to browse code declarations.'}</p>
    <input aria-label="Search code symbols" value={query} placeholder="Find class, function, import…" onChange={event => setQuery(event.target.value)} />
    {error && <p className="symbol-error" role="alert">{error}</p>}
    <div className="symbol-results" aria-label="Symbol search results">
      {results.map((item, index) => <button key={`${item.file}:${item.line}:${index}`} className="symbol-result" onClick={() => onOpen(item.file, item.line)} title={`${item.file}:${item.line}`}>
        <span><strong>{item.name}</strong><small>{item.kind}</small></span>
        <span className="muted symbol-file">{item.file}:{item.line}</span>
      </button>)}
      {!results.length && <p className="muted symbol-help">{summary?.indexedAt ? 'No matching symbols.' : 'No index yet.'}</p>}
    </div>
  </section>;
}
