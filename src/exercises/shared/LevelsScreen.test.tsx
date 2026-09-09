import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi, type Mock } from 'vitest'

import { exerciseTitleKey } from '@/config/curriculum'
import { READING_DIFFICULTIES } from '@/exercises/interval-reading/difficulties'
import type { AttemptFilter } from '@/lib/db/progress'
import { db } from '@/lib/db/schema'
import { i18n } from '@/lib/i18n'

import { LevelsScreen } from './LevelsScreen'
import type { Difficulty } from './difficulty'
import { difficultyTitleKey } from './difficulty'

const title = (id: string) => i18n.t(difficultyTitleKey('interval-reading', id))

interface Options {
  onPick?: Mock
  onCustom?: Mock
  accuracyFilter?: (level: Difficulty<unknown>) => AttemptFilter
}

function renderScreen({
  onPick = vi.fn(),
  onCustom = vi.fn(),
  accuracyFilter,
}: Options = {}) {
  render(
    <MemoryRouter>
      <LevelsScreen
        titleKey={exerciseTitleKey('intervals', 'reading')}
        blurbKey="exercise:intervals.reading.levelsBlurb"
        group="interval-reading"
        levels={READING_DIFFICULTIES}
        {...(accuracyFilter === undefined ? {} : { accuracyFilter })}
        onPick={onPick}
        onCustom={onCustom}
      />
    </MemoryRouter>,
  )
  return { onPick, onCustom }
}

/**
 * Answers attributed to one level, through a filter that keeps the levels
 * apart without this screen having to know what an interval is.
 */
async function answered(levelId: string, correct: number, wrong: number) {
  await db.attempts.bulkAdd(
    Array.from({ length: correct + wrong }, (_unused, index) => ({
      exerciseId: `test/${levelId}`,
      ts: index,
      correct: index < correct,
      ms: 1000,
      answered: 'P5',
      question: {
        kind: 'interval' as const,
        lower: 'C4',
        interval: 'P5',
        clef: 'treble' as const,
        keySignature: '0' as const,
        direction: 'harmonic' as const,
      },
    })),
  )
}

const byLevel = (level: Difficulty<unknown>): AttemptFilter => ({
  exerciseId: `test/${level.id}`,
})

describe('LevelsScreen', () => {
  it('lists every level, then Custom', () => {
    renderScreen()
    for (const level of READING_DIFFICULTIES) {
      expect(screen.getByText(title(level.id)), level.id).toBeTruthy()
    }
    expect(screen.getByText('Custom')).toBeTruthy()
  })

  it('reports the level that was picked', () => {
    const { onPick } = renderScreen({})
    const level = READING_DIFFICULTIES[2]!

    fireEvent.click(screen.getByText(title(level.id)))
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick.mock.calls[0]![0]).toBe(level)
  })

  it('opens the settings screen from Custom, not a level', () => {
    const { onPick, onCustom } = renderScreen({})

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

  it('shows accuracy for a level with enough history behind it', async () => {
    const level = READING_DIFFICULTIES[0]!
    await answered(level.id, 12, 4)

    renderScreen({ accuracyFilter: byLevel })

    expect(await screen.findByText('75%')).toBeTruthy()
    // The figure alone reads as "75% of what?" when it is spoken, so the
    // accessible name says what was measured and over how many answers.
    expect(screen.getByText('75% correct across your last 16 answers')).toBeTruthy()
  })

  it('shows nothing for a level with too few answers to mean anything', async () => {
    // Fifteen is not enough: one more answer would move the figure by seven
    // points, which is a number that would mislead rather than inform.
    const [first, second] = [READING_DIFFICULTIES[0]!, READING_DIFFICULTIES[1]!]
    await answered(first.id, 15, 0)
    await answered(second.id, 12, 4)

    renderScreen({ accuracyFilter: byLevel })

    expect(await screen.findByText('75%')).toBeTruthy()
    expect(screen.queryByText('100%')).toBeNull()
  })

  it('shows nothing at all when no filter is given', async () => {
    await answered(READING_DIFFICULTIES[0]!.id, 12, 4)

    renderScreen({})

    expect(await screen.findByText(title(READING_DIFFICULTIES[0]!.id))).toBeTruthy()
    expect(screen.queryByText('75%')).toBeNull()
  })
})
