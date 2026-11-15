import { useEffect, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import * as monaco from 'monaco-editor';
import { markdownToHtml } from '../study/rich-text';

interface Props { content: string }

// Render untrusted model text using a strict HTML/MathML sanitizer. Never
// execute model-provided scripts, inline handlers, arbitrary iframes or styles.
export function RichTutorMessage({ content }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const safeHtml = useMemo(() => DOMPurify.sanitize(markdownToHtml(content), {
    USE_PROFILES: { html: true, mathMl: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'svg'],
    FORBID_ATTR: ['style']
  }), [content]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let disposed = false;
    const cleanups: Array<() => void> = [];

    root.querySelectorAll<HTMLPreElement>('pre').forEach(pre => {
      const code = pre.querySelector('code');
      if (!code) return;
      // Effects can be re-run (notably by React StrictMode). Never allow
      // toolbar controls to accumulate on a retained code block.
      pre.querySelectorAll(':scope > .tutor-code-toolbar').forEach(toolbar => toolbar.remove());
      const raw = code.textContent ?? '';
      const languageClass = [...code.classList].find(name => name.startsWith('language-'));
      const language = languageClass?.slice('language-'.length) ?? 'plaintext';
      const bar = document.createElement('div');
      bar.className = 'tutor-code-toolbar';
      const label = document.createElement('span');
      label.textContent = language;
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.textContent = 'Copy';
      copy.setAttribute('aria-label', 'Copy code block');
      const onCopy = () => {
        navigator.clipboard.writeText(raw).then(() => {
          if (!disposed) copy.textContent = 'Copied';
        }).catch(() => {
          if (!disposed) copy.textContent = 'Copy failed';
        });
      };
      copy.addEventListener('click', onCopy);
      cleanups.push(() => { copy.removeEventListener('click', onCopy); bar.remove(); });
      bar.append(label, copy);
      pre.prepend(bar);
      // Monaco's colorize() emits inline colors from the editor theme. Those
      // can be nearly black in the dark Tutor panel. Use tokenizer scopes with
      // our own accessible palette instead; never insert model-authored markup.
      try {
        const lines = raw.split('\n');
        const tokens = monaco.editor.tokenize(raw, language);
        const fragment = document.createDocumentFragment();
        lines.forEach((line, index) => {
          const row = tokens[index] ?? [];
          if (!row.length) {
            fragment.appendChild(document.createTextNode(line));
          } else {
            row.forEach((token, tokenIndex) => {
              const end = row[tokenIndex + 1]?.offset ?? line.length;
              const chunk = line.slice(token.offset, end);
              if (!chunk) return;
              const part = document.createElement('span');
              const scope = token.type.toLowerCase();
              if (/comment/.test(scope)) part.className = 'tutor-token-comment';
              else if (/string|regexp/.test(scope)) part.className = 'tutor-token-string';
              else if (/keyword|control|storage/.test(scope)) part.className = 'tutor-token-keyword';
              else if (/number|numeric/.test(scope)) part.className = 'tutor-token-number';
              else if (/type|class|struct/.test(scope)) part.className = 'tutor-token-type';
              else if (/preprocessor|directive|meta/.test(scope)) part.className = 'tutor-token-directive';
              part.textContent = chunk;
              fragment.appendChild(part);
            });
          }
          if (index < lines.length - 1) fragment.appendChild(document.createTextNode('\n'));
        });
        if (!disposed && code.isConnected && fragment.textContent === raw) code.replaceChildren(fragment);
      } catch {
        // Unsupported grammars retain the original readable, unstyled source.
      }
    });

    // Do not allow untrusted model-generated links to navigate the Electron
    // renderer. Offer a safe copy action rather than opening unknown URLs.
    root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(link => {
      const url = link.getAttribute('href') ?? '';
      link.title = 'Click to copy link';
      const onClick = (event: MouseEvent) => {
        event.preventDefault();
        if (/^https?:\/\//i.test(url)) void navigator.clipboard.writeText(url).catch(() => {});
      };
      link.addEventListener('click', onClick);
      cleanups.push(() => link.removeEventListener('click', onClick));
    });
    return () => { disposed = true; cleanups.forEach(fn => fn()); };
  }, [safeHtml]);

  return <div className="tutor-rich-text" ref={ref} dangerouslySetInnerHTML={{ __html: safeHtml }}/>;
}
