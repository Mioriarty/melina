import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import {
  cadenceSpec,
  correctedSetting,
  generateCadenceRound,
  type CadenceQuestion,
} from '@/exercises/harmony-shared/generate'
import type { Voicing } from '@/lib/music/satbVoicing'
import { createRandom } from '@/lib/utils/seededRandom'

import { CadenceRoundScreen } from './CadenceRoundScreen'
import { CADENCE_DIFFICULTIES } from './difficulties'

/**
 * The corrected setting, on the round screen.
 *
 * What is checked is the wiring: a wrong answer brings a switch that opens on
 * the corrected setting and flips to the player's own, and each is what the
 * staff sounds. That the correction is *right* is `rules.test.ts`'s business.
 * The engraver is stubbed, as in every render test here.
 */
vi.mock('@/lib/notation/verovio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/notation/verovio')>()),
  preloadEngraver: () => undefined,
  renderMei: vi.fn(() => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"/>')),
}))

const [question] = generateCadenceRound(
  createRandom(3),
  cadenceSpec(
    (CADENCE_DIFFICULTIES[0] as NonNullable<(typeof CADENCE_DIFFICULTIES)[0]>).settings,
  ),
) as [CadenceQuestion]

/** Every upper voice on the tenor's note: wrong in every way at once. */
const WRONG: readonly Voicing[] = question.model.voicings.map((voicing) => ({
  ...voicing,
  alto: voicing.tenor,
  soprano: voicing.tenor,
}))

function screenFor(chosen: readonly Voicing[], correct: boolean) {
  const onPlay = vi.fn()
  const onPlayCorrection = vi.fn()
  render(
    <MemoryRouter>
      <CadenceRoundScreen
        phase={{
          name: 'revealed',
          index: 0,
          answer: { question, chosen, correct, ms: 1000 },
        }}
        total={1}
        question={question}
        onPlay={onPlay}
        playStatus="ready"
        {...(correct ? {} : { correction: correctedSetting(question, chosen) })}
        onPlayCorrection={onPlayCorrection}
        correctionStatus="ready"
        onAnswer={() => undefined}
        onNext={() => undefined}
        onQuit={() => undefined}
      />
    </MemoryRouter>,
  )
  return { onPlay, onPlayCorrection }
}

describe('after a wrong setting', () => {
  it('opens on the corrected setting, and sounds it', () => {
    const { onPlay, onPlayCorrection } = screenFor(WRONG, false)

    const corrected = screen.getByRole('button', { name: 'Corrected' })
    expect(corrected.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: /correct setting/i }))
    expect(onPlayCorrection).toHaveBeenCalledOnce()
    expect(onPlay).not.toHaveBeenCalled()
  })

  it('switches to the player’s own setting, and sounds that', () => {
    const { onPlay, onPlayCorrection } = screenFor(WRONG, false)

    fireEvent.click(screen.getByRole('button', { name: 'Yours' }))
    expect(
      screen.getByRole('button', { name: 'Yours' }).getAttribute('aria-pressed'),
    ).toBe('true')
    expect(screen.queryByRole('button', { name: /correct setting/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /^A cadence in/ }))
    expect(onPlay).toHaveBeenCalledOnce()
    expect(onPlayCorrection).not.toHaveBeenCalled()
  })
})

describe('after a right setting', () => {
  it('shows no correction at all', () => {
    screenFor(question.model.voicings, true)
    expect(screen.queryByRole('button', { name: 'Corrected' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Yours' })).toBeNull()
  })
})
