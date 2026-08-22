# PROGRESS — Unit tests for web-highlight-tts

Branch: `typescript-migration`
Last updated: 2026-08-22

## Goal
- Add unit tests for all `src/` files (target >90% coverage).
- Update README to reflect the new changes.
- Push the code when done.

## Environment
- Bun 1.3.14 test runner (`bun test`), `bun test --coverage`.
- Added `happy-dom@20.11.6` to `devDependencies` (already in `package.json` + `bun.lock`).
- NOTE: happy-dom v20 has NO `GlobalRegistrar` — setup manually copies globals from a `Window`.

## Test infrastructure
- `test/setup.ts` — the shared harness:
  - Creates a happy-dom `Window`, registers browser globals (`document`, `window`, `Node`, `Element`, `HTMLElement`, `NodeFilter`, `TreeWalker`, `getComputedStyle`, `MouseEvent`, `KeyboardEvent`, `requestAnimationFrame`, etc.).
  - Mocks `speechSynthesis` + `MockSpeechSynthesisUtterance` (has `emit()` for boundary/end/error events).
  - Forces layout props on `HTMLElement.prototype` (offsetWidth/offsetHeight/offsetParent/getClientRects) so `isVisible` behaves like a real browser (happy-dom reports 0/null without layout).
  - Exports `setupTestEnv()` → `{ window, cleanup, speech }`.
  - IMPORTANT: `createSpeechSynthesis()` returns the SAME mutable `mock` object that the getters read, so `env.speech.speaking/paused/...` toggles work (a spread-copy bug was fixed here).

## Test files (all present)
| File | Tests | Status |
| --- | --- | --- |
| `test/setup.ts` | harness | n/a |
| `test/dom.test.ts` | 6 | pass |
| `test/content.test.ts` | 15 | pass |
| `test/text.test.ts` | 15 | pass |
| `test/highlight.test.ts` | 9 | pass |
| `test/state.test.ts` | 4 | pass |
| `test/tts.test.ts` | 15 | pass |
| `test/orchestrate.test.ts` | 6 | pass |
| `test/picker.test.ts` | 6 | pass |
| `test/controls.test.ts` | 7 | pass |
| `test/index.test.ts` | 1 | pass |

## Coverage (final, pending push)
- All files: **96.87% funcs / 99.52% lines** (well above 90%)
- 100% lines: content, controls, dom, highlight, index, orchestrate, state, text, tts
- `picker.ts`: 91.67% funcs / 98.91% lines
- `tts.ts`: 99.06% lines, `test/setup.ts` is scaffolding (ignored)
- `text.ts:56-57` branch now covered via a `head` parent made visible (`style.display = 'block'`).

## Remaining TODO
~~1. Re-run `bun test --coverage` → confirmed 0 failures, 96.87% funcs / 99.52% lines.~~
~~2. Cover `text.ts:56-57` branch → done (head-parent test).~~
~~3. Added `test`/`coverage` scripts to `package.json`.~~
~~4. Added a **Testing** section to `README.md`.~~
~~5. `bun run typecheck` → clean.~~
6. `git add` the `test/`, `package.json`, `bun.lock`, `README.md`, `PROGRESS.md` changes; commit; push to `origin/typescript-migration`.

## Gotchas encountered
- `topLevelCandidates` logic: a candidate is removed only when it is contained by a **lower-or-equal-scored** ancestor (higher-scored parent does NOT remove the child). Tests must match this.
- happy-dom `contains()` works on disconnected nodes.
- `requestAnimationFrame` in happy-dom queues callbacks — tests override it (synchronous or captured) to verify highlight/unhighlight side effects.
- Module-level state in `state.ts` is shared across test files in one process → must reset via setters in `beforeEach` where relevant.
- `text.ts` test: pass the actual text NODE (nodeValue) to `isOnlyTextNodeWithPunctuation`, not the wrapper element (element.nodeValue is null).
