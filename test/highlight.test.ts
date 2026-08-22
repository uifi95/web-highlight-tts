import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { setupTestEnv, type TestEnv } from './setup';
import {
  highlight,
  unhighlight,
  createWordSpan,
  createSpaceSpan,
  wrapTextNodeIntoSpans,
  prepareText,
  unwrapSpansIntoText,
} from '../src/highlight';

describe('highlight', () => {
  let env: TestEnv;
  let rafCallbacks: Array<() => void>;
  let origRaf: typeof requestAnimationFrame;

  beforeEach(() => {
    env = setupTestEnv();
    rafCallbacks = [];
    origRaf = globalThis.requestAnimationFrame;
    (globalThis as Record<string, unknown>).requestAnimationFrame = (cb: () => void) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    };
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).requestAnimationFrame = origRaf;
    env.cleanup();
  });

  const flushRaf = (): void => {
    while (rafCallbacks.length) {
      rafCallbacks.shift()!();
    }
  };

  test('createWordSpan creates a span with the word text', () => {
    const span = createWordSpan('hello');
    expect(span.tagName).toBe('SPAN');
    expect(span.textContent).toBe('hello');
  });

  test('createSpaceSpan creates a span holding a single space', () => {
    const span = createSpaceSpan();
    expect(span.textContent).toBe(' ');
  });

  test('highlight applies yellow styles and scrolls into view via rAF', () => {
    const { document } = env.window;
    const el = document.createElement('span');
    document.body.appendChild(el);
    highlight(el);
    expect(el.style.backgroundColor).toBe('');
    flushRaf();
    expect(el.style.backgroundColor).toBe('yellow');
    expect(el.style.color).toBe('black');
  });

  test('unhighlight clears styles via rAF', () => {
    const { document } = env.window;
    const el = document.createElement('span');
    el.style.backgroundColor = 'yellow';
    el.style.color = 'black';
    unhighlight(el);
    flushRaf();
    expect(el.style.backgroundColor).toBe('');
    expect(el.style.color).toBe('');
  });

  test('wrapTextNodeIntoSpans replaces a text node with word + space spans', () => {
    const { document } = env.window;
    const parent = document.createElement('p');
    parent.appendChild(document.createTextNode('hello brave world'));
    const spans = wrapTextNodeIntoSpans(parent.firstChild!);
    expect(spans.map((s) => s.textContent)).toEqual(['hello', 'brave', 'world']);
    // children should be span span(space) span span(space) span
    const children = Array.from(parent.children).map((c) => ({
      text: c.textContent,
    }));
    expect(children.map((c) => c.text)).toEqual([
      'hello',
      ' ',
      'brave',
      ' ',
      'world',
    ]);
  });

  test('wrapTextNodeIntoSpans handles a single word', () => {
    const { document } = env.window;
    const parent = document.createElement('p');
    parent.appendChild(document.createTextNode('only'));
    const spans = wrapTextNodeIntoSpans(parent.firstChild!);
    expect(spans.map((s) => s.textContent)).toEqual(['only']);
  });

  test('prepareText wraps multiple text nodes', () => {
    const { document } = env.window;
    const parent = document.createElement('p');
    parent.appendChild(document.createTextNode('one'));
    parent.appendChild(document.createTextNode('two'));
    const textNodes = Array.from(parent.childNodes) as Node[];
    const words = prepareText(textNodes);
    expect(words.map((w) => w.textContent)).toEqual(['one', 'two']);
  });

  test('unwrapSpansIntoText collapses spans back into text nodes', () => {
    const { document } = env.window;
    const parent = document.createElement('p');
    parent.appendChild(document.createTextNode('hello world'));
    const spans = wrapTextNodeIntoSpans(parent.firstChild!);
    unwrapSpansIntoText(spans);
    // The paragraph should now contain plain text nodes, no HTML element spans.
    const hasElements = Array.from(parent.childNodes).some(
      (n) => n.nodeType === Node.ELEMENT_NODE,
    );
    expect(hasElements).toBe(false);
    expect(parent.textContent).toBe('helloworld');
  });

  test('unwrapSpansIntoText removes trailing space siblings', () => {
    const { document } = env.window;
    const parent = document.createElement('p');
    parent.appendChild(document.createTextNode('a b c'));
    const spans = wrapTextNodeIntoSpans(parent.firstChild!);
    unwrapSpansIntoText(spans);
    expect(parent.textContent).toBe('abc');
  });
});
