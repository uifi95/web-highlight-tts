import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { setupTestEnv, type TestEnv } from './setup';
import { injectControls } from '../src/controls';
import { setCurrentUtterance } from '../src/state';

describe('controls', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = setupTestEnv();
  });

  afterEach(() => {
    setCurrentUtterance(null);
    env.cleanup();
  });

  const findControls = (): Record<string, HTMLElement> => {
    const { document } = env.window;
    const container = document.querySelector('div[style*="position: fixed"]') as HTMLDivElement;
    const buttons = Array.from(container.querySelectorAll('button'));
    const play = buttons.find((b) => b.innerText === '▶️')!;
    const pause = buttons.find((b) => b.innerText === '⏸️')!;
    const stop = buttons.find((b) => b.innerText === '⏹️')!;
    const search = buttons.find((b) => b.innerText === '🔍')!;
    const voiceSelector = container.querySelector('select') as HTMLSelectElement;
    return { play, pause, stop, search, voiceSelector, container };
  };

  test('injectControls appends toolbar with buttons and voice options', () => {
    injectControls();
    const { play, pause, stop, search, voiceSelector, container } = findControls();
    expect(container).toBeTruthy();
    expect(play && pause && stop && search).toBeTruthy();
    // mock exposes one en-US voice -> one option
    expect(voiceSelector.options.length).toBe(1);
    expect(voiceSelector.options[0]!.textContent).toContain('Samantha');
    expect(voiceSelector.options[0]!.getAttribute('data-lang')).toBe('en-US');
    expect(voiceSelector.options[0]!.getAttribute('data-name')).toBe('Samantha');
  });

  test('play button resumes when speech is paused', () => {
    injectControls();
    const { play } = findControls();
    env.speech.paused = true;
    play.click();
    expect(env.speech.resumeCalls).toBe(1);
  });

  test('pause button pauses when speech is speaking', () => {
    injectControls();
    const { pause } = findControls();
    env.speech.speaking = true;
    pause.click();
    expect(env.speech.pauseCalls).toBe(1);
  });

  test('stop button cancels speech', () => {
    injectControls();
    const { stop } = findControls();
    stop.click();
    expect(env.speech.cancelCalls).toBe(1);
  });

  test('voice selection applies the voice to the current utterance and speaks', () => {
    injectControls();
    const utterance =
      new (globalThis.SpeechSynthesisUtterance as new (t?: string) => unknown)(
        'text',
      );
    setCurrentUtterance(utterance as SpeechSynthesisUtterance);
    const { voiceSelector } = findControls();
    voiceSelector.value = 'Samantha | (en-US)';
    voiceSelector.dispatchEvent(new env.window.Event('change'));
    expect(env.speech.speakCalls).toContain(utterance);
    expect(
      (utterance as unknown as { voice: { name: string } | null }).voice?.name,
    ).toBe('Samantha');
  });

  test('voice selection without a current utterance just stops tts', () => {
    injectControls();
    const { voiceSelector } = findControls();
    const before = env.speech.cancelCalls;
    voiceSelector.value = 'Samantha | (en-US)';
    voiceSelector.dispatchEvent(new env.window.Event('change'));
    // stopTTS was invoked
    expect(env.speech.cancelCalls).toBe(before + 1);
    expect(env.speech.speakCalls.length).toBe(0);
  });

  test('search button starts the picker flow', () => {
    injectControls();
    const { search } = findControls();
    // Stub elementFromPoint so a subsequent click resolves to a block.
    const { document, window } = env.window;
    const target = document.createElement('p');
    target.textContent = 'search target article';
    document.body.appendChild(target);
    const orig = document.elementFromPoint.bind(document);
    document.elementFromPoint = () => target;

    const before = env.speech.cancelCalls;
    search.click();
    // stopTTS ran
    expect(env.speech.cancelCalls).toBe(before + 1);
    // click to finish picking -> speaks
    document.body.dispatchEvent(
      new window.MouseEvent('click', { clientX: 1, clientY: 1, bubbles: true }),
    );
    expect(env.speech.speakCalls.length).toBeGreaterThan(0);
    document.elementFromPoint = orig;
  });
});
