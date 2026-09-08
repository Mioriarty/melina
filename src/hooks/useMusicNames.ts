import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { InstrumentId } from '@/lib/audio/instruments'
import type { ClefId } from '@/lib/music/clef'
import type { PlayDirection } from '@/lib/music/direction'
import type { Interval, IntervalQuality } from '@/lib/music/interval'
import type { KeySignatureId } from '@/lib/music/keySignature'
import type { Pitch } from '@/lib/music/pitch'
import type { ModeId } from '@/lib/music/scale'

/**
 * The names of the things `lib/music` models.
 *
 * The theory itself is language-neutral — a perfect fifth is seven semitones
 * in any tongue — so the data files carry ids and arithmetic only, and every
 * word a player reads comes from the `music` namespace. That is not
 * cosmetic: German names the seventh white key H, calls B♭ major "B-Dur",
 * and inflects the quality of an interval ("reine Quinte"), none of which
 * survives a sentence built by concatenating English pieces.
 *
 * A hook rather than bare functions so the labels re-render when the language
 * changes, and so nothing has to reach for a global i18next instance.
 */
export interface MusicNames {
  /** Short form for a chip or a tooltip: `Treble`. */
  clef: (id: ClefId) => string
  /** Spoken form for a screen reader: `treble clef`. */
  clefSpoken: (id: ClefId) => string
  /** Tonic alone: `B♭`, or `B` in German. */
  keyMajor: (id: KeySignatureId) => string
  /** Relative minor tonic: `Gm`, or `g` in German. */
  keyMinor: (id: KeySignatureId) => string
  /** Full name of the major key: `B♭ major`, `B-Dur`. */
  keyMajorName: (id: KeySignatureId) => string
  /** Both keys the signature can mean: `B♭ major, G minor`. */
  keyName: (id: KeySignatureId) => string
  direction: (id: PlayDirection) => string
  directionHint: (id: PlayDirection) => string
  instrument: (id: InstrumentId) => string
  instrumentHint: (id: InstrumentId) => string
  /** Standalone quality, as on a keyboard key: `Perfect`. */
  quality: (quality: IntervalQuality) => string
  /** Compact form for narrow screens: `Perf`. */
  qualityShort: (quality: IntervalQuality) => string
  /** Interval number on its own, as a row heading: `Fifth`. */
  number: (number: number) => string
  /** The whole interval: `Perfect fifth`, `reine Quinte`. */
  interval: (interval: Interval) => string
  /** Spoken pitch for a screen reader: `F sharp 4`. */
  pitchSpoken: (pitch: Pitch) => string
  /** The mode alone: `Dorian`, `Dorisch`. */
  mode: (id: ModeId) => string
  /** Compact form for a summary chip: `Dor`. */
  modeShort: (id: ModeId) => string
  /**
   * The mode with the name it is better known by, where it has one:
   * `Ionian (Major)`. Empty for the five that do not.
   */
  modeAlias: (id: ModeId) => string
  /** Both together for a screen reader, falling back to the mode alone. */
  modeFull: (id: ModeId) => string
  /**
   * A tonic. Not a letter and a symbol glued together: German calls the
   * seventh letter H and B flat simply B, so this is a lookup, not a rule.
   */
  tonic: (key: string) => string
  /** How a scale is played. Worded for a scale, not for an interval. */
  scaleDirection: (id: 'ascending' | 'descending') => string
  scaleDirectionHint: (id: 'ascending' | 'descending') => string
}

export function useMusicNames(): MusicNames {
  const { t } = useTranslation('music')

  return useMemo<MusicNames>(() => {
    const number = (value: number) =>
      t(`ordinals.${value}`, { defaultValue: t('ordinalFallback', { number: value }) })

    return {
      clef: (id) => t(`clefs.${id}.label`),
      clefSpoken: (id) => t(`clefs.${id}.spoken`),
      keyMajor: (id) => t(`keySignatures.${id}.major`),
      keyMinor: (id) => t(`keySignatures.${id}.minor`),
      keyMajorName: (id) => t(`keySignatures.${id}.majorName`),
      keyName: (id) =>
        t('keySignatureName', {
          major: t(`keySignatures.${id}.majorName`),
          minor: t(`keySignatures.${id}.minorName`),
        }),
      direction: (id) => t(`directions.${id}.label`),
      directionHint: (id) => t(`directions.${id}.hint`),
      instrument: (id) => t(`instruments.${id}.label`),
      instrumentHint: (id) => t(`instruments.${id}.hint`),
      quality: (quality) => t(`qualities.${quality}`),
      qualityShort: (quality) => t(`qualitiesShort.${quality}`),
      number,
      interval: (interval) =>
        t('intervalName', {
          quality: t(`qualitiesInName.${interval.quality}`),
          number: t(`ordinalsInName.${interval.number}`, {
            defaultValue: t('ordinalFallback', { number: interval.number }),
          }),
        }),
      pitchSpoken: (pitch) =>
        t('pitch.spoken', {
          letter: t(`pitch.letters.${pitch.letter}`),
          alteration: t(`pitch.alterations.${pitch.alteration}`),
          octave: pitch.octave,
        }),
      mode: (id) => t(`modes.${id}.label`),
      modeShort: (id) => t(`modes.${id}.short`),
      modeAlias: (id) => t(`modes.${id}.alias`, { defaultValue: '' }),
      modeFull: (id) => {
        const alias = t(`modes.${id}.alias`, { defaultValue: '' })
        return alias === ''
          ? t(`modes.${id}.label`)
          : t('modeWithAlias', { mode: t(`modes.${id}.label`), alias })
      },
      tonic: (key) => t(`tonics.${key}`, { defaultValue: key }),
      scaleDirection: (id) => t(`scaleDirections.${id}.label`),
      scaleDirectionHint: (id) => t(`scaleDirections.${id}.hint`),
    }
  }, [t])
}
