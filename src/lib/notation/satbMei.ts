import { TICKS_PER_BEAT } from '@/lib/music/meter'
import { meiKeySignature, type KeySignatureId } from '@/lib/music/keySignature'
import type { Pitch } from '@/lib/music/pitch'
import type { Figure } from '@/lib/music/figuredBass'
import { VOICES, type VoiceId, type Voicing } from '@/lib/music/voiceLeading'

import { accidentalAttributes } from './mei'
import { figureLines } from './figureNotation'

/**
 * A four-part setting on a grand staff.
 *
 * **Two voices to a staff, and that is the new thing here.** Every other
 * engraving in melina puts one `<layer>` on a staff; a chorale needs two, with
 * the stems of the upper voice up and the lower voice down, or the two lines
 * cannot be read apart. Verovio handles it, but nothing in this app had asked
 * it to before — which is why `satbVerovio.test.ts` pins what comes out rather
 * than trusting it.
 *
 * **One measure per chord, with every barline invisible**, exactly as
 * `thoroughbassMei` does. A generated progression is a succession of
 * sonorities rather than a piece of music: there is no metre worth declaring,
 * and a time signature drawn at the front would be claiming one.
 *
 * Under the staff go up to three rows of analysis — the figures, the Stufen
 * and the Funktionen — which is Karlsruhe's own exam task (*"entweder in
 * Generalbassziffern oder in Funktionszeichen oder in Stufenzeichen"*) with
 * all three answers printed at once, each derived from the same events.
 */

/** Which staff and stem direction each voice takes. */
const PARTS: Readonly<
  Record<VoiceId, { staff: number; layer: number; stem: 'up' | 'down' }>
> = {
  soprano: { staff: 1, layer: 1, stem: 'up' },
  alto: { staff: 1, layer: 2, stem: 'down' },
  tenor: { staff: 2, layer: 1, stem: 'up' },
  bass: { staff: 2, layer: 2, stem: 'down' },
}

const HIDDEN = ' visible="false"'

/**
 * The note value a span of ticks is written as.
 *
 * A progression only ever uses whole, half and quarter notes — two beats to a
 * chord and four at a cadence, halved where a suspension divides one — so this
 * is a small table rather than the rhythm engine. Anything unexpected falls
 * back to a half note, which keeps the measure drawable rather than empty.
 */
function duration(ticks: number): { dur: string; dots: string } {
  const beats = ticks / TICKS_PER_BEAT
  if (beats >= 4) return { dur: '1', dots: '' }
  if (beats >= 3) return { dur: '2', dots: ' dots="1"' }
  if (beats >= 2) return { dur: '2', dots: '' }
  if (beats >= 1) return { dur: '4', dots: '' }
  return { dur: '8', dots: '' }
}

