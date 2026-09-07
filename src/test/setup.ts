import 'fake-indexeddb/auto'

import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

import { db } from '@/lib/db/schema'

/**
 * jsdom is missing several browser APIs the app relies on. Stubbing them here
 * keeps the tests focused on our own behaviour rather than on shims.
 */

// The Verovio integration test runs in the node environment, where none of
// these DOM shims apply and none of them can even be referenced.
const hasDom = typeof window !== 'undefined'

// matchMedia backs useMediaQuery / useReducedMotion.
if (hasDom && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

// ResizeObserver backs useElementSize. Report a desktop-sized viewport so the
// map measures as laid out rather than as 0x0.
class TestResizeObserver implements ResizeObserver {
  // A parameter property would be nicer, but `erasableSyntaxOnly` forbids it.
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element): void {
    this.callback(
      [{ target, contentRect: { width: 1280, height: 720 } } as ResizeObserverEntry],
      this,
    )
  }

  unobserve(): void {}
  disconnect(): void {}
}

if (hasDom) globalThis.ResizeObserver = TestResizeObserver

beforeEach(async () => {
  // fake-indexeddb persists for the whole file, so without this a test that
  // writes a setting would leak it into the next one.
  await db.settings.clear()

  vi.spyOn(console, 'error').mockImplementation((...args) => {
    // Surface React warnings as failures rather than letting them scroll by.
    throw new Error(`console.error during test: ${args.join(' ')}`)
  })
})

afterEach(() => {
  if (hasDom) cleanup()
  vi.restoreAllMocks()
})
