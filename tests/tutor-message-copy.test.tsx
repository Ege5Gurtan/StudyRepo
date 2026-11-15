import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyTutorMessageButton, messageTextToCopy } from '../src/components/CopyTutorMessageButton';
import type { TutorMessage } from '../src/shared/types';

describe('AI Tutor message copy', () => {
  it('copies user messages exactly, preserving their newlines and code', () => {
    const message: TutorMessage = { role: 'user', content: 'Why?\n\n\`\`\`cpp\nint x = 2;\n\`\`\`' };
    expect(messageTextToCopy(message)).toBe(message.content);
  });

  it('copies original AI Markdown while excluding internal source provenance', () => {
    const body = '## Explanation\n\n\`\`\`cpp\nint x = 2;\n\`\`\`';
    const suffix = '\n\n<!-- studyrepo-source-reads:' +
      encodeURIComponent(JSON.stringify([{ file: 'Source/Example.cpp', startLine: 1, endLine: 5 }])) + ' -->';
    const message: TutorMessage = { role: 'assistant', content: body + suffix };
    expect(messageTextToCopy(message)).toBe(body);
  });

  it('renders accessible Copy controls for both roles', () => {
    for (const role of ['user', 'assistant'] as const) {
      const html = renderToStaticMarkup(<CopyTutorMessageButton message={{ role, content: 'Text' }}/>);
      expect(html).toContain('type="button"');
      expect(html).toContain('>Copy</button>');
      expect(html).toContain(role === 'user' ? 'Copy user message' : 'Copy AI message');
    }
  });
});
