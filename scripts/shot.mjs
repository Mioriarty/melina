#!/usr/bin/env node
/**
 * Screenshot the running app.
 *
 * There is no browser in the test environment and jsdom draws nothing, so a
 * change to the notation can typecheck, pass every test and still be illegible
 * on the page — a page in the wrong units renders every example equally wrong,
 * and nothing that compares one render against another can see it. This is the
 * way to look.
 *
 * It drives Playwright's cached `chrome-headless-shell` over the DevTools
 * protocol, using node's own WebSocket, so there is nothing to install: the
 * browser is already on disk under ~/Library/Caches/ms-playwright, and if it
 * is not, `npx playwright install chromium --only-shell` puts it there.
 *
 *   npm run dev
 *   npm run shot -- /train/thoroughbass/realizing out.png --click "Triads"
 *
 * `--click` takes the visible text of a button and may be repeated, which is
 * what gets past the level list and into a round. `--size` is the viewport,
 * `--wait` the settle time in ms after the last click (the engraver is 7 MB of
 * WebAssembly and the first render waits for it), and `--scale` the pixel
 * ratio — 2 by default, which is what makes notation readable, and worth
 * dropping to 1 for a very tall viewport such as the whole path.
 */
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CACHE = join(homedir(), 'Library/Caches/ms-playwright')

function findBrowser() {
  if (!existsSync(CACHE)) return undefined
  for (const entry of readdirSync(CACHE)) {
    for (const [dir, binary] of [
      ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell'],
      ['chrome-headless-shell-mac-x64', 'chrome-headless-shell'],
      ['chrome-mac', 'Chromium.app/Contents/MacOS/Chromium'],
    ]) {
      const path = join(CACHE, entry, dir, binary)
      if (existsSync(path)) return path
    }
  }
  return undefined
}

const args = process.argv.slice(2)
const positional = args.filter((arg) => !arg.startsWith('--'))
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`)
  return at === -1 ? fallback : args[at + 1]
}
const clicks = args.flatMap((arg, i) => (arg === '--click' ? [args[i + 1]] : []))

const path = positional[0] ?? '/'
const out = positional[1] ?? 'shot.png'
const [width, height] = (flag('size', '900x1200') ?? '').split('x').map(Number)
const settle = Number(flag('wait', '1200'))
const scale = Number(flag('scale', '2'))
const origin = flag('origin', 'http://localhost:5173')

const browser = findBrowser()
if (browser === undefined) {
  console.error('No cached browser. Run: npx playwright install chromium --only-shell')
  process.exit(1)
}

const port = 9333
const chrome = spawn(browser, [
  `--remote-debugging-port=${port}`,
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--hide-scrollbars',
  `--window-size=${width},${height}`,
  'about:blank',
])
chrome.stderr.on('data', () => {})

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function version() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`)
      return await response.json()
    } catch {
      await sleep(100)
    }
  }
  throw new Error('the browser never opened a debugging port')
}

const { webSocketDebuggerUrl } = await version()
const socket = new WebSocket(webSocketDebuggerUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))

let nextId = 0
const pending = new Map()
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  const waiting = pending.get(message.id)
  if (waiting !== undefined) {
    pending.delete(message.id)
    if (message.error) waiting.reject(new Error(message.error.message))
    else waiting.resolve(message.result)
  }
})

const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = (nextId += 1)
    pending.set(id, { resolve, reject })
    socket.send(
      JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }),
    )
  })

const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })

await send(
  'Emulation.setDeviceMetricsOverride',
  {
    width,
    height,
    deviceScaleFactor: scale,
    mobile: false,
  },
  sessionId,
)

await send('Page.navigate', { url: `${origin}${path}` }, sessionId)
await sleep(settle)

/**
 * Click a button by its visible text — or, for an icon-only one, by its
 * accessible name, which is the only thing such a button says at all.
 */
async function click(text) {
  const { result } = await send(
    'Runtime.evaluate',
    {
      expression: `(() => {
        const wanted = ${JSON.stringify(text)}.toLowerCase()
        // The accessible name may sit on a descendant: an icon-only button
        // carries it on the <svg> inside it, and that is all such a button says.
        const name = (el) => {
          const parts = [el.textContent || '', el.getAttribute('aria-label') || '',
                         el.getAttribute('title') || '']
          for (const inner of el.querySelectorAll('[aria-label], [title]')) {
            parts.push(inner.getAttribute('aria-label') || '', inner.getAttribute('title') || '')
          }
          return parts.join(' ').toLowerCase()
        }
        const found = [...document.querySelectorAll('button, a')].find(
          (el) => !el.disabled && name(el).includes(wanted),
        )
        if (!found) return 'not found: ' + wanted
        found.click()
        return 'clicked'
      })()`,
      returnByValue: true,
    },
    sessionId,
  )
  if (result.value !== 'clicked') throw new Error(String(result.value))
}

for (const text of clicks) {
  await click(text)
  await sleep(settle)
}

const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId)
writeFileSync(out, Buffer.from(data, 'base64'))
console.log(`wrote ${out}`)

socket.close()
chrome.kill()
process.exit(0)
