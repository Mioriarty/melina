import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { readSetting, UI_LANGUAGE } from '@/lib/db/settings'
import { i18n } from '@/lib/i18n'

import SettingsPage from './SettingsPage'

function renderPage() {
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )
}

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('SettingsPage', () => {
  it('offers every language by its own name', () => {
    renderPage()
    expect(screen.getByRole('radio', { name: 'English' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Deutsch' })).toBeTruthy()
  })

  it('marks the language currently on screen', () => {
    renderPage()
    expect(
      screen.getByRole('radio', { name: 'English' }).getAttribute('aria-checked'),
    ).toBe('true')
    expect(
      screen.getByRole('radio', { name: 'Deutsch' }).getAttribute('aria-checked'),
    ).toBe('false')
  })

  it('translates the app on the tap, with no Save step', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('radio', { name: 'Deutsch' }))

    // The heading is the page's own, so this is the whole round trip:
    // chosen -> i18next -> re-render.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Einstellungen' })).toBeTruthy()
    })
  })

  it('remembers the choice, so it survives a reload', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('radio', { name: 'Deutsch' }))

    await waitFor(async () => {
      expect(await readSetting(UI_LANGUAGE)).toBe('de')
    })
  })

  it('tells the document which language it is in', async () => {
    // A screen reader picks its voice from this, and the browser hyphenates
    // by it.
    renderPage()
    fireEvent.click(screen.getByRole('radio', { name: 'Deutsch' }))

    await waitFor(() => {
      expect(document.documentElement.lang).toBe('de')
    })
  })

  it('offers a way back to the path', () => {
    renderPage()
    expect(
      screen.getByRole('link', { name: /back to the path/i }).getAttribute('href'),
    ).toBe('/')
  })
})
