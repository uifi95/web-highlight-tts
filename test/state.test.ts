import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { setupTestEnv, type TestEnv } from './setup';
import {
  getActiveWordIndex,
  setActiveWordIndex,
  getCurrentUtterance,
  setCurrentUtterance,
  getCurrentAllWords,
  setCurrentAllWords,
  getCurrentContainer,
  setCurrentContainer,
  resetHighlighting,
} from '../src/state';

describe('state', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = setupTestEnv();
    // Reset module-level shared state so tests are order-independent.
    setActiveWordIndex(0);
    setCurrentUtterance(null);
    setCurrentAllWords([]);
    setCurrentContainer(null);
  });

  afterEach(() => {
    setCurrentUtterance(null);
    setCurrentAllWords([]);
    setCurrentContainer(null);
    env.cleanup();
  });

  const makeUtterance = (): SpeechSynthesisUtterance =>
    new (globalThis.SpeechSynthesisUtterance as unknown as new (
      t?: string,
    ) => SpeechSynthesisUtterance)('hello');

  test('active word index defaults to 0 and can be set', () => {
    expect(getActiveWordIndex()).toBe(0);
    setActiveWordIndex(5);
    expect(getActiveWordIndex()).toBe(5);
    resetHighlighting();
    expect(getActiveWordIndex()).toBe(0);
  });

  test('current utterance get/set', () => {
    expect(getCurrentUtterance()).toBeNull();
    const utt = makeUtterance();
    setCurrentUtterance(utt);
    expect(getCurrentUtterance()).toBe(utt);
    setCurrentUtterance(null);
    expect(getCurrentUtterance()).toBeNull();
  });

  test('current all words get/set', () => {
    expect(getCurrentAllWords()).toEqual([]);
    const spans: HTMLSpanElement[] = [
      env.window.document.createElement('span'),
    ];
    setCurrentAllWords(spans);
    expect(getCurrentAllWords()).toBe(spans);
    setCurrentAllWords([]);
    expect(getCurrentAllWords()).toEqual([]);
  });

  test('current container get/set', () => {
    expect(getCurrentContainer()).toBeNull();
    const div = env.window.document.createElement('div');
    setCurrentContainer(div);
    expect(getCurrentContainer()).toBe(div);
    setCurrentContainer(null);
    expect(getCurrentContainer()).toBeNull();
  });
});
