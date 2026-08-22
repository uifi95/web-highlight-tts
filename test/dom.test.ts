import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { setupTestEnv, type TestEnv } from './setup';
import * as dom from '../src/dom';

describe('dom', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = setupTestEnv();
  });

  afterEach(() => {
    env.cleanup();
  });

  test('isVisible returns true for normal visible element', () => {
    const { document } = env.window;
    const div = document.createElement('div');
    document.body.appendChild(div);
    expect(dom.isVisible(div)).toBe(true);
  });

  test('isVisible returns false when display none', () => {
    const { document } = env.window;
    const div = document.createElement('div');
    div.style.display = 'none';
    document.body.appendChild(div);
    expect(dom.isVisible(div)).toBe(false);
  });

  test('isVisible returns false when visibility hidden', () => {
    const { document } = env.window;
    const div = document.createElement('div');
    div.style.visibility = 'hidden';
    document.body.appendChild(div);
    expect(dom.isVisible(div)).toBe(false);
  });

  test('isInteractive matches interactive selectors', () => {
    const { document } = env.window;
    const button = document.createElement('button');
    expect(dom.isInteractive(button)).toBe(true);
    const input = document.createElement('input');
    expect(dom.isInteractive(input)).toBe(true);
    const div = document.createElement('div');
    expect(dom.isInteractive(div)).toBe(false);
  });

  test('isNonTextElement identifies script/style/head', () => {
    expect(dom.isNonTextElement('script')).toBe(true);
    expect(dom.isNonTextElement('style')).toBe(true);
    expect(dom.isNonTextElement('head')).toBe(true);
    expect(dom.isNonTextElement('div')).toBe(false);
  });

  test('closest finds nearest matching ancestor', () => {
    const { document } = env.window;
    const section = document.createElement('section');
    const p = document.createElement('p');
    const span = document.createElement('span');
    p.appendChild(span);
    section.appendChild(p);
    expect(dom.closest(span)).toBe(p);
    const divOnly = document.createElement('div');
    expect(dom.closest(divOnly)).toBe(divOnly);
  });
});
