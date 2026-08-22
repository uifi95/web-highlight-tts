import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { setupTestEnv, type TestEnv } from './setup';

describe('index (entrypoint)', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = setupTestEnv();
  });

  afterEach(() => {
    env.cleanup();
  });

  test('importing the entrypoint injects the floating controls', async () => {
    // Load the entrypoint so its top-level side effect (injectControls) runs.
    await import('../src/index.ts');

    const { document } = env.window;
    const container = document.querySelector(
      'div[style*="position: fixed"]',
    ) as HTMLDivElement;
    expect(container).toBeTruthy();
    expect(container.querySelectorAll('button').length).toBe(4);
    expect(container.querySelector('select')).toBeTruthy();
  });
});
