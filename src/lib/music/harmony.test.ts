import { describe, expect, it } from 'vitest'

import { tonicKey, type PitchClass } from './scale'
import {
  appliedKey,
  buildEvents,
  eventChord,
  eventFigure,
  eventNotes,
  eventStufe,
  eventsKey,
  parseEvents,
  specChord,
  type ChordSpec,
  type HarmonicEvent,
} from './harmony'
import { figureKey } from './figuredBass'
import { KEY_CHOICES, keyKey, type Key } from './key'

const C_MAJOR: Key = { tonic: { letter: 'C', alteration: 0 }, mode: 'ionian' }
const C_MINOR: Key = { tonic: { letter: 'C', alteration: 0 }, mode: 'aeolian' }

const notes = (list: readonly PitchClass[]) => list.map(tonicKey)
const spec = (partial: Partial<ChordSpec> & { degree: number }): ChordSpec => ({
  inversion: 0,
  beats: 2,
  ...partial,
})

const only = (key: Key, value: ChordSpec): HarmonicEvent => {
  const built = buildEvents(key, value)
  expect(built).toHaveLength(1)
  return built?.[0] as HarmonicEvent
}

describe('specChord', () => {
  it('spells the diatonic triads of a major key', () => {
    const qualities = [1, 2, 3, 4, 5, 6, 7].map(
      (degree) => specChord(C_MAJOR, spec({ degree }))?.quality,
    )
    expect(qualities).toEqual([
      'major',
      'minor',
      'minor',
      'major',
      'major',
      'minor',
      'diminished',
    ])
  })

  it('raises the leading note on the dominant and the leading-note chord of a minor key', () => {
    // The one convention table in the file, and this is what it buys: four
    // chords come out right from one rule about two degrees.
    expect(specChord(C_MINOR, spec({ degree: 5 }))?.quality).toBe('major')
    expect(specChord(C_MINOR, spec({ degree: 5, seventh: true }))?.quality).toBe(
      'dominant-seventh',
    )
    expect(specChord(C_MINOR, spec({ degree: 7 }))?.quality).toBe('diminished')
    expect(specChord(C_MINOR, spec({ degree: 7, seventh: true }))?.quality).toBe(
      'diminished-seventh',
    )
  })

  it('leaves the other degrees of a minor key alone', () => {
    expect(specChord(C_MINOR, spec({ degree: 1 }))?.quality).toBe('minor')
    expect(specChord(C_MINOR, spec({ degree: 4 }))?.quality).toBe('minor')
    const third = specChord(C_MINOR, spec({ degree: 3 }))
    expect(third?.quality).toBe('major')
    expect(tonicKey(third?.root as PitchClass)).toBe('Eb')
  })

  it('refuses an altered root that does not say what it is building', () => {
    expect(specChord(C_MINOR, spec({ degree: 2, alteration: -1 }))).toBeUndefined()
    const neapolitan = specChord(
      C_MINOR,
      spec({ degree: 2, alteration: -1, quality: 'major' }),
    )
    expect(tonicKey(neapolitan?.root as PitchClass)).toBe('Db')
  })
})

describe('appliedKey', () => {
  it('reads the region off the key’s own triad', () => {
    expect(keyKey(appliedKey(C_MAJOR, 5) as Key)).toBe('G:ionian')
    expect(keyKey(appliedKey(C_MAJOR, 2) as Key)).toBe('D:aeolian')
    expect(keyKey(appliedKey(C_MAJOR, 6) as Key)).toBe('A:aeolian')
  })

  it('is no region at all on a diminished degree', () => {
    expect(appliedKey(C_MAJOR, 7)).toBeUndefined()
  })

  it('spells the secondary dominants', () => {
    const dd = specChord(C_MAJOR, spec({ degree: 5, of: 5, seventh: true }))
    expect(dd?.quality).toBe('dominant-seventh')
    expect(tonicKey(dd?.root as PitchClass)).toBe('D')

    // V/vi is E major: the dominant of a minor region raises its own seventh.
    const ofVi = specChord(C_MAJOR, spec({ degree: 5, of: 6 }))
    expect(ofVi?.quality).toBe('major')
    expect(tonicKey(ofVi?.root as PitchClass)).toBe('E')
  })
})

