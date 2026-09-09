// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { CLEFS } from '@/lib/music/clef'
import { DEGREE_NUMBERS, degreePitch, keySignatureFor } from '@/lib/music/degree'
import { KEY_SIGNATURES } from '@/lib/music/keySignature'
import { parsePitch, type Pitch } from '@/lib/music/pitch'
import { scalePitches } from '@/lib/music/scale'

import { degreeKeyMei, melodyMei } from './mei'
import { DEGREE_KEY_PROFILE, melodyProfile, renderMei } from './verovio'

/**
 * The engraver against a written-down melody and the keys it is written with.
 *
 * In the node environment for the same reason as the other two: the toolkit is
 * 7 MB of WebAssembly that jsdom cannot instantiate.
 */

function p(text: string): Pitch {
  const value = parsePitch(text)
  if (value === undefined) throw new Error(text)
  return value
}

const E_MAJOR = scalePitches(p('E4'), 'ionian') as readonly Pitch[]

const countOf = (svg: string, name: string) =>
  (svg.match(new RegExp(`class="[^"]*\\b${name}\\b`, 'g')) ?? []).length

/**
 * Accidentals actually **drawn** in front of a note.
 *
 * Verovio emits an empty `accid` group for a gestural accidental too — the
 * silent kind a key signature has already accounted for — so the group being
 * there says nothing. Only a glyph inside it does.
 */
const printedAccidentals = (svg: string) =>
  (svg.match(/<g[^>]*class="accid"[^>]*>\s*<use/g) ?? []).length

/** Accidentals drawn as part of the key signature itself. */
const signatureAccidentals = (svg: string) => countOf(svg, 'keyAccid')

/** Which accidental glyphs were drawn in front of notes, in order. */
const accidentalGlyphs = (svg: string) =>
  [
    ...svg.matchAll(/<g[^>]*class="accid"[^>]*>\s*<use[^>]*href="#(E[0-9A-F]{3})[^"]*"/g),
  ].map(([, glyph]) => glyph)

/** SMuFL, so a failure names the glyph rather than a codepoint. */
const NATURAL = 'E261'
const SHARP = 'E262'
const DOUBLE_SHARP = 'E263'
const NATURAL_SHARP = 'E268'

function size(svg: string): string {
  return svg.match(/<svg[^>]*?width="(\d+)px"[^>]*?height="(\d+)px"/)?.[0] ?? ''
}

function melody(pitches: readonly Pitch[], slots: number) {
  return melodyMei({
    clef: 'treble',
    keySignature: '4s',
    slots,
    staves: [{ pitches }],
  })
}

