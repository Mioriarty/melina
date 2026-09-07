import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { intervalKey, parseIntervalKey, type Interval } from '@/lib/music/interval'

import { IntervalKeyboard } from './IntervalKeyboard'

function intervals(...keys: string[]): Interval[] {
  return keys.map((key) => {
    const interval = parseIntervalKey(key)
    if (interval === undefined) throw new Error(`bad test interval: ${key}`)
    return interval
  })
}

function key(text: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-interval="${text}"]`)
  if (element === null) throw new Error(`no key for ${text}`)
  return element
}

function keyboard(): HTMLElement {
  return screen.getByRole('group', { name: 'Interval answers' })
}

function slotOf(text: string): string | null | undefined {
  return key(text).closest('[data-slot]')?.getAttribute('data-slot')
}

/**
 * Focus a key and let React see it.
 *
 * A bare `.focus()` moves `document.activeElement` but leaves the component's
 * state update unflushed, so a `keyDown` fired straight afterwards would read
 * the previous focus. `fireEvent` wraps the update in `act`.
 */
function focusKey(text: string): void {
  const element = key(text)
  element.focus()
  fireEvent.focus(element)
}

describe('IntervalKeyboard', () => {
  it('renders exactly the offered intervals', () => {
    render(<IntervalKeyboard options={intervals('P1', 'm3', 'M3')} onAnswer={vi.fn()} />)

    expect(document.querySelectorAll('[data-interval]')).toHaveLength(3)
    expect(key('P1')).toBeTruthy()
    expect(key('m3')).toBeTruthy()
    // Not offered, so not on the keyboard.
    expect(document.querySelector('[data-interval="P5"]')).toBeNull()
  })

  it('groups by interval number, with a row label for each', () => {
    render(<IntervalKeyboard options={intervals('m2', 'M2', 'P5')} onAnswer={vi.fn()} />)

    expect(screen.getByText('Second')).toBeTruthy()
    expect(screen.getByText('Fifth')).toBeTruthy()
    expect(screen.queryByText('Third')).toBeNull()
  })

  it('reports the interval that was pressed', () => {
    const onAnswer = vi.fn()
    render(<IntervalKeyboard options={intervals('m3', 'M3')} onAnswer={onAnswer} />)

    fireEvent.click(key('M3'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(intervalKey(onAnswer.mock.calls[0]![0] as Interval)).toBe('M3')
  })

  it('names each key in full for screen readers, even when abbreviated', () => {
    render(<IntervalKeyboard options={intervals('d5')} onAnswer={vi.fn()} />)
    expect(key('d5').getAttribute('aria-label')).toBe('Diminished fifth')
  })

  it('balances each row about the perfect slot', () => {
    // Smaller qualities hang off the left of the centre line and larger ones
    // off the right, so every row shares one axis.
    render(<IntervalKeyboard options={intervals('d5', 'P5', 'A5')} onAnswer={vi.fn()} />)

    expect(slotOf('d5')).toBe('smaller')
    expect(slotOf('P5')).toBe('perfect')
    expect(slotOf('A5')).toBe('larger')
  })

  it('packs a row rather than leaving holes for qualities it lacks', () => {
    // A second has no perfect, so Minor and Major sit next to one another
    // instead of either side of a perfect-sized gap.
    render(<IntervalKeyboard options={intervals('m2', 'M2', 'P5')} onAnswer={vi.fn()} />)

    const secondRow = key('m2').closest('[data-slot]')?.parentElement
    expect(secondRow?.querySelector('[data-slot="perfect"]')).toBeNull()
    expect(secondRow?.querySelectorAll('[data-interval]')).toHaveLength(2)

    // Minor is left of the centre line, major right of it.
    expect(slotOf('m2')).toBe('smaller')
    expect(slotOf('M2')).toBe('larger')
  })

  it('exposes one tab stop, as a roving group should', () => {
    render(<IntervalKeyboard options={intervals('m2', 'M2', 'P5')} onAnswer={vi.fn()} />)

    const tabbable = [...document.querySelectorAll('[data-interval]')].filter(
      (element) => element.getAttribute('tabindex') === '0',
    )
    expect(tabbable).toHaveLength(1)
  })

  it('moves focus with the arrow keys', () => {
    render(
      <IntervalKeyboard options={intervals('m2', 'M2', 'm3', 'M3')} onAnswer={vi.fn()} />,
    )

    focusKey('m2')

    fireEvent.keyDown(keyboard(), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(key('M2'))

    fireEvent.keyDown(keyboard(), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(key('M3'))

    fireEvent.keyDown(keyboard(), { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(key('m3'))
  })

  it('lands on the nearest quality when changing row', () => {
    // A fifth has no minor, so moving down from a minor third reaches the
    // closest quality that does exist.
    render(<IntervalKeyboard options={intervals('m3', 'M3', 'P5')} onAnswer={vi.fn()} />)

    focusKey('m3')
    fireEvent.keyDown(keyboard(), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(key('P5'))
  })

  it('tracks quality rather than position across rows', () => {
    render(
      <IntervalKeyboard
        options={intervals('d5', 'P5', 'A5', 'm6', 'M6')}
        onAnswer={vi.fn()}
      />,
    )

    // Augmented fifth is the last key in its row, and a sixth has no
    // augmented; the nearest quality is major, not whatever sits last.
    focusKey('A5')
    fireEvent.keyDown(keyboard(), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(key('M6'))
  })

  it('does not run off the end of a row', () => {
    render(<IntervalKeyboard options={intervals('m3', 'M3')} onAnswer={vi.fn()} />)

    focusKey('M3')
    fireEvent.keyDown(keyboard(), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(key('M3'))
  })

  it('marks the right and wrong answers once revealed, and disables input', () => {
    const onAnswer = vi.fn()
    render(
      <IntervalKeyboard
        options={intervals('m3', 'M3')}
        onAnswer={onAnswer}
        state="revealed"
        chosen={intervals('m3')[0]}
        correct={intervals('M3')[0]}
      />,
    )

    expect(key('M3').className).toContain('bg-correct')
    expect(key('m3').className).toContain('bg-wrong')

    // Feedback is never colour alone; each carries a glyph too.
    expect(key('M3').querySelector('svg')).not.toBeNull()
    expect(key('m3').querySelector('svg')).not.toBeNull()

    fireEvent.click(key('M3'))
    expect(onAnswer).not.toHaveBeenCalled()
  })
})