describe('buildEvents', () => {
  it('puts the named member in the bass', () => {
    expect(notes(eventNotes(only(C_MAJOR, spec({ degree: 1 }))))).toEqual(['C', 'E', 'G'])
    expect(notes(eventNotes(only(C_MAJOR, spec({ degree: 1, inversion: 1 }))))).toEqual([
      'E',
      'G',
      'C',
    ])
  })

  it('writes a suspension as two sonorities over one bass', () => {
    const built = buildEvents(C_MAJOR, spec({ degree: 5, suspend: [6, 4], beats: 2 }))
    expect(built).toHaveLength(2)
    const [held, resolved] = built as [HarmonicEvent, HarmonicEvent]

    expect(tonicKey(held.bass)).toBe('G')
    expect(notes(held.upper)).toEqual(['E', 'C'])
    expect(notes(resolved.upper)).toEqual(['D', 'B'])
    // The bass is struck once and rings under both halves.
    expect(held.held).toBeUndefined()
    expect(resolved.held).toBe(true)
    expect(held.ticks + resolved.ticks).toBe(120)
  })

  it('figures the cadential six-four the way it is written', () => {
    const built = buildEvents(C_MAJOR, spec({ degree: 5, suspend: [6, 4] })) ?? []
    const [held, resolved] = built as [HarmonicEvent, HarmonicEvent]
    expect(figureKey(eventFigure(C_MAJOR, held) ?? { signs: [] })).toBe('6/4')
    expect(figureKey(eventFigure(C_MAJOR, resolved, held) ?? { signs: [] })).toBe('5/3')
  })

  it('refuses a suspension the chord has no room for', () => {
    // There is no 7 to suspend over a plain triad's 6th in root position.
    expect(buildEvents(C_MAJOR, spec({ degree: 1, suspend: [7] }))).toBeUndefined()
  })
})

describe('the readings', () => {
  it('reads the Stufe back to the step the plan asked for', () => {
    for (const key of [C_MAJOR, C_MINOR]) {
      for (const degree of [1, 2, 3, 4, 5, 6, 7]) {
        for (const inversion of [0, 1, 2]) {
          const event = only(key, spec({ degree, inversion }))
          const stufe = eventStufe(key, event)
          expect(stufe?.number, `${keyKey(key)} degree ${degree}`).toBe(degree)
          expect(stufe?.inversion).toBe(inversion)
          // The leading-note chord of a minor key stands on the *raised*
          // seventh, and the model says so rather than hiding it: that is
          // exactly what tells vii° apart from ♭VII, which leaves it alone.
          const raised = key.mode === 'aeolian' && degree === 7 ? 1 : 0
          expect(stufe?.alteration).toBe(raised)
        }
      }
    }
  })

  it('reads a Neapolitan back as a flattened second', () => {
    const event = only(
      C_MINOR,
      spec({ degree: 2, alteration: -1, quality: 'major', inversion: 1 }),
    )
    const stufe = eventStufe(C_MINOR, event)
    expect(stufe?.number).toBe(2)
    expect(stufe?.alteration).toBe(-1)
    expect(stufe?.quality).toBe('major')
    expect(stufe?.inversion).toBe(1)
  })

  it('names the chord every plain triad and seventh spells', () => {
    const event = only(C_MAJOR, spec({ degree: 5, seventh: true, inversion: 2 }))
    const chord = eventChord(event)
    expect(tonicKey(chord?.root as PitchClass)).toBe('G')
    expect(chord?.quality).toBe('dominant-seventh')
    expect(chord?.inversion).toBe(2)
  })
})

describe('the stored form', () => {
  it('round-trips every chord the model can build, in every key', () => {
    for (const key of KEY_CHOICES) {
      for (const degree of [1, 2, 3, 4, 5, 6, 7]) {
        for (const seventh of [false, true]) {
          for (const inversion of [0, 1, 2]) {
            const events = buildEvents(key, spec({ degree, seventh, inversion }))
            if (events === undefined) continue

            const stored = eventsKey(key, events)
            expect(stored, `${keyKey(key)} ${degree}`).toBeDefined()

            const read = parseEvents(key, stored as NonNullable<typeof stored>)
            expect(read, `${keyKey(key)} ${degree}`).toBeDefined()
            expect(read?.map((event) => notes(eventNotes(event)))).toEqual(
              events.map((event) => notes(eventNotes(event))),
            )
            expect(read?.map((event) => event.ticks)).toEqual(
              events.map((event) => event.ticks),
            )
          }
        }
      }
    }
  })

  it('round-trips a suspension, bass held and all', () => {
    const events = buildEvents(C_MINOR, spec({ degree: 5, suspend: [6, 4] })) ?? []
    const stored = eventsKey(C_MINOR, events)
    expect(stored?.bass).toBe('G')
    expect(stored?.figures).toContain('-')

    const read = parseEvents(C_MINOR, stored as NonNullable<typeof stored>)
    expect(read?.map((event) => notes(eventNotes(event)))).toEqual(
      events.map((event) => notes(eventNotes(event))),
    )
    expect(read?.[1]?.held).toBe(true)
  })
})