function voiceNote(
  value: Pitch,
  keySignature: KeySignatureId,
  ticks: number,
  stem: 'up' | 'down',
  id: string,
  hidden: boolean,
): string {
  const { dur, dots } = duration(ticks)
  const accidental = accidentalAttributes(value, keySignature)
  return `<note xml:id="${id}" pname="${value.letter.toLowerCase()}" oct="${value.octave}" dur="${dur}"${dots} stem.dir="${stem}"${accidental}${hidden ? HIDDEN : ''}/>`
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export interface SatbAnalysis {
  /** The figured bass under each chord. */
  figures?: readonly (Figure | undefined)[]
  /** Stufen, already printed — `V7`, `vii°6`. */
  stufen?: readonly string[]
  /** Function symbols, already printed — `D7`, `Tp`. */
  functions?: readonly string[]
}

export interface SatbEvent {
  voicing: Voicing
  ticks: number
  /** The bass rings on rather than being restruck. */
  held?: boolean
  /**
   * Voices engraved in place and **not drawn**.
   *
   * The reveal rule every hearing exercise here follows: leaving a note out
   * re-engraves a different piece of music, so the staff narrows and whatever
   * is already on screen slides sideways the moment the answer arrives.
   * `@visible="false"` keeps the page identical and simply does not paint.
   */
  hide?: readonly VoiceId[]
}

export interface SatbMeiOptions {
  keySignature: KeySignatureId
  events: readonly SatbEvent[]
  /** Hide every voice of every chord — the blank sheet a question opens on. */
  hidden?: boolean
  analysis?: SatbAnalysis
}

/**
 * Rows of text under the bass staff.
 *
 * Verovio has no notion of "the third analysis row", so each row is a separate
 * `<harm>` and they are told apart by `@n`. Whether it stacks them or overlaps
 * them is the engraver's business and is exactly what the node-environment
 * test checks — nothing here can know it from the markup alone.
 */
function harmRow(
  rows: readonly string[],
  index: number,
  n: number,
  prefix: string,
  tstamp: number,
): string {
  const text = rows[index]
  if (text === undefined || text === '') return ''
  return `<harm xml:id="${prefix}${index + 1}" n="${n}" staff="2" tstamp="${tstamp}" place="below">${escapeText(text)}</harm>`
}

/**
 * Events grouped into measures, one measure per **bass note**.
 *
 * A suspension is two sonorities over one bass, and the bass is written once
 * and held — striking it again would say it had moved, which is the one thing
 * a suspension is defined by not doing. So the upper voices carry two notes
 * where the bass carries one, exactly as `thoroughbassMei` splits a measure.
 */
function measuresOf(events: readonly SatbEvent[]): readonly (readonly SatbEvent[])[] {
  const measures: SatbEvent[][] = []
  for (const event of events) {
    const last = measures[measures.length - 1]
    if (event.held === true && last !== undefined) last.push(event)
    else measures.push([event])
  }
  return measures
}

export function satbMei({
  keySignature,
  events,
  hidden = false,
  analysis = {},
}: SatbMeiOptions): string {
  const grouped = measuresOf(events)

  // The analysis rows are written per sonority, so a measure has to know which
  // of them its own chords are.
  let sounded = 0

  const measures = grouped
    .map((group, index) => {
      const at = sounded
      sounded += group.length

      const opening = group[0] as SatbEvent
      const span = group.reduce((total, event) => total + event.ticks, 0)

      const staves = [1, 2]
        .map((staff) => {
          const layers = VOICES.filter((voice) => PARTS[voice].staff === staff)
            .sort((a, b) => PARTS[a].layer - PARTS[b].layer)
            .map((voice) => {
              const part = PARTS[voice]

              // The bass is one note for the whole measure; every other voice
              // moves with the sonorities above it.
              const notes =
                voice === 'bass'
                  ? [
                      voiceNote(
                        opening.voicing.bass,
                        keySignature,
                        span,
                        part.stem,
                        `${voice}${index + 1}`,
                        hidden || (opening.hide ?? []).includes(voice),
                      ),
                    ]
                  : group.map((event, position) =>
                      voiceNote(
                        event.voicing[voice],
                        keySignature,
                        event.ticks,
                        part.stem,
                        `${voice}${at + position + 1}`,
                        hidden || (event.hide ?? []).includes(voice),
                      ),
                    )

              return `<layer n="${part.layer}">${notes.join('')}</layer>`
            })
            .join('')
          return `<staff n="${staff}">${layers}</staff>`
        })
        .join('')

      // Figures first, nearest the staff, then the Stufen and the functions —
      // nearest-first is the order a reader takes them in. A suspension's two
      // figures are spread across the bass note's own length, which is what
      // the moving chord over a held bass looks like on the page.
      const labels = group
        .map((_, position) => {
          const slot = at + position
          const share = group.length === 1 ? 1 : 1 + (position * 4) / group.length
          const figure = analysis.figures?.[slot]
          const lines = figure === undefined ? [] : figureLines(figure)

          const figured =
            lines.length === 0
              ? ''
              : `<harm xml:id="figure${slot + 1}" n="1" staff="2" tstamp="${share}" place="below"><fb>${lines
                  .map((line) => `<f>${escapeText(line)}</f>`)
                  .join('')}</fb></harm>`

          return [
            figured,
            harmRow(analysis.stufen ?? [], slot, 2, 'stufe', share),
            harmRow(analysis.functions ?? [], slot, 3, 'function', share),
          ].join('')
        })
        .join('')

      return `<measure n="${index + 1}" right="invis">
              ${staves}
              ${labels}
            </measure>`
    })
    .join('\n            ')

  return `<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">
  <meiHead>
    <fileDesc>
      <titleStmt><title/></titleStmt>
      <pubStmt/>
    </fileDesc>
  </meiHead>
  <music>
    <body>
      <mdiv>
        <score>
          <scoreDef keysig="${meiKeySignature(keySignature)}">
            <staffGrp>
              <grpSym symbol="brace"/>
              <staffDef n="1" lines="5" clef.shape="G" clef.line="2"/>
              <staffDef n="2" lines="5" clef.shape="F" clef.line="4"/>
            </staffGrp>
          </scoreDef>
          <section>
            ${measures}
          </section>
        </score>
      </mdiv>
    </body>
  </music>
</mei>`
}
