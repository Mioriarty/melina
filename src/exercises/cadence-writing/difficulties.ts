import {
  CADENCE_RULE_CHOICES,
  DEFAULT_CADENCE_SETTINGS,
  type CadenceSettings,
} from '@/exercises/harmony-shared/settings'
import type { Difficulty } from '@/exercises/shared/difficulty'
import type { RuleId } from '@/lib/music/voiceLeading'

/**
 * The levels, and they are weaknesses rather than rungs — which this exercise
 * turns out to express better than any other here.
 *
 * A level names **which rules it marks**, and the families of rule are not a
 * ladder: doubling the leading note is not a harder mistake than a parallel
 * fifth, it is a different one, and a player who keeps making one is not
 * usually the player who keeps making the other. So the list runs by family,
 * each one drilling the thing an exam marker actually writes in the margin, and
 * the last level switches everything on at once.
 *
 * The rules a level leaves out are not *allowed*, they are simply not marked.
 * The generator is held to every one of them whatever a level says — see
 * `transitionCost` — so the setting a player is shown to compare against is
 * always a clean one.
 */

const MAJOR: readonly string[] = ['C:ionian', 'G:ionian', 'F:ionian', 'D:ionian']
const MINOR: readonly string[] = ['A:aeolian', 'E:aeolian', 'D:aeolian']

const PARALLELS: readonly RuleId[] = [
  'parallel-fifths',
  'parallel-octaves',
  'hidden-fifths',
  'hidden-octaves',
]
const VERTICAL: readonly RuleId[] = ['crossing', 'spacing', 'overlap']
const DOUBLING: readonly RuleId[] = ['doubled-leading-note', 'doubled-altered']
const RESOLUTION: readonly RuleId[] = [
  'unresolved-seventh',
  'unresolved-leading-note',
  'unresolved-suspension',
  'augmented-second',
]

const level = (
  id: string,
  settings: Partial<CadenceSettings>,
): Difficulty<CadenceSettings> => ({
  id,
  settings: { ...DEFAULT_CADENCE_SETTINGS, ...settings },
})

export const CADENCE_DIFFICULTIES: readonly Difficulty<CadenceSettings>[] = [
  level('parallelen', {
    keys: ['C:ionian', 'G:ionian', 'F:ionian'],
    chords: [4],
    cadences: ['ganzschluss-vollkommen', 'halbschluss'],
    blocks: [],
    lagen: ['root'],
    rules: PARALLELS,
  }),
  level('abstand', {
    keys: ['C:ionian', 'G:ionian', 'F:ionian'],
    chords: [4],
    cadences: ['ganzschluss-vollkommen', 'halbschluss', 'plagalschluss'],
    blocks: [],
    lagen: ['root', 'third'],
    rules: VERTICAL,
  }),
  level('verdopplung', {
    keys: MAJOR,
    chords: [4],
    cadences: ['ganzschluss-vollkommen', 'ganzschluss-unvollkommen', 'trugschluss'],
    blocks: ['tonika-prolongation'],
    lagen: ['root', 'third', 'fifth'],
    rules: DOUBLING,
  }),
  level('aufloesungen', {
    // The suspension cadence and the Trugschluss are here because this is the
    // level about what a dissonance owes: a Quartsextvorhalt that does not
    // resolve is the fault, and a level that never generated one could not ask
    // about it.
    keys: MAJOR,
    chords: [4, 5],
    cadences: ['kadenz-quartsext', 'ganzschluss-vollkommen', 'trugschluss'],
    blocks: ['zwischendominante'],
    lagen: ['root', 'third', 'fifth'],
    rules: RESOLUTION,
  }),
  level('lagen', {
    keys: MAJOR,
    chords: [4],
    cadences: ['ganzschluss-vollkommen', 'ganzschluss-unvollkommen', 'halbschluss'],
    blocks: ['tonika-prolongation', 'tonika-sextakkord'],
    lagen: ['root', 'third', 'fifth'],
    rules: CADENCE_RULE_CHOICES,
  }),
  level('moll', {
    keys: MINOR,
    chords: [4, 5],
    cadences: ['ganzschluss-vollkommen', 'phrygischer-halbschluss', 'trugschluss'],
    blocks: ['tonika-prolongation', 'subdominant-prolongation'],
    lagen: ['root', 'third', 'fifth'],
    rules: CADENCE_RULE_CHOICES,
  }),
  level('alles', {
    keys: [...MAJOR, ...MINOR],
    chords: [4, 5],
    cadences: [
      'ganzschluss-vollkommen',
      'ganzschluss-unvollkommen',
      'kadenz-quartsext',
      'halbschluss',
      'trugschluss',
      'plagalschluss',
    ],
    blocks: [
      'tonika-prolongation',
      'tonika-sextakkord',
      'zwischendominante',
      'quintfall',
    ],
    lagen: ['root', 'third', 'fifth'],
    rules: CADENCE_RULE_CHOICES,
  }),
]
