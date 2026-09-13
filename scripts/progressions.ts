/**
 * Print generated progressions as text.
 *
 * Judging a harmony generator by ear through the UI is a slow loop; judging
 * fifty of them as text in a terminal is a fast one, and it is where the block
 * weights actually get tuned. Run with:
 *
 *     npx vite-node scripts/progressions.ts -- [count]
 */
import { createRandom } from '../src/lib/utils/seededRandom'
import { eventFigure, eventStufe, type HarmonicEvent } from '../src/lib/music/harmony'
import { figureText } from '../src/lib/notation/figureNotation'
import { KEY_CHOICES, keyKey, type Key } from '../src/lib/music/key'
import {
  DEFAULT_METER,
  generateProgression,
  type Progression,
  type ProgressionSpec,
} from '../src/lib/music/progression'
import { tonicKey } from '../src/lib/music/scale'
import { voiceProgression } from '../src/lib/music/satb'
import { satzFindings, VOICES } from '../src/lib/music/voiceLeading'
import { pitchKey } from '../src/lib/music/pitch'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

function stufeText(key: Key, event: HarmonicEvent): string {
  const stufe = eventStufe(key, event)
  if (stufe === undefined) return '?'
  const numeral = ROMAN[stufe.number - 1] ?? '?'
  const sign = stufe.alteration > 0 ? '#' : stufe.alteration < 0 ? 'b' : ''
  const lower = [
    'minor',
    'minor-seventh',
    'diminished',
    'diminished-seventh',
    'half-diminished-seventh',
  ].includes(stufe.quality)
  const mark =
    stufe.quality === 'diminished' || stufe.quality === 'diminished-seventh'
      ? 'o'
      : stufe.quality === 'half-diminished-seventh'
        ? '0'
        : stufe.quality === 'augmented'
          ? '+'
          : ''
  const seventh = stufe.quality.includes('seventh') ? '7' : ''
  const inversion = stufe.inversion === 0 ? '' : `/${stufe.inversion}`
  return `${sign}${lower ? numeral.toLowerCase() : numeral}${mark}${seventh}${inversion}`
}

function show(progression: Progression): string {
  const { key, events } = progression
  const lines: string[] = []

  const bass: string[] = []
  const figures: string[] = []
  const stufen: string[] = []

  let previous: HarmonicEvent | undefined
  for (const event of events) {
    const figure = eventFigure(key, event, previous)
    const text = figure === undefined ? '?' : figureText(figure)
    bass.push(event.held === true ? '”' : tonicKey(event.bass))
    figures.push(text === '' ? '—' : text)
    stufen.push(stufeText(key, event))
    previous = event
  }

  const width = events.map((_, i) =>
    Math.max(bass[i]?.length ?? 0, figures[i]?.length ?? 0, stufen[i]?.length ?? 0, 4),
  )
  const row = (cells: string[]) => cells.map((c, i) => c.padEnd(width[i] ?? 4)).join(' ')

  lines.push(`  Stufen   ${row(stufen)}`)
  lines.push(`  Bass     ${row(bass)}`)
  lines.push(`  Ziffern  ${row(figures)}`)
  const satz = voiceProgression(progression, { constraints: progression.constraints })
  if (satz === undefined) {
    lines.push('  SATB     — could not be set —')
  } else {
    for (const voice of VOICES) {
      lines.push(
        `  ${voice.padEnd(8)} ${row(satz.voicings.map((v) => pitchKey(v[voice])))}`,
      )
    }
    const faults = satzFindings(satz)
    if (faults.length > 0) {
      lines.push(
        `  FINDINGS ${faults.map((f) => `${f.severity === 'error' ? '!!' : '~'}${f.id}@${f.at}`).join(' ')}`,
      )
    }
  }

  lines.push(
    `  Analyse  ${progression.analysis
      .map(
        (span) =>
          `${span.id}${span.links > 1 ? `×${span.links}` : ''}[${span.from}-${span.to}]`,
      )
      .join(' → ')}`,
  )
  return lines.join('\n')
}

const SPEC: ProgressionSpec = {
  keys: KEY_CHOICES,
  chords: [6, 7, 8],
  cadences: [
    'ganzschluss-vollkommen',
    'ganzschluss-unvollkommen',
    'kadenz-quartsext',
    'halbschluss',
    'phrygischer-halbschluss',
    'trugschluss',
    'plagalschluss',
  ],
  blocks: [
    'tonika-prolongation',
    'tonika-sextakkord',
    'dominant-prolongation',
    'subdominant-prolongation',
    'durchgangs-quartsext',
    'wechsel-quartsext',
    'quintfall',
    'quintfall-septakkorde',
    'quintanstieg',
    'monte',
    'fonte',
    'fauxbourdon',
    'zwischendominante',
    'doppeldominante',
    'neapolitaner',
  ],
  freeWeight: 1,
  meter: DEFAULT_METER,
}

const count = Number(process.argv[2] ?? 12)
const random = createRandom(20260913)
let failures = 0

for (let i = 0; i < count; i += 1) {
  const progression = generateProgression(random, SPEC)
  if (progression === undefined) {
    failures += 1
    continue
  }
  console.log(
    `\n${i + 1}. ${keyKey(progression.key)}  (${progression.events.length} events)`,
  )
  console.log(show(progression))
}

console.log(`\n${failures} of ${count} failed to generate.`)
