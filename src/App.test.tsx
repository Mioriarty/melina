import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App'
import { stations } from './config/curriculum'
import { isCategoryEnabled } from './config/features'
import { LAST_OPENED_AT, readSetting } from './lib/db/settings'
import { i18n } from './lib/i18n'

/** Station names are translated; the tests read the English ones. */
const name = (key: string) => i18n.t(key)

const ALL = stations()
const open = ALL.filter(
  (station) => station.status === 'ready' && isCategoryEnabled(station.category),
)
const closed = ALL.filter((station) => !open.includes(station))
/** Open stations split by what tapping one gets you: a round, or a read. */
const openExercises = open.filter((station) => station.kind === 'exercise')
const openGuides = open.filter((station) => station.kind === 'guide')

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

  it('shows every station on the path', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Your path' })

    const path = within(screen.getByRole('main'))
    for (const station of ALL) {
      expect(path.getByText(name(station.titleKey)), `${station.id} missing`).toBeTruthy()
    }
  })

  it('gives interval reading and hearing a station each', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Your path' })

    // They are different games, so they get separate stops rather than one
    // that has to guess which you meant.
    const path = within(screen.getByRole('main'))
    expect(path.getByText('Interval Hearing')).toBeTruthy()
    expect(path.getByText('Interval Reading')).toBeTruthy()
    expect(path.queryByText('Interval Training')).toBeNull()
  })

  it('gives scale reading and hearing a station each', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Your path' })

    const path = within(screen.getByRole('main'))
    expect(path.getByText('Scale Hearing')).toBeTruthy()
    expect(path.getByText('Scale Reading')).toBeTruthy()
    // The category itself is not a stop once its exercises are built.
    expect(path.queryByText('Scale Training')).toBeNull()
  })

  it('labels each station by whether it can be played', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Your path' })

    // Derived from the registry, so shipping the next module updates this
    // test rather than breaking it.
    const upNext = closed.filter((station) => station.status === 'ready')

    expect(screen.getAllByText('Open')).toHaveLength(openExercises.length)
    expect(screen.queryAllByText('Up next')).toHaveLength(upNext.length)
    expect(screen.getAllByText('Locked')).toHaveLength(closed.length - upNext.length)

    // A guide says what it *is* rather than whether it is unlocked: there is
    // nothing to unlock and no progress to make, and a reader has to be able
    // to tell before tapping that this stop is something to read.
    expect(screen.queryAllByText('Read first')).toHaveLength(openGuides.length)
    expect(openGuides.length).toBeGreaterThan(0)
  })

  it('links open stations and only those', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Your path' })

    // (The skip-link and the wordmark are links too, and legitimately so.)
    // Matched against the registry's own paths rather than a `/train/` prefix,
    // because a guide is an open station that leads somewhere else entirely.
    const wanted = new Set(open.map((station) => station.path))
    const stationLinks = screen
      .getAllByRole('link')
      .filter((link) => wanted.has(link.getAttribute('href') ?? ''))

    expect(stationLinks).toHaveLength(open.length)
    for (const station of open) {
      expect(
        stationLinks.some((link) => link.getAttribute('href') === station.path),
        `${station.id} should link to where it leads`,
      ).toBe(true)
    }

    // And a guide really does leave the exercises behind.
    for (const guide of openGuides) {
      expect(guide.path.startsWith('/guide/'), guide.id).toBe(true)
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

  it('reaches settings from the header and nowhere else', async () => {
    // There is no station for settings on the path — the button in the top
    // bar is the only way in, so losing it strands the language chooser.
    render(<App />)
    await screen.findByRole('heading', { name: 'Your path' })

    const links = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/settings')
    expect(links).toHaveLength(1)

    // Icon-only, so it carries its name for a screen reader.
    expect(screen.getByRole('link', { name: 'Settings' })).toBe(links[0])
  })

  it('reaches progress from the header and nowhere else', async () => {
    // The mirror of settings: progress is not something you practise, so it
    // has no station and the streak button is the only door.
    render(<App />)
    await screen.findByRole('heading', { name: 'Your path' })

    const links = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/progress')
    expect(links).toHaveLength(1)
    expect(screen.queryByText('Progress Overview')).toBeNull()
  })

  it('opens the progress screen', async () => {
    window.history.pushState({}, '', '/progress')
    try {
      render(<App />)
      expect(await screen.findByRole('heading', { name: 'Progress' })).toBeTruthy()
    } finally {
      window.history.pushState({}, '', '/')
    }
  })

  it('opens the settings screen', async () => {
    window.history.pushState({}, '', '/settings')
    try {
      render(<App />)
      expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy()
      expect(screen.getByRole('radio', { name: 'English' })).toBeTruthy()
    } finally {
      window.history.pushState({}, '', '/')
    }
  })

  it('hides the app header inside an exercise', async () => {
    // Exercises fill the screen and carry their own navigation, so the shell
    // chrome would only be taking up room. Uses an exercise that is still
    // planned, so this renders the placeholder synchronously rather than
    // lazily pulling in the engraver and the sampler.
    window.history.pushState({}, '', '/train/intervals/singing')
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
