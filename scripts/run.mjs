/**
 * Run a TypeScript script against the app's own modules: `node scripts/run.mjs
 * scripts/progressions.ts [args]`.
 *
 * Vite's `runnerImport` transforms the file the way the dev server would, so a
 * script can import from `src/` — `@/` alias and all — with nothing installed
 * beyond Vite itself. `vite-node` used to do this and is no longer a
 * dependency.
 */
import { fileURLToPath } from 'node:url'

import { runnerImport } from 'vite'

const [, , entry, ...rest] = process.argv
if (entry === undefined) {
  console.error('usage: node scripts/run.mjs <script.ts> [args]')
  process.exit(1)
}

// The script reads its own arguments from `process.argv[2]` onward.
process.argv = [process.argv[0], entry, ...rest]

await runnerImport(entry, {
  configFile: false,
  logLevel: 'error',
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
})
