import { describe, expect, it } from 'vitest';
import { markdownToHtml, normalizeTutorText, latexToMathML } from '../src/study/rich-text';

describe('rich AI Tutor formatting', () => {
  it('renders headings, bullets, tables and fenced code', () => {
    const fence = String.fromCharCode(96).repeat(3);
    const html = markdownToHtml('# C++ basics\n\n- Functions\n- Pointers\n\n| Name | Type |\n| --- | --- |\n| ptr | int* |\n\n' +
      fence + 'cpp\nint value = 42;\n' + fence);
    expect(html).toContain('<h1>C++ basics</h1>');
    expect(html).toContain('<li>Functions</li>');
    expect(html).toContain('<table>');
    expect(html).toContain('language-cpp');
    expect(html).toContain('int value = 42;');
  });
  it('normalizes previously saved escaped newlines without decoding standalone code escapes', () => {
    expect(normalizeTutorText('First paragraph.\\n\\nSecond paragraph.')).toBe('First paragraph.\n\nSecond paragraph.');
    expect(normalizeTutorText('Example: "\\n"')).toBe('Example: "\\n"');
    expect(normalizeTutorText('Already\nformatted')).toBe('Already\nformatted');
  });
  it('renders fractions, roots, and exponents as safe native MathML', () => {
    const formula = latexToMathML('\\frac{x^2}{\\sqrt{y}}');
    expect(formula).toContain('<mfrac>');
    expect(formula).toContain('<msup>');
    expect(formula).toContain('<msqrt>');
    expect(markdownToHtml('Formula: $E=mc^2$')).toContain('<math');
    expect(latexToMathML('<script>')).not.toContain('<script>');
  });
  it('keeps fenced C++ source readable in generated HTML', () => {
    const fence = String.fromCharCode(96).repeat(3);
    const source = 'int32 CountFromDensity(float Density) {\\n  return FMath::FloorToInt32(Density);\\n}';
    const html = markdownToHtml(fence + 'cpp\\n' + source + '\\n' + fence);
    expect(html).toContain('language-cpp');
    expect(html).toContain('CountFromDensity');
    expect(html).toContain('FloorToInt32');
    expect(html).not.toContain('cppCopy');
  });
  it('does not replace math-like text inside code fences', () => {
    const fence = String.fromCharCode(96).repeat(3);
    const html = markdownToHtml(fence + 'js\nconst price = "$5";\n' + fence);
    expect(html).not.toContain('<math');
    expect(html).toContain('$5');
  });
});
