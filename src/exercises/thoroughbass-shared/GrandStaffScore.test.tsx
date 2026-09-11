import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'
import { parseFigureKey, type Figure } from '@/lib/music/figuredBass'
import { pitch } from '@/lib/music/pitch'

import { GrandStaffScore, type GrandStaffEvent } from './GrandStaffScore'

/**
 * The grand staff, and what it does with a wrong answer.
 *
 * The engraver is stubbed — 7 MB of WebAssembly jsdom cannot instantiate — so
 * what is asserted here is which staves are built and what they are called,
 * not what Verovio draws. That is covered against the real toolkit in
 * `thoroughbassVerovio.test.ts`.
 */
vi.mock('@/lib/notation/verovio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/notation/verovio')>()),
  preloadEngraver: () => undefined,
  renderMei: vi.fn(() => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"/>')),
}))

const fig = (key: string) => parseFigureKey(key) as Figure

const bass = pitch('G', 0, 3)
const wrote: GrandStaffEvent[] = [
  { bass, figures: [fig('7')], chord: [pitch('B', 0, 4), pitch('D', 0, 5)] },
]
const wanted: GrandStaffEvent[] = [
  {
    bass,
    figures: [fig('7')],
    chord: [pitch('B', 0, 4), pitch('D', 0, 5), pitch('F', 0, 5)],
  },
]

const t = (key: string) => i18n.t(key)

describe('a grand staff on its own', () => {
  it('draws one staff and names nothing', async () => {
    render(<GrandStaffScore keySignature="0" events={wrote} />)

    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))
    expect(screen.queryByText(t('exercise:realizing.staff.yours'))).toBeNull()
  })
})

describe('a wrong answer', () => {
  it('keeps what was written and puts what was wanted beside it', async () => {
    // Replacing one with the other says you were wrong and nothing else. What
    // is worth seeing is which note moved, and that needs both on the page.
    render(<GrandStaffScore keySignature="0" events={wrote} answer={wanted} />)

    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))
    expect(screen.getByText(t('exercise:realizing.staff.yours'))).toBeTruthy()
    expect(screen.getByText(t('exercise:realizing.staff.correct'))).toBeTruthy()
  })

  it('sounds the chord that was wanted, and only that one', async () => {
    // Realising plays nothing while the question is up, because the chord *is*
    // the answer — so after a wrong one, what the player has not yet heard is
    // the right chord. Two play buttons would be two ways to ask which.
    const onPlay = vi.fn()
    render(
      <GrandStaffScore
        keySignature="0"
        events={wrote}
        answer={wanted}
        onPlay={onPlay}
        status="ready"
      />,
    )

    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('builds the two staves from different chords', async () => {
    // The whole point: if both sides engraved the same music the comparison
    // would be a pair of identical pictures with different captions under them.
    const { renderMei } = await import('@/lib/notation/verovio')
    vi.mocked(renderMei).mockClear()

    render(<GrandStaffScore keySignature="0" events={wrote} answer={wanted} />)
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))

    const drawn = vi.mocked(renderMei).mock.calls.map(([mei]) => mei)
    expect(new Set(drawn).size).toBe(2)
  })
})
