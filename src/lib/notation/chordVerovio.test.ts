// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  chordPitches,
  closeChord,
  type Chord,
  type ChordQuality,
} from '@/lib/music/chord'
import type { PitchClass } from '@/lib/music/scale'

import { chordMei, rhythmMei } from './mei'
import { notateRhythm } from './rhythmNotation'
import { CHORD_ANSWER_PROFILE, renderMei, rhythmProfile } from './verovio'

/**
 * The engraver against a real chord.
 *
 * In the node environment for the same reason as `verovio.test.ts`: 7 MB of
 * WebAssembly that jsdom cannot instantiate. What it is here to catch is
 * everything nothing structural can — that the accidentals a spelling demands
 * are really drawn, that a chord hidden before its answer is *engraved* rather
 * than left out, and that a chord being written into does not move.
 */

const C: PitchClass = { letter: 'C', alteration: 0 }
const B: PitchClass = { letter: 'B', alteration: 0 }

const pixels = (svg: string) => {
  const found = svg.match(/width="(\d+)px" height="(\d+)px"/)
  return { width: Number(found?.[1] ?? 0), height: Number(found?.[2] ?? 0) }
}

const size = (svg: string) => svg.match(/width="(\d+)px" height="(\d+)px"/)?.[0]

const countOf = (svg: string, name: string) =>
  (svg.match(new RegExp(`class="[^"]*\\b${name}\\b`, 'g')) ?? []).length

function show(chord: Chord, hidden = false) {
  return renderMei(
    chordMei({ pitches: chordPitches(chord) ?? [], clef: 'treble', hidden }),
  )
}

function write(pitches: number) {
  const all = chordPitches(closeChord(C, 'dominant-seventh')) ?? []
  return renderMei(
    chordMei({ pitches: all.slice(0, pitches), clef: 'treble' }),
    undefined,
    CHORD_ANSWER_PROFILE,
  )
}

