# Web Highlight TTS

A browser userscript that reads **any article aloud** with **live, word-by-word highlighting** so you can follow along as text is spoken.

It detects the main content of a page, filters out navigation, ads, cookie banners and other noise, splits the article into individual word spans, then uses the browser's built-in Web Speech API to read it aloud — highlighting each word in yellow and scrolling it into view as it's spoken.

## Features

- **Automatic content detection** — scores every element on the page by text length, paragraph count, link density, and semantic class names (e.g. `article` / `post` vs `nav` / `sidebar`) to find the main reading block.
- **Noise filtering** — skips hidden elements, scripts, styles, navigation, ads, cookie banners, modals, comments, forms, and more.
- **Word-by-word highlighting** — each word is wrapped in its own `<span>` so the currently spoken word can be highlighted and scrolled into view.
- **Play / Pause / Stop controls** — a small floating toolbar injected into every page.
- **Voice selection** — choose from the browser's installed English (`en-US`) voices.
- **Interactive container picker** — click the 🔍 button, hover to preview a block (orange overlay), then click to start reading there, or press `Esc` to auto-detect the main content.
- **No runtime dependencies** — built with TypeScript and bundled with [Bun](https://bun.sh/) into a single script that uses only the standard Web Speech API.

## Installation

1. Install a userscript manager for your browser:
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari)
   - [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Firefox, Edge)
2. Build the bundle (requires [Bun](https://bun.sh/)):
   ```bash
   bun install
   bun run build
   ```
   This produces `dist/highlight-tts.bundle.js`.
3. Create a new script in your manager and paste the contents of [`dist/highlight-tts.bundle.js`](./dist/highlight-tts.bundle.js) into it.
4. Save and enable the script.

Once enabled, the floating controls appear at the top-right of every page.

## Development

The source lives in [`src/`](./src) as modular TypeScript, split by feature category:

| Module | Responsibility |
| --- | --- |
| [`content.ts`](./src/content.ts) | Main-content detection and scoring |
| [`text.ts`](./src/text.ts) | Collecting and accepting visible text nodes |
| [`highlight.ts`](./src/highlight.ts) | Wrapping text into word spans and highlighting |
| [`tts.ts`](./src/tts.ts) | Web Speech API utterance setup and controls |
| [`orchestrate.ts`](./src/orchestrate.ts) | Wire-up of text → speech and sync |
| [`picker.ts`](./src/picker.ts) | Interactive container picker |
| [`controls.ts`](./src/controls.ts) | Floating toolbar injection |
| [`state.ts`](./src/state.ts) | Shared playback state |
| [`dom.ts`](./src/dom.ts) | Visibility / interactivity helpers |
| [`index.ts`](./src/index.ts) | Entry point |

Useful commands:

- `bun run build` — build the browser bundle into `dist/`.
- `bun run typecheck` — run the TypeScript type checker without emitting.

## Testing

The project uses the [Bun test runner](https://bun.sh/docs/cli/test) with
[happy-dom](https://github.com/capricorn86/happy-dom) for a DOM environment.
The shared harness in [`test/setup.ts`](./test/setup.ts) registers browser
globals, mocks the Web Speech API, and forces layout properties so visibility
checks behave like a real browser.

- `bun run test` — run the unit test suite (`bun test`).
- `bun run coverage` — run the tests with coverage reporting.

Coverage currently exceeds 90% across all `src/` modules.

## Usage

| Action | How |
| --- | --- |
| **Read a page from the start** | Click ▶️ Play. |
| **Start from a specific block** | Click 🔍, hover over a block and click it, or press `Esc` to auto-detect. |
| **Pause / resume** | Click ⏸️ Pause, then ▶️ Play again. |
| **Stop** | Click ⏹️ Stop. |
| **Change voice** | Pick a voice from the dropdown at the top-right. |

Words are highlighted in yellow as they are spoken and the page auto-scrolls to keep the current word in view.

## How it works

1. **Detect the content container** — either auto-detected by scoring all visible candidates (`findContentContainer`) or chosen directly via the interactive picker (`pickContainer`).
2. **Collect text nodes** — walks the selected container with a `TreeWalker`, accepting only visible, non-interactive text nodes while skipping noise.
3. **Split into word spans** — every accepted text node is replaced by a sequence of `<span>` elements, one per word.
4. **Configure the utterance** — joins the words into a single string, computes each word's character offset, and reads them with a `SpeechSynthesisUtterance`.
5. **Sync highlighting** — on the `boundary` event, maps the current character index back to a word index and highlights that word.

## Browser support

Requires a browser with the [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) (speech synthesis). Supported in recent Chrome, Edge, Firefox, and Safari. A set of installed English voices is needed for best results.

## License

[MIT](./LICENSE)
