import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { setupTestEnv, type TestEnv } from './setup';
import {
  isNoise,
  isContentTag,
  hasMeaningfulText,
  cleanTextLength,
  signalMarksFor,
  scoreElement,
  collectBodyCandidates,
  sortCandidates,
  isContainedBy,
  topLevelCandidates,
  findContentContainer,
  DEFAULT_SELECTOR,
} from '../src/content';

describe('content', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = setupTestEnv();
  });

  afterEach(() => {
    env.cleanup();
  });

  const el = (tag: string): Element => env.window.document.createElement(tag);
  const htm = (tag: string): HTMLElement => env.window.document.createElement(tag);

  test('isNoise matches noise selectors only for elements', () => {
    const nav = el('nav');
    expect(isNoise(nav)).toBe(true);
    const header = el('header');
    expect(isNoise(header)).toBe(true);
    const article = el('article');
    expect(isNoise(article)).toBe(false);
    const hidden = el('div');
    hidden.setAttribute('hidden', '');
    expect(isNoise(hidden)).toBe(true);
    // non-element nodes are not noise
    const text = env.window.document.createTextNode('hi');
    expect(isNoise(text as unknown as Element)).toBe(false);
  });

  test('isContentTag accepts content tags', () => {
    expect(isContentTag('p')).toBe(true);
    expect(isContentTag('h1')).toBe(true);
    expect(isContentTag('h6')).toBe(true);
    expect(isContentTag('li')).toBe(true);
    expect(isContentTag('td')).toBe(true);
    expect(isContentTag('th')).toBe(true);
    expect(isContentTag('blockquote')).toBe(true);
    expect(isContentTag('pre')).toBe(true);
    expect(isContentTag('figcaption')).toBe(true);
    expect(isContentTag('article')).toBe(true);
    expect(isContentTag('div')).toBe(false);
    expect(isContentTag('span')).toBe(false);
  });

  test('hasMeaningfulText requires at least 100 trimmed chars', () => {
    const long = htm('div');
    long.innerText = 'x'.repeat(100);
    expect(hasMeaningfulText(long)).toBe(true);
    const short = htm('div');
    short.innerText = 'short';
    expect(hasMeaningfulText(short)).toBe(false);
    const empty = htm('div');
    empty.innerText = '   ';
    expect(hasMeaningfulText(empty)).toBe(false);
  });

  test('cleanTextLength removes noise descendants and trims', () => {
    const div = htm('div');
    div.innerHTML =
      '<p>Hello world</p><nav>navigation</nav><script>var x=1;</script>';
    const len = cleanTextLength(div);
    expect(len).toBe('Hello world'.length);
  });

  test('signalMarksFor scores semantic id/class names', () => {
    const positive = htm('article');
    positive.id = 'main-content';
    expect(signalMarksFor(positive)).toBeGreaterThan(0);
    const negative = htm('div');
    negative.className = 'sidebar nav ad related footer';
    expect(signalMarksFor(negative)).toBeLessThan(0);
    const neutral = htm('div');
    expect(signalMarksFor(neutral)).toBe(0);
  });

  test('scoreElement combines text, paragraphs and link penalties', () => {
    const div = htm('div');
    div.innerHTML = '<p>' + 'word '.repeat(40) + '</p><p>second paragraph</p><a href="#">x</a>';
    const candidate = scoreElement(div);
    expect(candidate.element).toBe(div);
    expect(candidate.score).toBeGreaterThan(0);
    // semantic main content boosts score
    div.id = 'main';
    const boosted = scoreElement(div);
    expect(boosted.score).toBe(candidate.score + 60);
  });

  test('collectBodyCandidates collects visible meaningful non-noisy elements', () => {
    const { document } = env.window;
    document.body.innerHTML =
      '<article id="main"><p>' +
      'y'.repeat(200) +
      '</p></article><nav>nav</nav><div id="short">tiny</div>';
    const candidates = collectBodyCandidates();
    const ids = candidates.map((c) => c.element.id);
    expect(ids).toContain('main');
    // nav is noise, short has no meaningful text
    expect(ids).not.toContain('nav');
    expect(ids).not.toContain('short');
  });

  test('sortCandidates sorts descending by score without mutating input', () => {
    const a = htm('div');
    const b = htm('div');
    const input = [
      { element: a, score: 10 },
      { element: b, score: 50 },
    ];
    const sorted = sortCandidates(input);
    expect(sorted[0]!.score).toBe(50);
    expect(sorted[1]!.score).toBe(10);
    // input unchanged
    expect(input[0]!.score).toBe(10);
    expect(input[1]!.score).toBe(50);
    expect(sorted).not.toBe(input);
  });

  test('isContainedBy checks ancestor containment', () => {
    const { document } = env.window;
    const parent = el('div');
    const child = el('span');
    parent.appendChild(child);
    document.body.appendChild(parent);
    expect(isContainedBy(child, parent)).toBe(true);
    expect(isContainedBy(parent, child)).toBe(false);
    // same element is not "contained by" itself
    expect(isContainedBy(child, child)).toBe(false);
    const other = el('div');
    document.body.appendChild(other);
    expect(isContainedBy(child, other)).toBe(false);
  });

  test('topLevelCandidates drops a candidate nested in a lower/equal-scored ancestor', () => {
    // outer (score 50) wraps inner (score 100); inner is contained by a
    // lower-or-equal-scored ancestor, so inner is removed.
    const outer = htm('div');
    const inner = htm('section');
    outer.appendChild(inner);
    env.window.document.body.appendChild(outer);
    const candidates = [
      { element: outer, score: 50 },
      { element: inner, score: 100 },
    ];
    const top = topLevelCandidates(candidates);
    expect(top.length).toBe(1);
    expect(top[0]!.element).toBe(outer);
  });

  test('topLevelCandidates keeps a candidate nested in a higher-scored parent', () => {
    // outer (score 100) wraps inner (score 50). inner is only contained by a
    // HIGHER-scored element, which does not trigger removal, so both remain.
    const outer = htm('div');
    const inner = htm('section');
    outer.appendChild(inner);
    env.window.document.body.appendChild(outer);
    const candidates = [
      { element: outer, score: 100 },
      { element: inner, score: 50 },
    ];
    const top = topLevelCandidates(candidates);
    expect(top.length).toBe(2);
  });

  test('findContentContainer with explicit selector returns that element', () => {
    const { document } = env.window;
    document.body.innerHTML = '<div id="target">' + 'z'.repeat(150) + '</div>';
    const target = document.getElementById('target')!;
    expect(findContentContainer('#target')).toBe(target);
  });

  test('findContentContainer falls back to body when selector not found', () => {
    const { document } = env.window;
    document.body.innerHTML = '<p>text</p>';
    expect(findContentContainer('#missing')).toBe(document.body);
  });

  test('findContentContainer with default selector picks top candidate or body', () => {
    const { document } = env.window;
    document.body.innerHTML =
      '<article id="a"><p>' + 'a'.repeat(200) + '</p></article>' +
      '<div id="b"><p>' + 'b'.repeat(150) + '</p></div>';
    const found = findContentContainer(DEFAULT_SELECTOR);
    expect(new Set(['a', 'b'])).toContain((found as HTMLElement).id);
  });

  test('findContentContainer with default returns body when no candidates', () => {
    // Reset body - body itself is a candidate because hasMeaningfulText only on
    // non-body elements; with empty body there are no meaningful candidates.
    env.window.document.body.innerHTML = '<nav>nav</nav>';
    const found = findContentContainer(DEFAULT_SELECTOR);
    expect(found).toBe(env.window.document.body);
  });
});