describe('a chord on the page', () => {
  it('engraves as one stack of noteheads on a five-line staff', async () => {
    const svg = await show(closeChord(C, 'major'))
    expect(svg).toContain('<svg')
    expect(countOf(svg, 'note')).toBe(3)
    expect(countOf(svg, 'chord')).toBe(1)
  })

  it('prints exactly the accidentals the spelling asks for, and no key signature', async () => {
    // Keyless, so an alteration is always printed and a natural never is —
    // which is what makes the quality readable off the page at all. Counted as
    // **drawn glyphs**, because Verovio emits an empty `<g class="accid"/>` for
    // a gestural accidental too, so counting the class would count the notes.
    const drawn = async (quality: ChordQuality, root = C) => {
      const svg = await show(closeChord(root, quality))
      const notes = countOf(svg, 'note')
      // Every `<use>` on the page, less the clef and one notehead per note.
      return (svg.match(/<use/g) ?? []).length - notes - 1
    }

    expect(await drawn('major')).toBe(0)
    expect(await drawn('minor')).toBe(1)
    expect(await drawn('diminished')).toBe(2)
    expect(await drawn('augmented')).toBe(1)
    expect(await drawn('dominant-seventh')).toBe(1)
    expect(await drawn('major-seventh')).toBe(0)
    expect(await drawn('minor-seventh')).toBe(2)
    expect(await drawn('half-diminished-seventh')).toBe(3)
    // B D F A♭ — one flat, and no signature to read it against.
    expect(await drawn('diminished-seventh', B)).toBe(1)
    // And on C the same chord is C E♭ G♭ B𝄫, where the double flat really is
    // drawn rather than quietly reduced to a single one. MEI writes it `ff`
    // because a double flat *is* two flats — unlike a double sharp, which is
    // the single glyph `x` — so what is counted here is what Verovio actually
    // puts on the staff for it.
    expect(await drawn('diminished-seventh')).toBeGreaterThan(2)
    expect(await show(closeChord(C, 'diminished-seventh'))).toContain('accid')
    // And the staff really is keyless: Verovio emits an empty `<g
    // class="keySig"/>` either way, so what says so is that a plain C major
    // costs nothing beyond its clef and its three noteheads — which is what
    // `drawn` returning 0 above already measured.
    const plain = await show(closeChord(C, 'major'))
    expect((plain.match(/<use/g) ?? []).length).toBe(countOf(plain, 'note') + 1)
  })

  it('engraves an unrevealed chord in its place rather than leaving it out', async () => {
    // The hearing question shows an empty staff and the chord arrives with the
    // answer. Leaving the notes out instead would re-engrave a different piece
    // of music and the staff would resize the moment the answer landed.
    const chord = closeChord(C, 'half-diminished-seventh')
    const asked = await show(chord, true)
    const revealed = await show(chord, false)

    expect(asked).toContain('visibility="hidden"')
    expect(revealed).not.toContain('visibility="hidden"')
    expect(size(asked)).toBe(size(revealed))
  })

  it('does not move while a chord is being written into it', async () => {
    const stages = []
    for (const count of [0, 1, 2, 3, 4]) stages.push(size(await write(count)))
    for (const stage of stages) expect(stage).toBe(stages[0])
  })

  it('reserves the same page for a chord that needs accidentals and one that does not', async () => {
    const plain = renderMei(
      chordMei({ pitches: chordPitches(closeChord(C, 'major')) ?? [], clef: 'treble' }),
      undefined,
      CHORD_ANSWER_PROFILE,
    )
    const altered = renderMei(
      chordMei({
        pitches: chordPitches(closeChord(C, 'diminished')) ?? [],
        clef: 'treble',
      }),
      undefined,
      CHORD_ANSWER_PROFILE,
    )
    expect(size(await plain)).toBe(size(await altered))
  })

  it('holds the widest chord in the vocabulary inside its page', async () => {
    // The reserve is what a player might still write — a seventh chord voiced
    // to its lowest Lage spans a tenth — so nothing may run off the right of
    // the page it is drawn on.
    const widest: Chord = { root: C, quality: 'minor-seventh', inversion: 0, top: 1 }
    const svg = await renderMei(
      chordMei({ pitches: chordPitches(widest) ?? [], clef: 'treble' }),
      undefined,
      CHORD_ANSWER_PROFILE,
    )
    const page = pixels(svg).width
    const rightmost = Math.max(
      ...[...svg.matchAll(/x="(\d+(?:\.\d+)?)"/g)].map((match) => Number(match[1])),
    )
    expect(rightmost).toBeLessThan(page * 10)
  })

  it("comes out the size the rest of the app's notation does", async () => {
    // **The one that catches a page in the wrong units.** `pageWidth` and
    // `pageHeight` are a tenth of the viewBox units a render reports, so
    // calibrating by feeding a natural viewBox size straight back in makes a
    // page ten times too big — the music drawn in one corner and the staff a
    // tenth of the size it should be. Nothing that compares one chord render
    // against another can see it, because every one of them is equally wrong.
    const meter = { beats: 4, unit: 4 } as const
    const rhythm = await renderMei(
      rhythmMei({
        meter,
        staves: [{ nodes: notateRhythm({ meter, onsets: [0, 60, 120, 180] }) }],
      }),
      undefined,
      rhythmProfile(4, 1),
    )

    const bar = pixels(rhythm)
    const chord = pixels(await write(4))

    // A chord is one event rather than a bar, so it is narrower; it is five
    // lines with ledger lines rather than one, so it is taller. Within reach
    // of a bar of rhythm either way, not an order of magnitude from it.
    expect(chord.width).toBeLessThan(bar.width)
    expect(chord.width).toBeGreaterThan(bar.width / 4)
    expect(chord.height).toBeGreaterThan(bar.height)
    expect(chord.height).toBeLessThan(bar.height * 4)
  })

  it('draws every quality without the engraver refusing one', async () => {
    const qualities: ChordQuality[] = [
      'major',
      'minor',
      'diminished',
      'augmented',
      'dominant-seventh',
      'major-seventh',
      'minor-seventh',
      'half-diminished-seventh',
    ]
    for (const quality of qualities) {
      expect(countOf(await show(closeChord(C, quality)), 'note')).toBe(
        quality.endsWith('seventh') ? 4 : 3,
      )
    }
  })
})
