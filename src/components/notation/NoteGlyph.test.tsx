import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { NOTE_VALUES, type NoteValue } from '@/lib/notation/rhythmNotation'

import { NoteGlyph } from './NoteGlyph'
import * as glyphs from './glyphs'

/**
 * The keyboard's notation.
 *
 * `glyphs.ts` is generated, so what needs guarding is not the outlines but the
 * things that would silently go wrong around them: a glyph dropping out of the
 * extraction, and two symbols that must look different coming out identical.
 */

const ALL = Object.entries(glyphs).filter(
  (entry): entry is [string, glyphs.Glyph] =>
    typeof entry[1] === 'object' && entry[1] !== null && 'code' in entry[1],
)

function markup(value: NoteValue, kind: 'note' | 'rest', dotted = false): string {
  const { container } = render(<NoteGlyph value={value} kind={kind} dotted={dotted} />)
  return container.innerHTML
}

describe('the extracted glyphs', () => {
  it('has one for every value, as a note and as a rest', () => {
    expect(ALL.length).toBe(10)
  })

  it('names a real SMuFL codepoint and carries an outline', () => {
    for (const [name, glyph] of ALL) {
      expect(glyph.code, name).toMatch(/^E[0-9A-F]{3}$/)
      expect(glyph.d.length, name).toBeGreaterThan(50)
      expect(glyph.d, name).toMatch(/^M/)
    }
  })

  it('measures a box that actually contains something', () => {
    for (const [name, glyph] of ALL) {
      expect(glyph.box.x1, name).toBeGreaterThan(glyph.box.x0)
      expect(glyph.box.y1, name).toBeGreaterThan(glyph.box.y0)
    }
  })

  it('anchors a whole rest below its line and a half rest above it', () => {
    // The entire difference between the two, and the reason the boxes are
    // measured rather than assumed.
    expect(glyphs.restWhole.box.y1).toBeLessThanOrEqual(10)
    expect(glyphs.restHalf.box.y0).toBeGreaterThanOrEqual(-10)
  })

  it('anchors a notehead on its left edge, where a down stem meets it', () => {
    for (const head of [
      glyphs.noteheadBlack,
      glyphs.noteheadHalf,
      glyphs.noteheadWhole,
    ]) {
      expect(head.box.x0).toBe(0)
      expect(head.box.y0).toBeLessThan(0)
      expect(head.box.y1).toBeGreaterThan(0)
    }
  })
})

describe('drawing one', () => {
  it('draws every value, as a note and as a rest', () => {
    for (const value of NOTE_VALUES) {
      for (const kind of ['note', 'rest'] as const) {
        expect(markup(value, kind), `${kind} ${value}`).toContain('<path')
      }
    }
  })

  it('tells every value apart from every other', () => {
    // Two keys that draw the same picture are two keys nobody can choose
    // between — which is what a whole and a half rest were before the line.
    for (const kind of ['note', 'rest'] as const) {
      const drawn = NOTE_VALUES.map((value) => markup(value, kind))
      expect(new Set(drawn).size, kind).toBe(NOTE_VALUES.length)
    }
  })

  it('never draws a note the same as a rest', () => {
    for (const value of NOTE_VALUES) {
      expect(markup(value, 'note'), `${value}`).not.toBe(markup(value, 'rest'))
    }
  })

  it('adds a dot, and only when asked', () => {
    for (const value of NOTE_VALUES) {
      for (const kind of ['note', 'rest'] as const) {
        expect(markup(value, kind, false), `${kind} ${value}`).not.toContain('<circle')
        expect(markup(value, kind, true), `${kind} ${value}`).toContain('<circle')
      }
    }
  })

  it('gives a whole note no stem and everything else one', () => {
    expect(markup(1, 'note')).not.toContain('<rect')
    for (const value of [2, 4, 8, 16] as const) {
      expect(markup(value, 'note'), `${value}`).toContain('<rect')
    }
  })

  it('says nothing to a screen reader, since the key already does', () => {
    const { container } = render(<NoteGlyph value={4} kind="note" />)
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
})
