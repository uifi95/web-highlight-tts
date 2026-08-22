import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { setupTestEnv, type TestEnv } from './setup';
import { pickContainer } from '../src/picker';

describe('picker', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = setupTestEnv();
  });

  afterEach(() => {
    env.cleanup();
  });

  const stubElementFromPoint = (el: Element | null): (() => void) => {
    const { document } = env.window;
    const orig = document.elementFromPoint.bind(document);
    document.elementFromPoint = () => el;
    return () => {
      document.elementFromPoint = orig;
    };
  };

  const makeBlock = (text = 'Readable block content'): Element => {
    const div = env.window.document.createElement('div');
    div.textContent = text;
    env.window.document.body.appendChild(div);
    return div;
  };

  const clickAt = (x = 5, y = 5): void => {
    env.window.document.body.dispatchEvent(
      new env.window.MouseEvent('click', {
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
      }),
    );
  };

  const moveAt = (x = 5, y = 5): void => {
    env.window.document.body.dispatchEvent(
      new env.window.MouseEvent('mousemove', {
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
      }),
    );
  };

  const pressEsc = (): void => {
    env.window.document.body.dispatchEvent(
      new env.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
  };

  const overlayEl = (): HTMLDivElement | null => {
    const { document } = env.window;
    return (
      ([...document.querySelectorAll('div')].find(
        (d) => d.style.position === 'fixed',
      ) as HTMLDivElement | undefined) ?? null
    );
  };

  test('pickContainer appends overlay and hint, then picks on click', () => {
    const block = makeBlock();
    const restore = stubElementFromPoint(block);
    const picks: Element[] = [];
    pickContainer((t) => picks.push(t));

    // overlay + hint appended
    expect(document.body.querySelectorAll('div').length).toBeGreaterThan(0);

    moveAt();
    // mousemove positions the overlay over the target
    const overlay = overlayEl();
    expect(overlay?.style.display).toBe('block');

    clickAt();
    expect(picks).toEqual([block]);
    // overlay removed after finish
    expect(overlayEl()).toBeNull();
    restore();
  });

  test('clicking does not double-fire after a pick', () => {
    const block = makeBlock();
    const restore = stubElementFromPoint(block);
    const picks: Element[] = [];
    pickContainer((t) => picks.push(t));
    clickAt();
    clickAt();
    expect(picks.length).toBe(1);
    restore();
  });

  test('Escape triggers auto-detection through findContentContainer', () => {
    const { document } = env.window;
    document.body.innerHTML =
      '<article id="main"><p>' + 'y'.repeat(200) + '</p></article>';
    const restore = stubElementFromPoint(null);
    const picks: Element[] = [];
    pickContainer((t) => picks.push(t));
    pressEsc();
    expect(picks.length).toBe(1);
    expect((picks[0] as HTMLElement).id).toBe('main');
    restore();
  });

  test('mousemove/click over an empty target does nothing', () => {
    const empty = env.window.document.createElement('div');
    // whitespace-only text -> pickTargetFromPoint returns null
    empty.textContent = '   ';
    env.window.document.body.appendChild(empty);
    const restore = stubElementFromPoint(empty);
    const picks: Element[] = [];
    pickContainer((t) => picks.push(t));
    moveAt();
    clickAt();
    expect(picks.length).toBe(0);
    restore();
  });

  test('elementFromPoint returning null is handled gracefully', () => {
    const restore = stubElementFromPoint(null);
    const picks: Element[] = [];
    pickContainer((t) => picks.push(t));
    moveAt();
    clickAt();
    expect(picks.length).toBe(0);
    restore();
  });

  test('cleanup removes the document listeners after picking', () => {
    const block = makeBlock();
    const restore = stubElementFromPoint(block);
    const picks: Element[] = [];
    pickContainer((t) => picks.push(t));
    clickAt();
    expect(picks.length).toBe(1);
    // after cleanup, subsequent document clicks no longer pick
    clickAt();
    expect(picks.length).toBe(1);
    restore();
  });
});
