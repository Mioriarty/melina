import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { describeEvent } from '@/exercises/thoroughbass-shared/generate'
import type { ThoroughbassQuestion } from '@/exercises/thoroughbass-shared/generate'
import { i18n } from '@/lib/i18n'
import { parseFigureKey, type Figure } from '@/lib/music/figuredBass'
import { pitch } from '@/lib/music/pitch'

import { FigureVerdict } from './FigureVerdict'
import type { FiguringAnswer } from './rules'

/**
 * Why that was wrong.
 *
 * Canonical-required grading owes the player this line, and it has to name the
 * right kind of wrong: a figure that resolves to something else is a different
 * chord, and one that resolves to the same notes is the right chord spelled
 * long. Telling the two apart is most of what makes the strict rule fair.
 */
const fig = (key: string) => parseFigureKey(key) as Figure

function question(figures: readonly string[]): ThoroughbassQuestion {
  const event = describeEvent(pitch('G', 0, 3), '0', figures.map(fig))
  if (event === undefined) throw new Error('the example will not spell')
  return { keySignature: '0', events: [event] }
}

const wrote = (figures: readonly string[]): FiguringAnswer => [figures.map(fig)]

const said = () => screen.getByRole('paragraph').textContent ?? ''
const t = (key: string) => i18n.t(`exercise:${key}`)

describe('one figure', () => {
  it('calls out a spelling when the notes were right', () => {
    render(<FigureVerdict question={question(['6'])} chosen={wrote(['6/3'])} />)
    expect(said()).toContain(t('figuring.verdict.spelling').split('{{')[0] as string)
  })

  it('calls out a different chord when they were not', () => {
    render(<FigureVerdict question={question(['6'])} chosen={wrote(['7'])} />)
    expect(said()).toContain(t('figuring.verdict.chord').split('{{')[0] as string)
  })
})

describe('a suspension', () => {
  it('is a wrong chord when only the resolution went wrong', () => {
    // The trap: checking the first figure alone would call this a spelling
    // slip, when the player has in fact written a different second chord.
    render(<FigureVerdict question={question(['4', '3'])} chosen={wrote(['4', '6'])} />)
    expect(said()).toContain(t('figuring.verdict.chord').split('{{')[0] as string)
  })

  it('is a spelling when both chords were right and written long', () => {
    render(
      <FigureVerdict question={question(['4', '3'])} chosen={wrote(['5/4', '5/3'])} />,
    )
    expect(said()).toContain(t('figuring.verdict.spelling').split('{{')[0] as string)
  })

  it('is a wrong chord when a figure is missing altogether', () => {
    render(<FigureVerdict question={question(['4', '3'])} chosen={wrote(['4'])} />)
    expect(said()).toContain(t('figuring.verdict.chord').split('{{')[0] as string)
  })
})
