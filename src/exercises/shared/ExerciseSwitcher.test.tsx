import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { CATEGORIES, exercisePath, readyExercises } from '@/config/curriculum'

import { ExerciseSwitcher } from './ExerciseSwitcher'

function renderSwitcher(categoryId: string, current: string) {
  return render(
    <MemoryRouter>
      <ExerciseSwitcher categoryId={categoryId} current={current} />
    </MemoryRouter>,
  )
}

describe('ExerciseSwitcher', () => {
  it('links to every built exercise in the category', () => {
    // Without this, a station leads to one exercise and its siblings become
    // unreachable — the path is the only navigation there is.
    renderSwitcher('intervals', 'hearing')

    const intervals = CATEGORIES.find((category) => category.id === 'intervals')!
    for (const exercise of readyExercises(intervals)) {
      const link = screen.getByRole('link', { name: exercise.short ?? exercise.title })
      expect(link.getAttribute('href')).toBe(exercisePath('intervals', exercise.id))
    }
  })

  it('marks the open exercise as current', () => {
    renderSwitcher('intervals', 'reading')
    expect(
      screen.getByRole('link', { name: 'Reading' }).getAttribute('aria-current'),
    ).toBe('page')
    expect(
      screen.getByRole('link', { name: 'Hearing' }).getAttribute('aria-current'),
    ).toBeNull()
  })

  it('never offers an exercise that is not built', () => {
    renderSwitcher('intervals', 'hearing')
    // Interval Singing is still planned.
    expect(screen.queryByRole('link', { name: 'Singing' })).toBeNull()
  })

  it('renders nothing when there is nothing to switch to', () => {
    // Safe to drop into every setup screen unconditionally.
    const { container } = renderSwitcher('counterpoint', 'first-species')
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for an unknown category', () => {
    const { container } = renderSwitcher('nonsense', 'whatever')
    expect(container.firstChild).toBeNull()
  })
})
