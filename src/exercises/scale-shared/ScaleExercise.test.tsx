import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import ScaleHearingExercise from '@/exercises/scale-hearing/ScaleHearingExercise'
import ScaleReadingExercise from '@/exercises/scale-reading/ScaleReadingExercise'
import { i18n } from '@/lib/i18n'

/**
 * Render smoke tests for the scale pair.
 *
 * A clean typecheck is not evidence that an exercise runs: everything here is
 * wired through a registry, a settings table and a generic round machine, and
 * any of those joins can be wrong in a way only mounting the thing reveals.
 *
 * The engraver and the sampler are stubbed rather than exercised — one is 7 MB
 * of WebAssembly and the other wants an AudioContext jsdom does not have. Both
 * are covered on their own elsewhere.
 */
// Only the engraving is stubbed. The real constants come through, so the
// spacing assertion below reads what the app actually ships rather than a
// number this file made up.
vi.mock('@/lib/notation/verovio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/notation/verovio')>()),
  preloadEngraver: () => undefined,
  renderMei: vi.fn(() => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"/>')),
}))

vi.mock('@/lib/audio/engine', () => ({
  loadInstrument: () => Promise.resolve({}),
  playScale: () => Promise.resolve(),
  unlockAudio: () => Promise.resolve(),
}))

function open(element: React.ReactElement) {
  return render(<MemoryRouter>{element}</MemoryRouter>)
}

const level = (group: string, id: string) => i18n.t(`levels:${group}.${id}.title`)

/** Every accessible name on the screen, which visible text alone misses. */
function labels(container: HTMLElement): string {
  return [...container.querySelectorAll('[aria-label]')]
    .map((element) => element.getAttribute('aria-label'))
    .join(' | ')
}

describe.each([
  { name: 'Scale Reading', group: 'scale-reading', element: <ScaleReadingExercise /> },
  { name: 'Scale Hearing', group: 'scale-hearing', element: <ScaleHearingExercise /> },
])('$name', ({ name, group, element }) => {
  it('lands on its levels, not on a settings form', async () => {
    open(element)

    expect(await screen.findByRole('heading', { name })).toBeTruthy()
    expect(screen.getByText(level(group, 'major-and-minor'))).toBeTruthy()
    expect(screen.getByText('Custom')).toBeTruthy()
  })

  it('starts a round from a level, in the same tap', async () => {
    open(element)
    fireEvent.click(await screen.findByText(level(group, 'major-and-minor')))

    // The round screen: a prompt, a progress count, and the answer keyboard.
    expect(await screen.findByText('What scale is this?')).toBeTruthy()
    expect(screen.getByText('1/10')).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Scale answers' })).toBeTruthy()
  })

  it('reveals the answer on the keyboard when the answer is wrong', async () => {
    open(element)
    fireEvent.click(await screen.findByText(level(group, 'major-and-minor')))
    await screen.findByText('What scale is this?')

    // This level offers exactly two modes, so one of these two is wrong.
    const ionian = document.querySelector<HTMLElement>('[data-mode="ionian"]')
    const aeolian = document.querySelector<HTMLElement>('[data-mode="aeolian"]')
    expect(ionian).toBeTruthy()
    expect(aeolian).toBeTruthy()

    fireEvent.click(ionian as HTMLElement)

    await waitFor(() => {
      const marked = [ionian, aeolian].filter((key) =>
        key?.className.includes('bg-correct'),
      )
      expect(marked).toHaveLength(1)
    })
  })

  it('opens the full settings screen from Custom', async () => {
    open(element)
    fireEvent.click(await screen.findByText('Custom'))

    expect(await screen.findByRole('heading', { name: 'Modes' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Tonics' })).toBeTruthy()
    // Scales are engraved keyless, so there is nothing to choose here.
    expect(screen.queryByRole('heading', { name: 'Key signatures' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Start round' })).toBeTruthy()
  })
})

describe('note spacing', () => {
  it('asks the engraver for the wider scale spacing', async () => {
    // Eight notes at the default spacing spanned the column with barely a
    // notehead between them. The dial is `SCALE_NOTE_SPACING`.
    const { renderMei } = await import('@/lib/notation/verovio')
    const engrave = vi.mocked(renderMei)
    engrave.mockClear()

    open(<ScaleReadingExercise />)
    fireEvent.click(await screen.findByText(level('scale-reading', 'major-and-minor')))
    await screen.findByText('What scale is this?')

    expect(engrave).toHaveBeenCalled()
    const { SCALE_NOTE_SPACING } = await import('@/lib/notation/verovio')
    for (const [, noteSpacing] of engrave.mock.calls) {
      expect(noteSpacing).toBe(SCALE_NOTE_SPACING)
    }
  })
})

describe('wording', () => {
  // Four exercises share the levels screen, the round screen, the summary and
  // the play button. Every string those read has to be neutral, and two were
  // not: the Custom row offered "the clefs, keys and intervals", and the play
  // button was labelled "Play the interval again" — both on screens that ask
  // about modes.
  it.each([
    { name: 'Scale Reading', element: <ScaleReadingExercise /> },
    { name: 'Scale Hearing', element: <ScaleHearingExercise /> },
  ])('never says "interval" anywhere in $name', async ({ element }) => {
    const { container } = open(element)
    await screen.findByText('Custom')
    expect(container.textContent).not.toMatch(/interval/i)

    // The levels screen, the settings screen and a round each read from a
    // different set of keys, so all three have to be looked at.
    fireEvent.click(screen.getByText('Custom'))
    await screen.findByRole('heading', { name: 'Modes' })
    expect(container.textContent).not.toMatch(/interval/i)
    expect(labels(container)).not.toMatch(/interval/i)

    fireEvent.click(screen.getByRole('button', { name: 'Start round' }))
    await screen.findByText('What scale is this?')
    expect(container.textContent).not.toMatch(/interval/i)
    // Icon-only controls say nothing in their text, so their names are
    // checked separately — the play button is exactly such a control.
    expect(labels(container)).not.toMatch(/interval/i)
  })
})

describe('Scale Hearing', () => {
  it('offers a way to hear the scale again', async () => {
    open(<ScaleHearingExercise />)
    fireEvent.click(await screen.findByText(level('scale-hearing', 'major-and-minor')))
    await screen.findByText('What scale is this?')

    // Loading, because the stubbed instrument has not resolved on first paint;
    // either way the control is there and named.
    expect(
      screen.getByRole('button', { name: /play it again|loading the instrument/i }),
    ).toBeTruthy()
  })

  it('chooses the instrument and the direction, which reading does not', async () => {
    open(<ScaleHearingExercise />)
    fireEvent.click(await screen.findByText('Custom'))

    expect(await screen.findByRole('heading', { name: 'Instrument' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'How it is played' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /ascending/i })).toBeTruthy()
  })
})
