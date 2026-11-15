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
      // Monaco colorization uses the already-bundled editor grammar and does
      // not execute code. Sanitize the resulting markup before insertion.
      void monaco.editor.colorize(raw, language, { tabSize: 2 }).then(highlighted => {
        if (disposed || !code.isConnected) return;
        const sanitized = DOMPurify.sanitize(highlighted, {
          ALLOWED_TAGS: ['span', 'br'],
          ALLOWED_ATTR: ['class', 'style']
        });
        // The renderer must never replace readable source text with empty or
        // incomplete highlighted HTML (a frequent failure with unsupported grammars).
        const candidate = document.createElement('span');
        candidate.innerHTML = sanitized;
        const normalized = (value: string) => value.replace(/\s+/g, '');
        if (normalized(candidate.textContent ?? '') === normalized(raw) && raw.trim()) {
          code.innerHTML = sanitized;
        } // Otherwise keep the original, readable fenced code.
      }).catch(() => { /* plain code remains readable */ });
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
