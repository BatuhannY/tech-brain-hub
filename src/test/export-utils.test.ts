import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test the escapeHtml and stripHtml utilities used in exports
function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

describe('stripHtml', () => {
  it('removes paragraph tags', () => {
    expect(stripHtml('<p>Hello world</p>')).toBe('Hello world');
  });

  it('removes nested HTML', () => {
    expect(stripHtml('<ul><li>Step 1</li><li>Step 2</li></ul>')).toBe('Step 1Step 2');
  });

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });

  it('returns plain text as-is', () => {
    expect(stripHtml('plain text')).toBe('plain text');
  });

  it('decodes HTML entities', () => {
    expect(stripHtml('<p>A &gt; B &amp; C</p>')).toBe('A > B & C');
  });
});

describe('escapeHtml', () => {
  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });

  it('handles clean strings', () => {
    expect(escapeHtml('Hello world')).toBe('Hello world');
  });
});
