import { describe, expect, it } from 'vitest'

import { figureKey } from '@/lib/music/figuredBass'

import {
  advance,
  arm,
  canAdvance,
  canPress,
  canRemove,
  draftAnswer,
  draftEvents,
  emptyFigureDraft,
  finish,
  isComplete,
  press,
  removeLast,
  type FigureDraft,
} from './draft'

/** The written form of everything under one bass note. */
const written = (draft: FigureDraft, index = 0) =>
  (draftEvents(draft)[index] ?? []).map(figureKey).join('-')

const answered = (draft: FigureDraft) =>
  draftAnswer(draft)
    .map((figures) => figures.map(figureKey).join('-'))
    .join(',')

describe('typing a figure', () => {
  it('stacks digits into one column', () => {
    const draft = press(press(emptyFigureDraft(1), 6), 4)
    expect(written(draft)).toBe('6/4')
  })

  it('sorts the column highest-first however it was typed', () => {
    // Which removes a whole class of wrong answers that would have been about
    // typing rather than about harmony.
    expect(written(press(press(emptyFigureDraft(1), 4), 6))).toBe('6/4')
  })

  it('opens a second column on the dash, which is how 4–3 is written', () => {
    const draft = press(advance(press(emptyFigureDraft(1), 4)), 3)
    expect(written(draft)).toBe('4-3')
  })

  it('will not put the same digit in a column twice', () => {
    const draft = press(emptyFigureDraft(1), 6)
    expect(canPress(draft, 6)).toBe(false)
    expect(canPress(draft, 4)).toBe(true)
    expect(written(press(draft, 6))).toBe('6')
  })

  it('will not open an empty column', () => {
    expect(canAdvance(emptyFigureDraft(1))).toBe(false)
    expect(canAdvance(press(emptyFigureDraft(1), 6))).toBe(true)
  })
})

describe('the accidentals', () => {
  it('apply to the next digit and then let go', () => {
    const draft = press(press(arm(emptyFigureDraft(1), 'sharp'), 6), 4)
    expect(written(draft)).toBe('#6/4')
  })

  it('are the third when no digit follows', () => {
    // "the Figure 3 being always suppressed … and the Accidental Sign alone
    // inserted in its place" — which falls out of the one-shot switch rather
    // than needing a key of its own.
    const draft = finish(arm(emptyFigureDraft(1), 'sharp'))
    expect(answered(draft)).toBe('#3')
  })

  it('toggle off when pressed again', () => {
    const draft = arm(arm(emptyFigureDraft(1), 'flat'), 'flat')
    expect(draft.armed).toBe('none')
  })
})

describe('done', () => {
  it('submits nothing as the plain triad, which is how one is figured', () => {
    const draft = finish(emptyFigureDraft(1))
    expect(isComplete(draft)).toBe(true)
    expect(answered(draft)).toBe('')
  })

  it('finishes one bass note at a time', () => {
    let draft = finish(press(emptyFigureDraft(2), 6))
    expect(isComplete(draft)).toBe(false)
    draft = finish(press(draft, 7))
    expect(isComplete(draft)).toBe(true)
    expect(answered(draft)).toBe('6,7')
  })
})

describe('backspace', () => {
  it('takes back an armed accidental before it takes back a digit', () => {
    const draft = arm(press(emptyFigureDraft(1), 6), 'sharp')
    expect(written(removeLast(draft))).toBe('6')
  })

  it('takes digits off one at a time', () => {
    const draft = press(press(emptyFigureDraft(1), 6), 4)
    expect(written(removeLast(draft))).toBe('6')
    expect(written(removeLast(removeLast(draft)))).toBe('')
  })

  it('reopens a closed column and carries on typing into it', () => {
    const draft = removeLast(advance(press(press(emptyFigureDraft(1), 6), 5)))
    expect(written(draft)).toBe('6/5')
    expect(written(press(draft, 3))).toBe('6/5/3')
  })

  it('does nothing with nothing to take back', () => {
    expect(canRemove(emptyFigureDraft(1))).toBe(false)
  })
})
