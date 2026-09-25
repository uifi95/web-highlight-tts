import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { setupTestEnv, type TestEnv } from './setup';
import { highlightAndSpeak, searchAndSpeak } from '../src/orchestrate';
import {
  getCurrentContainer,
  getCurrentAllWords,
  getCurrentUtterance,
} from '../src/state';
import { createWordSpan } from '../src/highlight';

describe('orchestrate', () => {
  let env: TestEnv;
  let origRaf: typeof requestAnimationFrame;

  beforeEach(() => {
    env = setupTestEnv();
    origRaf = globalThis.requestAnimationFrame;
    (globalThis as Record<string, unknown>).requestAnimationFrame = (
      cb: () => void,
    ) => {
      cb();
      return 1;
    };
  });

  afterEach(() => {
    // unwrap any remaining spans so later tests start clean
    const words = getCurrentAllWords();
    if (words.length) {
      words.forEach((span) => {
        if (span.parentNode) {
          span.replaceWith(
            env.window.document.createTextNode(span.textContent!),
          );
        }
      });
    }
    (globalThis as Record<string, unknown>).requestAnimationFrame = origRaf;
    env.cleanup();
  });

  test('highlightAndSpeak collects text, wraps spans, speaks and stores state', () => {
    const { document } = env.window;
    const container = document.createElement('article');
    container.innerHTML = '<p>hello brave world</p>';
    document.body.appendChild(container);

    const utterance = highlightAndSpeak(container);

    expect(getCurrentUtterance()).toBe(utterance);
    expect(getCurrentContainer()).toBe(container);
    // words are wrapped into spans inside the container
    expect(container.querySelectorAll('span').length).toBeGreaterThan(0);
    // speech synthesis was asked to speak the utterance
    expect(env.speech.speakCalls).toContain(utterance);
    expect(getCurrentAllWords().length).toBe(3);
  });

  test('highlightAndSpeak unwraps a previous container before switching', () => {
    const { document } = env.window;
    const first = document.createElement('article');
    first.innerHTML = '<p>first text</p>';
    document.body.appendChild(first);
    const second = document.createElement('section');
    second.innerHTML = '<p>second text</p>';
    document.body.appendChild(second);

    const u1 = highlightAndSpeak(first);
    const u2 = highlightAndSpeak(second);

    expect(env.speech.speakCalls).toEqual([u1, u2]);
    expect(getCurrentContainer()).toBe(second);
    // first container's spans were unwrapped back to text
    expect(first.querySelectorAll('span').length).toBe(0);
    // previous container keeps its spacing when switching
    expect(first.textContent).toBe('first text');
  });

  test('highlightAndSpeak cancels on beforeunload', () => {
    const { document, window } = env.window;
    const container = document.createElement('article');
    container.innerHTML = '<p>some words here</p>';
    document.body.appendChild(container);
    highlightAndSpeak(container);
    const before = env.speech.cancelCalls;
    window.dispatchEvent(new window.Event('beforeunload'));
    expect(env.speech.cancelCalls).toBe(before + 1);
  });

  test('searchAndSpeak stops current tts then starts picking', () => {
    // Stub elementFromPoint so a click can resolve to a readable target.
    const { document, window } = env.window;
    const target = document.createElement('p');
    target.textContent = 'target article words';
    document.body.appendChild(target);
    const origElementFromPoint = document.elementFromPoint.bind(document);
    document.elementFromPoint = (x: number, y: number): Element | null =>
      target;

    const before = env.speech.cancelCalls;
    searchAndSpeak();
    // stopTTS triggered a cancel
    expect(env.speech.cancelCalls).toBe(before + 1);

    // Simulate a click on a readable block -> picker finishes and speaks.
    document.body.dispatchEvent(
      new window.MouseEvent('click', {
        clientX: 5,
        clientY: 5,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(getCurrentContainer()).toBe(target);
    expect(env.speech.speakCalls.length).toBeGreaterThan(0);

    // restore elementFromPoint
    document.elementFromPoint = origElementFromPoint;
  });

  test('searchAndSpeak uses Escape to auto-detect content', () => {
    const { document, window } = env.window;
    const article = document.createElement('article');
    article.innerHTML = '<p>' + 'x'.repeat(200) + '</p>';
    document.body.appendChild(article);
    const origElementFromPoint = document.elementFromPoint.bind(document);

    searchAndSpeak();
    document.body.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    // The current container is set afterwards (auto-detection picked content).
    expect(getCurrentContainer()).not.toBeNull();
    expect(env.speech.speakCalls.length).toBeGreaterThan(0);
    document.elementFromPoint = origElementFromPoint;
  });

  test('createWordSpan utility surfaces word text', () => {
    const span = createWordSpan('word');
    expect(span.textContent).toBe('word');
  });
});
