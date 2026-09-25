import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import {
  setupTestEnv,
  type TestEnv,
  MockSpeechSynthesisUtterance,
} from './setup';
import {
  configureUtterance,
  applyVoice,
  englishVoices,
  stopTTS,
  playTTS,
  pauseTTS,
} from '../src/tts';
import {
  setActiveWordIndex,
  setCurrentUtterance,
  setCurrentAllWords,
  getActiveWordIndex,
  getCurrentUtterance,
} from '../src/state';

type MockUtterance = MockSpeechSynthesisUtterance & {
  emit: (type: string, event?: unknown) => void;
};

describe('tts', () => {
  let env: TestEnv;
  let origRaf: typeof requestAnimationFrame;

  beforeEach(() => {
    env = setupTestEnv();
    // Run rAF callbacks synchronously so highlight/unhighlight apply immediately.
    origRaf = globalThis.requestAnimationFrame;
    (globalThis as Record<string, unknown>).requestAnimationFrame = (
      cb: () => void,
    ) => {
      cb();
      return 1;
    };
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).requestAnimationFrame = origRaf;
    setCurrentAllWords([]);
    setCurrentUtterance(null);
    setActiveWordIndex(0);
    env.cleanup();
  });

  const makeSpans = (words: string[]): HTMLSpanElement[] =>
    words.map((word) => {
      const span = env.window.document.createElement('span');
      span.textContent = word;
      return span;
    });

  const makeUtt = (): MockUtterance =>
    new MockSpeechSynthesisUtterance('x') as unknown as MockUtterance;

  test('configureUtterance sets the joined text and rate', () => {
    const allWords = makeSpans(['hello', 'world']);
    const utterance = configureUtterance({ allWords, rate: 1.5 });
    expect(utterance.text).toBe('hello world');
    expect(utterance.rate).toBe(1.5);
    expect(utterance).toBeInstanceOf(
      (globalThis as Record<string, unknown>).SpeechSynthesisUtterance as new (
        t?: string,
      ) => unknown,
    );
  });

  test('configureUtterance highlights the word matching a boundary char index', () => {
    const allWords = makeSpans(['hello', 'world']);
    const utterance = configureUtterance({
      allWords,
      rate: 1,
    }) as unknown as MockUtterance;
    // 'hello world' -> 'world' starts at char index 6
    utterance.emit('boundary', { name: 'word', charIndex: 6 });
    expect(allWords[1]!.style.backgroundColor).toBe('yellow');
    expect(getActiveWordIndex()).toBe(1);
    // previous word unhighlighted
    expect(allWords[0]!.style.backgroundColor).toBe('');
  });

  test('configureUtterance ignores non-word boundaries', () => {
    const allWords = makeSpans(['hello', 'world']);
    const utterance = configureUtterance({
      allWords,
      rate: 1,
    }) as unknown as MockUtterance;
    utterance.emit('boundary', { name: 'sentence', charIndex: 6 });
    expect(allWords.every((s) => s.style.backgroundColor === '')).toBe(true);
  });

  test('configureUtterance resets index and unhighlights all on end', () => {
    const allWords = makeSpans(['hello', 'world']);
    const utterance = configureUtterance({
      allWords,
      rate: 1,
    }) as unknown as MockUtterance;
    utterance.emit('boundary', { name: 'word', charIndex: 6 });
    expect(allWords[1]!.style.backgroundColor).toBe('yellow');
    utterance.emit('end');
    expect(getActiveWordIndex()).toBe(0);
    expect(allWords.every((s) => s.style.backgroundColor === '')).toBe(true);
  });

  test('configureUtterance ignores canceled/interrupted errors', () => {
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const allWords = makeSpans(['hello']);
    const utterance = configureUtterance({
      allWords,
      rate: 1,
    }) as unknown as MockUtterance;
    utterance.emit('error', { error: 'canceled' });
    utterance.emit('error', { error: 'interrupted' });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test('configureUtterance logs other speech errors', () => {
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const allWords = makeSpans(['hello']);
    const utterance = configureUtterance({
      allWords,
      rate: 1,
    }) as unknown as MockUtterance;
    utterance.emit('error', { error: 'not-allowed' });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test('applyVoice sets the matching voice and lang', () => {
    const utterance = makeUtt();
    applyVoice(
      utterance as unknown as SpeechSynthesisUtterance,
      'Samantha',
      'en-US',
    );
    expect((utterance.voice as { name: string } | null)?.name).toBe('Samantha');
    expect(utterance.lang).toBe('en-US');
  });

  test('applyVoice sets voice to null when not found', () => {
    const utterance = makeUtt();
    applyVoice(
      utterance as unknown as SpeechSynthesisUtterance,
      'Unknown',
      'en-US',
    );
    expect(utterance.voice).toBeNull();
    expect(utterance.lang).toBe('en-US');
  });

  test('englishVoices filters to en-US only', () => {
    const voices = englishVoices();
    expect(voices.map((v) => v.lang)).toEqual(['en-US']);
  });

  test('stopTTS cancels speech and unhighlights current words', () => {
    const allWords = makeSpans(['a', 'b']);
    allWords[0]!.style.backgroundColor = 'yellow';
    setCurrentAllWords(allWords);
    stopTTS();
    expect(env.speech.cancelCalls).toBe(1);
    expect(getActiveWordIndex()).toBe(0);
    expect(allWords.every((s) => s.style.backgroundColor === '')).toBe(true);
  });

  test('playTTS resumes when paused', () => {
    env.speech.paused = true;
    playTTS();
    expect(env.speech.resumeCalls).toBe(1);
    expect(env.speech.speakCalls.length).toBe(0);
  });

  test('playTTS speaks the stored current utterance when not paused/speaking', () => {
    const utterance = makeUtt();
    setCurrentUtterance(utterance as unknown as SpeechSynthesisUtterance);
    env.speech.speaking = false;
    playTTS();
    expect(env.speech.speakCalls).toContain(utterance);
  });

  test('playTTS does nothing without a current utterance', () => {
    env.speech.speaking = false;
    playTTS();
    expect(env.speech.speakCalls.length).toBe(0);
  });

  test('playTTS does nothing while already speaking', () => {
    const utterance = makeUtt();
    setCurrentUtterance(utterance as unknown as SpeechSynthesisUtterance);
    env.speech.speaking = true;
    playTTS();
    expect(env.speech.speakCalls.length).toBe(0);
    expect(getCurrentUtterance()).toBe(
      utterance as unknown as SpeechSynthesisUtterance,
    );
  });

  test('pauseTTS pauses only when speaking', () => {
    env.speech.speaking = false;
    pauseTTS();
    expect(env.speech.pauseCalls).toBe(0);
    env.speech.speaking = true;
    pauseTTS();
    expect(env.speech.pauseCalls).toBe(1);
  });
});
