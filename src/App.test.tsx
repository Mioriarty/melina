import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App'
import { CATEGORIES, categoryPath } from './config/curriculum'
import { isCategoryEnabled } from './config/features'
import { LAST_OPENED_AT, readSetting } from './lib/db/settings'

const open = CATEGORIES.filter(isCategoryEnabled)
const closed = CATEGORIES.filter((category) => !isCategoryEnabled(category))

/**
 * Render smoke tests.
 *
 * A clean typecheck is not evidence the homescreen renders: an earlier version
 * of this app typechecked perfectly while crashing on first paint, because a
 * library's declared return type did not match what it returned at runtime.
 * These assert the thing actually mounts.
 */
describe('App', () => {
  it('renders the homescreen path without crashing', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Your path' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /melina/i })).toBeTruthy()
  })

  it('shows every category as a station on the path', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Your path' })

    // Scoped to main: the mobile nav sheet lists the same titles, and it is
    // in the DOM even while closed.
    const path = within(screen.getByRole('main'))
    for (const category of CATEGORIES) {
      expect(path.getByText(category.title), `${category.title} missing`).toBeTruthy()
    }
  })

  it('labels each station by whether it can be played', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Your path' })

    // Derived from the registry, so shipping the next module updates this
    // test rather than breaking it.
    const upNext = closed.filter((category) => category.status === 'ready')

    expect(screen.getAllByText('Open')).toHaveLength(open.length)
    expect(screen.queryAllByText('Up next')).toHaveLength(upNext.length)
    expect(screen.getAllByText('Locked')).toHaveLength(closed.length - upNext.length)
  })

  it('links open stations and only those', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Your path' })

    // (The skip-link and the wordmark are links too, and legitimately so.)
    const trainingLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/train/') === true)

    expect(trainingLinks).toHaveLength(open.length)
    for (const category of open) {
      expect(
        trainingLinks.some(
          (link) => link.getAttribute('href') === categoryPath(category),
        ),
        `${category.title} should link to its first exercise`,
      ).toBe(true)
    }
  })

  it('keeps unplayable stations reachable but non-navigable', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Your path' })

    // Still focusable and announced as disabled, so the whole path can be
    // explored with a keyboard or a screen reader.
    const stations = screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-disabled') === 'true')
    expect(stations).toHaveLength(closed.length)
  })

  it('shows the app header on the homescreen', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Your path' })
    expect(screen.getByRole('link', { name: /melina/i })).toBeTruthy()
  })

  it('hides the app header inside an exercise', async () => {
    // Exercises fill the screen and carry their own navigation, so the shell
    // chrome would only be taking up room. Uses the placeholder route, which
    // renders synchronously rather than pulling in the notation engraver.
    window.history.pushState({}, '', '/train/intervals/hearing')
    try {
      render(<App />)
      expect(await screen.findByRole('link', { name: /back to the path/i })).toBeTruthy()
      expect(screen.queryByRole('link', { name: /^melina$/i })).toBeNull()
    } finally {
      window.history.pushState({}, '', '/')
    }
  })

  it('records that the app was opened', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Your path' })

    await waitFor(async () => {
      expect(await readSetting(LAST_OPENED_AT)).toBeTypeOf('number')
    })
  })
})
