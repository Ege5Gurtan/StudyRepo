import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FileTree } from '../src/components/FileTree';

describe('file tree', () => {
  it('renders nested folders and file extension indicators', () => {
    const html = renderToStaticMarkup(<FileTree nodes={[{ name: 'src', path: 'src', type: 'directory', children: [{ name: 'app.ts', path: 'src/app.ts', type: 'file' }] }]} open={() => {}} />);
    expect(html).toContain('<details>');
    expect(html).toContain('src');
    expect(html).toContain('app.ts');
    expect(html).toContain('TS');
  });
});
