import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MODE_IDS, type ModeId } from '@/lib/music/scale'

import { ScaleKeyboard } from './ScaleKeyboard'

function key(mode: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-mode="${mode}"]`)
  if (element === null) throw new Error(`no key for ${mode}`)
  return element
}

function keyboard(): HTMLElement {
  return screen.getByRole('group', { name: 'Scale answers' })
}

/**
 * Focus a key and let React see it.
 *
 * A bare `.focus()` moves `document.activeElement` but leaves the component's
 * state update unflushed, so a `keyDown` fired straight afterwards would read
 * the previous focus. `fireEvent` wraps the update in `act`.
 */
function focusKey(mode: string): void {
  const element = key(mode)
  element.focus()
  fireEvent.focus(element)
}

describe('ScaleKeyboard', () => {
  it('renders exactly the offered modes', () => {
    render(<ScaleKeyboard options={['dorian', 'ionian']} onAnswer={vi.fn()} />)

    expect(document.querySelectorAll('[data-mode]')).toHaveLength(2)
    expect(key('ionian')).toBeTruthy()
    expect(document.querySelector('[data-mode="locrian"]')).toBeNull()
  })

  it('keeps the modes in degree order whatever the options say', () => {
    // A key that moves depending on what a level allows cannot be learned.
    render(<ScaleKeyboard options={['locrian', 'dorian', 'ionian']} onAnswer={vi.fn()} />)

    const order = [...document.querySelectorAll('[data-mode]')].map((element) =>
      element.getAttribute('data-mode'),
    )
    expect(order).toEqual(['ionian', 'dorian', 'locrian'])
  })

  it('names the two modes everyone knows by their other name', () => {
    render(<ScaleKeyboard options={MODE_IDS} onAnswer={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Ionian (Major)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Aeolian (Minor)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Phrygian' })).toBeTruthy()
  })

  it('reports the mode that was pressed', () => {
    const onAnswer = vi.fn()
    render(<ScaleKeyboard options={MODE_IDS} onAnswer={onAnswer} />)

    fireEvent.click(key('mixolydian'))
    expect(onAnswer).toHaveBeenCalledWith<[ModeId]>('mixolydian')
  })

  it('walks the keys with the arrows, in both axes', () => {
    // The keys wrap, so there is no fixed grid to move around; every arrow
    // walks the one sequence instead of guessing at rows.
    render(<ScaleKeyboard options={MODE_IDS} onAnswer={vi.fn()} />)
    focusKey('ionian')

    fireEvent.keyDown(keyboard(), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(key('dorian'))

    fireEvent.keyDown(keyboard(), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(key('phrygian'))

    fireEvent.keyDown(keyboard(), { key: 'ArrowUp' })
    expect(document.activeElement).toBe(key('dorian'))

    fireEvent.keyDown(keyboard(), { key: 'End' })
    expect(document.activeElement).toBe(key(MODE_IDS[MODE_IDS.length - 1] as ModeId))

    fireEvent.keyDown(keyboard(), { key: 'Home' })
    expect(document.activeElement).toBe(key('ionian'))
  })

  it('stops at both ends rather than wrapping round', () => {
    render(<ScaleKeyboard options={MODE_IDS} onAnswer={vi.fn()} />)
    focusKey('ionian')

    fireEvent.keyDown(keyboard(), { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(key('ionian'))
  })

  it('has exactly one key in the tab order', () => {
    // A roving tabindex: one Tab reaches the keyboard, the arrows do the rest.
    render(<ScaleKeyboard options={MODE_IDS} onAnswer={vi.fn()} />)
    expect(document.querySelectorAll('[data-mode][tabindex="0"]')).toHaveLength(1)
  })

  it('marks the right answer and the wrong one it was given, with a glyph', () => {
    render(
      <ScaleKeyboard
        options={MODE_IDS}
        onAnswer={vi.fn()}
        state="revealed"
        chosen="lydian"
        correct="mixolydian"
      />,
    )

    // Never colour alone: each carries an icon as well.
    expect(key('mixolydian').className).toContain('bg-correct')
    expect(key('mixolydian').querySelector('svg')).toBeTruthy()
    expect(key('lydian').className).toContain('bg-wrong')
    expect(key('lydian').querySelector('svg')).toBeTruthy()
    expect(key('dorian').className).not.toContain('bg-correct')
  })

  it('cannot be answered twice', () => {
    const onAnswer = vi.fn()
    render(
      <ScaleKeyboard
        options={MODE_IDS}
        onAnswer={onAnswer}
        state="revealed"
        chosen="lydian"
        correct="mixolydian"
      />,
    )

    fireEvent.click(key('dorian'))
    expect(onAnswer).not.toHaveBeenCalled()
  })
})
