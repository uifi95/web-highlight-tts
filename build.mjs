import { build } from 'bun'

const result = await build({
  entrypoints: ['src/index.ts'],
  outdir: 'dist',
  target: 'browser',
  format: 'iife',
  sourcemap: 'none',
  minify: false,
  naming: 'highlight-tts.bundle.js',
})

if (!result.success) {
  console.error(result.logs)
  process.exit(1)
}

console.log(`Built ${result.outputs.map((o) => o.path).join(', ')}`)
