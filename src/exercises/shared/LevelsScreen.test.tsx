import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { exerciseTitleKey } from '@/config/curriculum'
import { READING_DIFFICULTIES } from '@/exercises/interval-reading/difficulties'
import { i18n } from '@/lib/i18n'

import { LevelsScreen } from './LevelsScreen'
import { difficultyTitleKey } from './difficulty'

const title = (id: string) => i18n.t(difficultyTitleKey('interval-reading', id))

function renderScreen(onPick = vi.fn(), onCustom = vi.fn()) {
  render(
    <MemoryRouter>
      <LevelsScreen
        titleKey={exerciseTitleKey('intervals', 'reading')}
        blurbKey="exercise:intervals.reading.levelsBlurb"
        group="interval-reading"
        levels={READING_DIFFICULTIES}
        onPick={onPick}
        onCustom={onCustom}
      />
    </MemoryRouter>,
  )
  return { onPick, onCustom }
}

describe('LevelsScreen', () => {
  it('lists every level, then Custom', () => {
    renderScreen()
    for (const level of READING_DIFFICULTIES) {
      expect(screen.getByText(title(level.id)), level.id).toBeTruthy()
    }
    expect(screen.getByText('Custom')).toBeTruthy()
  })

  it('reports the level that was picked', () => {
    const { onPick } = renderScreen()
    const level = READING_DIFFICULTIES[2]!

    fireEvent.click(screen.getByText(title(level.id)))
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick.mock.calls[0]![0]).toBe(level)
  })

  it('opens the settings screen from Custom, not a level', () => {
    const { onPick, onCustom } = renderScreen()

    fireEvent.click(screen.getByText('Custom'))
    expect(onCustom).toHaveBeenCalledTimes(1)
    expect(onPick).not.toHaveBeenCalled()
  })

  it('offers a way back to the path', () => {
    // Exercises run without the app header, so this is the only way out.
    renderScreen()
    expect(screen.getByRole('link', { name: /path/i }).getAttribute('href')).toBe('/')
  })

  it('leads back to the path and nowhere else', () => {
    // Reading and Hearing are separate stations, so an exercise screen has no
    // reason to link sideways into its sibling.
    renderScreen()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })
})
