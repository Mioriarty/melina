import { describe, expect, it } from 'vitest'

import { degreesKey, type Degree } from '@/lib/music/degree'

import { append, canAppend, emptyDraft, isFull, removeLast } from './draft'

const d = (number: number, alteration: -1 | 0 | 1 = 0): Degree => ({ number, alteration })

describe('writing a melody down', () => {
  it('starts empty and wanting as many notes as there were', () => {
    const draft = emptyDraft(3)
    expect(draft.degrees).toEqual([])
    expect(isFull(draft)).toBe(false)
    expect(canAppend(draft)).toBe(true)
  })

  it('keeps each degree in the order it was pressed', () => {
    const draft = [d(1), d(3), d(5)].reduce(append, emptyDraft(3))
    expect(degreesKey(draft.degrees)).toBe('1,3,5')
    expect(isFull(draft)).toBe(true)
  })

  it('keeps an accidental with the degree it belongs to', () => {
    const draft = [d(1), d(6, -1), d(4, 1)].reduce(append, emptyDraft(3))
    expect(degreesKey(draft.degrees)).toBe('1,b6,#4')
  })

  it('takes nothing more once the melody is as long as the one played', () => {
    // Which is what makes the last key the answer: there is no confirm key,
    // so nothing may be entered past the end.
    const draft = [d(1), d(2)].reduce(append, emptyDraft(2))
    expect(canAppend(draft)).toBe(false)
    expect(append(draft, d(3))).toBe(draft)
    expect(draft.degrees).toHaveLength(2)
  })

  it('takes a key back, and stops at empty', () => {
    let draft = [d(1), d(3)].reduce(append, emptyDraft(3))
    draft = removeLast(draft)
    expect(degreesKey(draft.degrees)).toBe('1')

    draft = removeLast(draft)
    expect(draft.degrees).toEqual([])

    draft = removeLast(draft)
    expect(draft.degrees).toEqual([])
  })

  it('lets go of being full when a key is taken back', () => {
    const full = [d(1), d(2)].reduce(append, emptyDraft(2))
    expect(isFull(full)).toBe(true)
    expect(isFull(removeLast(full))).toBe(false)
    expect(canAppend(removeLast(full))).toBe(true)
  })

  it('allows the same degree twice, since a melody may repeat a note', () => {
    const draft = [d(1), d(1)].reduce(append, emptyDraft(2))
    expect(degreesKey(draft.degrees)).toBe('1,1')
  })
})
