import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { setupTestEnv, type TestEnv } from './setup';
import {
  isTextNodeBlockedByAncestor,
  isOnlyTextNodeWithPunctuation,
  acceptTextNode,
  collectTextNodes,
} from '../src/text';

describe('text', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = setupTestEnv();
  });

  afterEach(() => {
    env.cleanup();
  });

  // Builds a text node of `content` wrapped in a `parentTag` element, hung under
  // a detached-ish container. Body is appended for visibility/connectivity.
  const makeText = (
    content: string,
    parentTag = 'div',
  ): { text: Node; container: Element } => {
    const { document } = env.window;
    const container = document.createElement('div');
    const parent = document.createElement(parentTag);
    parent.appendChild(document.createTextNode(content));
    container.appendChild(parent);
    document.body.appendChild(container);
    return { text: parent.firstChild!, container };
  };

  test('isTextNodeBlockedByAncestor returns false for plain ancestor', () => {
    const { text, container } = makeText('hello world');
    expect(isTextNodeBlockedByAncestor(text, container)).toBe(false);
  });

  test('isTextNodeBlockedByAncestor detects noise ancestors', () => {
    const { document } = env.window;
    const nav = document.createElement('nav');
    const span = document.createElement('span');
    span.textContent = 'x';
    nav.appendChild(span);
    document.body.appendChild(nav);
    expect(isTextNodeBlockedByAncestor(span.firstChild!, document.body)).toBe(true);
  });

  test('isTextNodeBlockedByAncestor stops at the container boundary', () => {
    const { document } = env.window;
    const parent = document.createElement('div');
    const child = document.createElement('nav');
    child.textContent = 'x';
    parent.appendChild(child);
    document.body.appendChild(parent);
    // container is the parent, so the nav ancestor is below the container
    // and counts as blocking.
    expect(isTextNodeBlockedByAncestor(child.firstChild!, parent)).toBe(true);
  });

  test('isTextNodeBlockedByAncestor detects hidden and interactive ancestors', () => {
    const { document } = env.window;
    const hidden = document.createElement('div');
    hidden.style.display = 'none';
    hidden.textContent = 'x';
    document.body.appendChild(hidden);
    expect(isTextNodeBlockedByAncestor(hidden.firstChild!, document.body)).toBe(true);

    const btn = document.createElement('button');
    btn.textContent = 'click';
    document.body.appendChild(btn);
    expect(isTextNodeBlockedByAncestor(btn.firstChild!, document.body)).toBe(true);
  });

  test('isOnlyTextNodeWithPunctuation returns false when container is body', () => {
    const { document } = env.window;
    const p = document.createElement('p');
    p.textContent = '...';
    document.body.appendChild(p);
    expect(isOnlyTextNodeWithPunctuation(p.firstChild!, document.body)).toBe(false);
  });

  test('isOnlyTextNodeWithPunctuation returns false for content-tag parent', () => {
    const { text, container } = makeText('...', 'p');
    // parent of text is the <p>, which is a content tag
    expect(isOnlyTextNodeWithPunctuation(text, container)).toBe(false);
  });

  test('isOnlyTextNodeWithPunctuation returns true for punctuation-only non-content parent', () => {
    const { text, container } = makeText('...');
    expect(isOnlyTextNodeWithPunctuation(text, container)).toBe(true);
  });

  test('isOnlyTextNodeWithPunctuation returns false for real words', () => {
    const { text, container } = makeText('hello');
    expect(isOnlyTextNodeWithPunctuation(text, container)).toBe(false);
  });

  test('acceptTextNode rejects empty nodes', () => {
    const { document } = env.window;
    const container = document.createElement('div');
    const empty = document.createTextNode('   ');
    expect(acceptTextNode(empty, container)).toBe(NodeFilter.FILTER_REJECT);
  });

  test('acceptTextNode rejects blocked nodes and accepts clean ones', () => {
    const { text, container } = makeText('hello world');
    expect(acceptTextNode(text, container)).toBe(NodeFilter.FILTER_ACCEPT);

    const blocked = makeText('go', 'button');
    expect(acceptTextNode(blocked.text, blocked.container)).toBe(
      NodeFilter.FILTER_REJECT,
    );
  });

  test('acceptTextNode rejects punctuation-only text in non-content parent', () => {
    const { text, container } = makeText('!!!');
    expect(acceptTextNode(text, container)).toBe(NodeFilter.FILTER_REJECT);
  });

  test('acceptTextNode rejects non-text parents (script/style/head)', () => {
    const { text, container } = makeText('var x = 1;', 'script');
    expect(acceptTextNode(text, container)).toBe(NodeFilter.FILTER_REJECT);
  });

  test('acceptTextNode rejects a head parent as non-text', () => {
    const { document } = env.window;
    const container = document.createElement('div');
    const head = document.createElement('head');
    // head is display:none by default; make it visible so it is not caught by
    // the ancestor-visibility check and reaches the isNonTextElement branch.
    head.style.display = 'block';
    head.appendChild(document.createTextNode('x'));
    container.appendChild(head);
    document.body.appendChild(container);
    expect(acceptTextNode(head.firstChild!, container)).toBe(
      NodeFilter.FILTER_REJECT,
    );
  });

  test('collectTextNodes gathers accepted text nodes', () => {
    const { document } = env.window;
    const container = document.createElement('div');
    container.innerHTML = '<p>first</p><p>second</p><button>btn</button><script>var a;</script>';
    document.body.appendChild(container);
    const nodes = collectTextNodes(container);
    const texts = nodes.map((n) => (n.nodeValue ?? '').trim());
    expect(texts).toContain('first');
    expect(texts).toContain('second');
    expect(texts).not.toContain('btn');
  });

  test('collectTextNodes skips whitespace-only nodes', () => {
    const { document } = env.window;
    const container = document.createElement('div');
    container.innerHTML = '<p>one</p>   \n   <p>two</p>';
    const nodes = collectTextNodes(container);
    const texts = nodes.map((n) => (n.nodeValue ?? '').trim());
    expect(texts).toContain('one');
    expect(texts).toContain('two');
    // no whitespace-only text nodes kept
    expect(nodes.every((n) => (n.nodeValue ?? '').trim() !== '')).toBe(true);
  });
});
