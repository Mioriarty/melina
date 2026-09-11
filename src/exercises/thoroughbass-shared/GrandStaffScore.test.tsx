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
/**
 * Enough of a render for the cursor band to have somewhere to land: a page
 * margin, two measures with staff lines of their own, and a named bass note in
 * each. Everything `scoreCursor.ts` reads and nothing else — what the engraver
 * really emits is checked against the engraver, in `scoreCursor.test.ts`.
 */
const SKELETON = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500">',
  '<g class="page-margin" transform="translate(0, 0)"><g class="system">',
  '<g id="m1" class="measure"><path d="M0 100 L400 100"/><path d="M0 180 L400 180"/>',
  '<g id="bass1" class="note"><use transform="translate(150, 140)"/></g></g>',
  '<g id="m2" class="measure"><path d="M400 100 L800 100"/><path d="M400 180 L800 180"/>',
  '<g id="bass2" class="note"><use transform="translate(550, 140)"/></g></g>',
  '</g></g></svg>',
].join('')

vi.mock('@/lib/notation/verovio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/notation/verovio')>()),
  preloadEngraver: () => undefined,
  renderMei: vi.fn(() => Promise.resolve(SKELETON)),
}))

const fig = (key: string) => parseFigureKey(key) as Figure

const bass = pitch('G', 0, 3)
const wrote: GrandStaffEvent[] = [
  { bass, figures: [fig('7')], chords: [[pitch('B', 0, 4), pitch('D', 0, 5)]] },
]
const wanted: GrandStaffEvent[] = [
  {
    bass,
    figures: [fig('7')],
    chords: [[pitch('B', 0, 4), pitch('D', 0, 5), pitch('F', 0, 5)]],
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

describe('the cursor', () => {
  const two: GrandStaffEvent[] = [
    { bass, figures: [fig('6')], chords: [[]] },
    { bass, figures: [fig('6')], chords: [[]] },
  ]

  it('bands the chord the next press goes into', async () => {
    const { container } = render(
      <GrandStaffScore
        keySignature="0"
        events={two}
        cursor={{ event: 1, position: 0 }}
      />,
    )

    await waitFor(() => expect(container.querySelector('.score-cursor')).toBeTruthy())
    // The second bass note is drawn at 550 and the first at 150, so the band
    // has to cover the one and not the other.
    const band = container.querySelector('.score-cursor')
    const left = Number(band?.getAttribute('x'))
    const right = left + Number(band?.getAttribute('width'))
    expect(left).toBeLessThan(550)
    expect(right).toBeGreaterThan(550)
    expect(left).toBeGreaterThan(150)
  })

  it('draws nothing when there is no next press', async () => {
    const { container } = render(<GrandStaffScore keySignature="0" events={two} />)

    await waitFor(() => expect(container.querySelector('svg')).toBeTruthy())
    expect(container.querySelector('.score-cursor')).toBeNull()
  })
})
