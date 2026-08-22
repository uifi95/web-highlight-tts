import { Window } from 'happy-dom';

// ==== Speech synthesis mock ====
export class MockSpeechSynthesisUtterance {
  text: string;
  rate = 1;
  voice: object | null = null;
  lang = '';
  listeners: Record<string, ((e: unknown) => void)[]> = {};
  onend: (() => void) | null = null;

  constructor(text?: string) {
    this.text = text ?? '';
  }

  addEventListener(type: string, cb: (e: unknown) => void): void {
    (this.listeners[type] ??= []).push(cb);
  }

  removeEventListener(type: string, cb: (e: unknown) => void): void {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== cb);
  }

  emit(type: string, event?: unknown): void {
    const cbs = [...(this.listeners[type] ?? [])];
    for (const cb of cbs) cb(event);
    if (type === 'end' && this.onend) this.onend();
  }
}

export interface SpeechMock {
  speaking: boolean;
  paused: boolean;
  pending: boolean;
  speakCalls: MockSpeechSynthesisUtterance[];
  cancelCalls: number;
  pauseCalls: number;
  resumeCalls: number;
  voiceList: { name: string; lang: string }[];
}

export const createSpeechSynthesis = (): SpeechMock & {
  install: () => void;
  getVoices: () => { name: string; lang: string }[];
} => {
  const install = () => {
    (globalThis as Record<string, unknown>).speechSynthesis = {
      get speaking() {
        return mock.speaking;
      },
      get paused() {
        return mock.paused;
      },
      get pending() {
        return mock.pending;
      },
      speak: (u: unknown) => {
        mock.speakCalls.push(u as MockSpeechSynthesisUtterance);
      },
      cancel: () => {
        mock.cancelCalls++;
      },
      pause: () => {
        mock.pauseCalls++;
      },
      resume: () => {
        mock.resumeCalls++;
      },
      getVoices: () => mock.voiceList,
    };
    (globalThis as Record<string, unknown>).SpeechSynthesisUtterance =
      MockSpeechSynthesisUtterance;
  };

  const mock: SpeechMock & {
    install: () => void;
    getVoices: () => { name: string; lang: string }[];
  } = {
    speaking: false,
    paused: false,
    pending: false,
    speakCalls: [],
    cancelCalls: 0,
    pauseCalls: 0,
    resumeCalls: 0,
    voiceList: [
      { name: 'Samantha', lang: 'en-US' },
      { name: 'Non-English', lang: 'en-GB' },
    ],
    install,
    getVoices: () => mock.voiceList,
  };

  return mock;
};

export interface TestEnv {
  window: Window;
  cleanup: () => void;
  speech: SpeechMock & {
    install: () => void;
    getVoices: () => { name: string; lang: string }[];
  };
}

const GLOBAL_KEYS = [
  'document',
  'window',
  'Node',
  'Element',
  'HTMLElement',
  'HTMLDivElement',
  'HTMLSpanElement',
  'HTMLButtonElement',
  'HTMLSelectElement',
  'NodeFilter',
  'TreeWalker',
  'getComputedStyle',
  'MouseEvent',
  'KeyboardEvent',
  'Event',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getClientRects',
];

export const setupTestEnv = (): TestEnv => {
  const window = new Window();
  const saved: Record<string, unknown> = {};

  const speech = createSpeechSynthesis();

  // Save previous globals and install happy-dom globals
  for (const key of GLOBAL_KEYS) {
    saved[key] = (globalThis as Record<string, unknown>)[key];
    const value = (window as Record<string, unknown>)[key];
    if (value !== undefined) {
      (globalThis as Record<string, unknown>)[key] = value;
    }
  }

  // Provide scrollIntoView on Element prototype if missing
  if (typeof (window.Element.prototype as Record<string, unknown>).scrollIntoView !== 'function') {
    (window.Element.prototype as Record<string, unknown>).scrollIntoView = () => {};
  }
  // Also install on global Element prototype
  try {
    if (typeof (globalThis.Element as typeof Element | undefined)?.prototype !== 'undefined') {
      const proto = (globalThis.Element as typeof Element).prototype as Record<string, unknown>;
      if (typeof proto.scrollIntoView !== 'function') {
        proto.scrollIntoView = () => {};
      }
    }
  } catch {
    /* ignore */
  }

  // Mock layout properties so isVisible can behave like a real browser.
  const elemProto = window.Element.prototype as Record<string, unknown>;
  if (typeof elemProto.getClientRects !== 'function' || (elemProto.getClientRects as () => unknown)().length === 0) {
    Object.defineProperty(elemProto, 'getClientRects', {
      configurable: true,
      value: () => [{ top: 0, left: 0, width: 100, height: 100, right: 100, bottom: 100 }],
    });
  }
  // happy-dom defines offsetParent/offsetWidth/offsetHeight on HTMLElement.prototype
  // and they report null/0 without a real layout. Force them to reflect a connected,
  // visible element so visibility checks behave like a real browser.
  const htmlProto = window.HTMLElement.prototype as Record<string, unknown>;
  Object.defineProperty(htmlProto, 'offsetParent', {
    configurable: true,
    get() {
      const self = this as Element;
      return self.parentElement ?? (self === window.document.body ? window.document.body : null);
    },
  });
  Object.defineProperty(htmlProto, 'offsetWidth', { configurable: true, get: () => 100 });
  Object.defineProperty(htmlProto, 'offsetHeight', { configurable: true, get: () => 100 });

  speech.install();

  const cleanup = () => {
    delete (globalThis as Record<string, unknown>).speechSynthesis;
    delete (globalThis as Record<string, unknown>).SpeechSynthesisUtterance;
    for (const key of GLOBAL_KEYS) {
      const value = saved[key];
      if (value === undefined) {
        delete (globalThis as Record<string, unknown>)[key];
      } else {
        (globalThis as Record<string, unknown>)[key] = value;
      }
    }
    window.close();
  };

  return { window, cleanup, speech };
};