describe('a melody on the page', () => {
  it('engraves the notes it was given, under its key signature', async () => {
    const svg = await renderMei(
      melody(E_MAJOR.slice(0, 4), 4),
      undefined,
      melodyProfile(4, 1),
    )

    expect(countOf(svg, 'notehead')).toBe(4)
    // Four sharps drawn in the signature, and no accidental on any note, since
    // all four notes agree with it.
    expect(signatureAccidentals(svg)).toBe(4)
    expect(printedAccidentals(svg)).toBe(0)
  })

  it('prints an accidental only where a note leaves the key', async () => {
    // The whole point of writing under a signature: what is printed is what is
    // *unexpected*, which is exactly what an altered degree is.
    const plain = await renderMei(melody([p('F#4')], 1), undefined, melodyProfile(1, 1))
    expect(printedAccidentals(plain)).toBe(0)

    const raised = await renderMei(melody([p('F##4')], 1), undefined, melodyProfile(1, 1))
    expect(printedAccidentals(raised)).toBe(1)

    const natural = await renderMei(melody([p('F4')], 1), undefined, melodyProfile(1, 1))
    expect(printedAccidentals(natural)).toBe(1)
  })

  it('renders every stage of an answer at exactly the same size', async () => {
    // The regression guard for the staff moving under the player's hands, the
    // same one the rhythm staff has. `<space>` padding keeps the measure its
    // full length; the fixed page keeps the box constant.
    const slots = 5
    const sizes: string[] = []

    for (let written = 0; written <= slots; written += 1) {
      sizes.push(
        size(
          await renderMei(
            melody(E_MAJOR.slice(0, written), slots),
            undefined,
            melodyProfile(slots, 1),
          ),
        ),
      )
    }

    for (const stage of sizes) expect(stage).toBe(sizes[0])
    expect(sizes[0]).not.toBe('')
  })

  it('leaves the notes already written exactly where they were', async () => {
    const slots = 5
    const positions = (svg: string) =>
      [...svg.matchAll(/class="notehead"[^>]*>\s*<use[^>]*translate\((\d+),/g)].map(
        (match) => match[1],
      )

    let previous: string[] = []
    for (let written = 1; written <= slots; written += 1) {
      const current = positions(
        await renderMei(
          melody(E_MAJOR.slice(0, written), slots),
          undefined,
          melodyProfile(slots, 1),
        ),
      ) as string[]
      expect(current.slice(0, previous.length)).toEqual(previous)
      previous = current
    }
    expect(previous).toHaveLength(slots)
  })

  it('spreads the melody across the staff rather than leaving it in one corner', async () => {
    // The page is reserved for the worst case — the longest melody under seven
    // accidentals, every note carrying one — so a plain key used barely half of
    // it and the notes sat hard left with empty staff beside them. Stretching
    // the system to the page fills it, and here that costs nothing: the measure
    // holds one event per slot from the first keypress, so the notes keep the
    // same x throughout, which the test above holds to.
    const slots = 4
    const svg = await renderMei(
      melody(E_MAJOR.slice(0, slots), slots),
      undefined,
      melodyProfile(slots, 1),
    )
    const page = Number(svg.match(/viewBox="0 0 (\d+)/)?.[1] ?? 0)
    const heads = [
      ...svg.matchAll(/class="notehead"[^>]*>\s*<use[^>]*translate\((\d+),/g),
    ].map((match) => Number(match[1]))

    expect(heads).toHaveLength(slots)
    expect((heads.at(-1) as number) / page).toBeGreaterThan(0.7)
  })

  it('holds the widest answer a level could ask for, in every metre of key', async () => {
    // Sized for the worst case there is: the longest melody, the widest key
    // signature, and every note carrying an accidental of its own.
    const loaded = ['C#4', 'D#4', 'E#4', 'F##4', 'G#4', 'A#4'].map(p)

    for (const slots of [2, 4, 6]) {
      for (const signature of KEY_SIGNATURES) {
        const svg = await renderMei(
          melodyMei({
            clef: 'treble',
            keySignature: signature.id,
            slots,
            staves: [{ pitches: loaded.slice(0, slots) }],
          }),
          undefined,
          melodyProfile(slots, 1),
        )

        expect(
          (svg.match(/class="system"/g) ?? []).length,
          `${slots} ${signature.id}`,
        ).toBe(1)

        const page = Number(svg.match(/viewBox="0 0 (\d+)/)?.[1] ?? 0)
        const rightmost = Math.max(
          ...[...svg.matchAll(/translate\((-?\d+),/g)].map((match) => Number(match[1])),
        )
        expect(rightmost, `${slots} slots under ${signature.id} overflows`).toBeLessThan(
          page,
        )
      }
    }
  })

  it('stacks a wrong answer over the right one, aligned', async () => {
    const svg = await renderMei(
      melodyMei({
        clef: 'treble',
        keySignature: '4s',
        slots: 4,
        staves: [
          { pitches: E_MAJOR.slice(0, 4), label: 'You' },
          { pitches: E_MAJOR.slice(1, 5), label: 'Correct' },
        ],
      }),
      undefined,
      melodyProfile(4, 2),
    )

    expect(countOf(svg, 'staff')).toBe(2)
    // One measure, so the barlines line up and note four sits above note four.
    expect(countOf(svg, 'measure')).toBe(1)
    expect(svg).toContain('You')
    expect(svg).toContain('Correct')
  })
})

describe('an accidental already standing in the bar', () => {
  /**
   * B major: A is sharp in the signature, which is what makes it the key the
   * screenshot came from — every A in the bar is a sharp until something says
   * otherwise.
   */
  const inBMajor = (pitches: readonly Pitch[]) =>
    melodyMei({
      clef: 'treble',
      keySignature: '5s',
      slots: pitches.length,
      staves: [{ pitches }],
    })

  const drawn = async (pitches: readonly Pitch[]) =>
    accidentalGlyphs(
      await renderMei(inBMajor(pitches), undefined, melodyProfile(pitches.length, 1)),
    )

  it('is not printed a second time on the same note', async () => {
    // The signature has already said it, and saying it again on every note is
    // not how a bar is written.
    expect(await drawn([p('A#4'), p('A#4')])).toEqual([])
  })

  it('is taken back before a different one on the same staff position', async () => {
    // The bug this exists for: an accidental holds until the barline, so the
    // double sharp was still in force and the A sharp after it printed nothing
    // — which reads as a second A double sharp, a whole tone off.
    expect(await drawn([p('A##4'), p('A#4')])).toEqual([DOUBLE_SHARP, NATURAL_SHARP])
  })

  it('gives a natural back to a note the signature had sharpened', async () => {
    expect(await drawn([p('A4')])).toEqual([NATURAL])
    // And once naturalled, the sharp has to be asked for again.
    expect(await drawn([p('A4'), p('A#4')])).toEqual([NATURAL, SHARP])
  })

  it('does not reach a note of the same letter in another octave', async () => {
    // An accidental applies to the staff position it sits on, not to the
    // letter everywhere.
    expect(await drawn([p('A##4'), p('A#5')])).toEqual([DOUBLE_SHARP])
  })

  it('starts again on the other staff of a comparison', async () => {
    // Each staff is its own line of music; what was written on one says
    // nothing about the other.
    const svg = await renderMei(
      melodyMei({
        clef: 'treble',
        keySignature: '5s',
        slots: 2,
        staves: [
          { pitches: [p('A##4'), p('A#4')], label: 'You' },
          { pitches: [p('A#4'), p('A#4')], label: 'Correct' },
        ],
      }),
      undefined,
      melodyProfile(2, 2),
    )
    expect(accidentalGlyphs(svg)).toEqual([DOUBLE_SHARP, NATURAL_SHARP])
  })
})

describe('a key on the degree keyboard', () => {
  const keyMei = (pitch: Pitch) =>
    degreeKeyMei({ pitch, clef: 'treble', keySignature: '4s' })

  it('draws the note on a bare staff, with no clef and no signature', async () => {
    // The staff above already carries both, and repeating them on seven small
    // keys leaves no room for the note itself.
    const svg = await renderMei(keyMei(p('G#4')), undefined, DEGREE_KEY_PROFILE)

    expect(countOf(svg, 'notehead')).toBe(1)
    // Verovio marks them hidden rather than leaving them out, so what says they
    // are gone is that nothing inside them was drawn.
    expect(svg).toMatch(/class="clef" visibility="hidden"/)
    expect(svg).toMatch(/class="keySig" visibility="hidden"/)
    expect(signatureAccidentals(svg)).toBe(0)
  })

  it('keeps the signature in force even though it is not drawn', async () => {
    // A degree that agrees with the key is a plain notehead; only one raised or
    // lowered out of it prints anything. That is the whole reading of the key.
    const inKey = await renderMei(keyMei(p('G#4')), undefined, DEGREE_KEY_PROFILE)
    expect(printedAccidentals(inKey)).toBe(0)

    const raised = await renderMei(keyMei(p('G##4')), undefined, DEGREE_KEY_PROFILE)
    expect(printedAccidentals(raised)).toBe(1)

    const lowered = await renderMei(keyMei(p('G4')), undefined, DEGREE_KEY_PROFILE)
    expect(printedAccidentals(lowered)).toBe(1)
  })

  it('draws every key of one keyboard at the same size', async () => {
    // Seven keys side by side have to line up. Left to itself the page shrinks
    // to its content, and a key printing an accidental would come out larger
    // than the one beside it.
    //
    // One keyboard is the property: a different clef is a different keyboard,
    // and checking every clef costs four times the renders to say no more.
    const tonic = p('C4')
    const signature = keySignatureFor(tonic, 'ionian') as string
    const sizes = new Set<string>()

    for (const number of DEGREE_NUMBERS) {
      for (const alteration of [-1, 0, 1] as const) {
        const pitch = degreePitch(tonic, 'ionian', { number, alteration })
        if (pitch === undefined) continue

        sizes.add(
          size(
            await renderMei(
              degreeKeyMei({ pitch, clef: 'treble', keySignature: signature as never }),
              undefined,
              DEGREE_KEY_PROFILE,
            ),
          ),
        )
      }
    }

    expect(sizes.size).toBe(1)
  })

  it('draws the stem, like any other note', async () => {
    const svg = await renderMei(keyMei(p('G#4')), undefined, DEGREE_KEY_PROFILE)

    expect(countOf(svg, 'notehead')).toBe(1)
    expect(countOf(svg, 'stem')).toBe(1)
  })

  it('never lets a note run off its key, in any clef', async () => {
    // The lowest degree of each clef is the one that would fall through the
    // bottom of the page if it were sized too tightly.
    for (const clef of CLEFS) {
      const tonic = { ...p('C4'), octave: clef.id === 'bass' ? 3 : 4 }
      const signature = keySignatureFor(tonic, 'ionian')
      if (signature === undefined) continue

      for (const number of [1, 4, 7]) {
        const pitch = degreePitch(tonic, 'ionian', { number, alteration: -1 })
        if (pitch === undefined) continue

        const svg = await renderMei(
          degreeKeyMei({ pitch, clef: clef.id, keySignature: signature }),
          undefined,
          DEGREE_KEY_PROFILE,
        )

        const page = Number(svg.match(/viewBox="0 0 (\d+) (\d+)"/)?.[2] ?? 0)
        const lowest = Math.max(
          ...[...svg.matchAll(/translate\(-?\d+,\s*(-?\d+)\)/g)].map((m) => Number(m[1])),
        )
        expect(lowest, `${clef.id} degree ${number}`).toBeLessThan(page)
      }
    }
  })
})
