import type { NoteValue } from '@/lib/notation/rhythmNotation'

import {
  flag8thDown,
  flag16thDown,
  noteheadBlack,
  noteheadHalf,
  noteheadWhole,
  rest8th,
  rest16th,
  restHalf,
  restQuarter,
  restWhole,
  type Glyph,
} from './glyphs'

/**
 * A single note or rest, for a keyboard key.
 *
 * The outlines are Leland's own, lifted out of Verovio — see `glyphs.ts`. They
 * were drawn by hand first and the rests gave that away: a quarter rest is a
 * shape you cannot approximate, and an eighth rest is not a "7". Using the real
 * font also means a key looks like exactly what pressing it will put on the
 * staff, which is the whole point of drawing notation on a button.
 *
 * Stems point **down**, matching the staff, where they hang below the single
 * line so a bar filling with beams cannot push the line around — see `mei.ts`.
 *
 * Everything is placed from the measured boxes rather than by eye, because
 * these glyphs are anchored the way notation anchors them: a notehead's origin
 * is its left edge, and a rest's is the line it hangs from.
 */

export interface NoteGlyphProps {
  value: NoteValue
  kind: 'note' | 'rest'
  dotted?: boolean
  size?: number
  className?: string
}

interface Box {
  x0: number
  x1: number
  y0: number
  y1: number
}

/* -------------------------------------------------------------- geometry */

/** A downward stem meets the notehead at its left edge, which is x = 0. */
const STEM_WIDTH = 30
/**
 * Long enough for a flag, which reaches some 820 units back up towards the
 * notehead from the end of the stem. A shorter stem would put the hook through
 * the note.
 */
const STEM_LENGTH = 850

const HEADS: Record<NoteValue, Glyph> = {
  1: noteheadWhole,
  2: noteheadHalf,
  4: noteheadBlack,
  8: noteheadBlack,
  16: noteheadBlack,
}

const FLAGS: Partial<Record<NoteValue, Glyph>> = {
  8: flag8thDown,
  16: flag16thDown,
}

const RESTS: Record<NoteValue, Glyph> = {
  1: restWhole,
  2: restHalf,
  4: restQuarter,
  8: rest8th,
  16: rest16th,
}

/** A whole note is the only value with no stem at all. */
const hasStem = (value: NoteValue) => value !== 1

function union(a: Box, b: Box): Box {
  return {
    x0: Math.min(a.x0, b.x0),
    x1: Math.max(a.x1, b.x1),
    y0: Math.min(a.y0, b.y0),
    y1: Math.max(a.y1, b.y1),
  }
}

function shift(box: Box, dy: number): Box {
  return { ...box, y0: box.y0 + dy, y1: box.y1 + dy }
}

function noteBox(value: NoteValue): Box {
  const head = HEADS[value].box
  if (!hasStem(value)) return head

  const stem: Box = { x0: 0, x1: STEM_WIDTH, y0: -STEM_LENGTH, y1: 0 }
  const flag = FLAGS[value]
  const withStem = union(head, stem)
  return flag === undefined ? withStem : union(withStem, shift(flag.box, -STEM_LENGTH))
}

/**
 * One scale for every glyph, so a whole note really is wider than a quarter and
 * the row reads as notation rather than as five icons fitted to five boxes.
 * Sized by the tallest thing drawn, which is a stemmed and flagged note.
 */
const BOX_HEIGHT = 28
const BOX_WIDTH = 24
const PADDING = 2
const TALLEST = STEM_LENGTH + noteheadBlack.box.y1
const UNIT = (BOX_HEIGHT - PADDING * 2) / TALLEST

/** Where a rest's own line sits, for the two rests that are told apart by it. */
const LINE_Y = BOX_HEIGHT / 2

function Outline({ glyph }: { glyph: Glyph }) {
  return <path d={glyph.d} fill="currentColor" />
}

export function NoteGlyph({
  value,
  kind,
  dotted = false,
  size = 26,
  className,
}: NoteGlyphProps) {
  const glyph = kind === 'note' ? undefined : RESTS[value]
  const box = kind === 'note' ? noteBox(value) : glyph!.box

  // A whole rest hangs below its line and a half rest sits on it, and that is
  // all that separates them — so those two keep their anchor on a drawn line
  // instead of being centred like everything else.
  const onLine = kind === 'rest' && (value === 1 || value === 2)

  const x = BOX_WIDTH / 2 - ((box.x0 + box.x1) / 2) * UNIT
  const y = onLine ? LINE_Y : BOX_HEIGHT / 2 + ((box.y0 + box.y1) / 2) * UNIT

  // Just clear of the ink, on the notehead's own line.
  const dotX = x + (box.x1 + 110) * UNIT
  const dotY = kind === 'note' ? y : y - ((box.y0 + box.y1) / 2) * UNIT

  return (
    <svg
      viewBox={`0 0 ${BOX_WIDTH} ${BOX_HEIGHT}`}
      width={size}
      height={(size * BOX_HEIGHT) / BOX_WIDTH}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {onLine && (
        <path
          d={`M ${BOX_WIDTH / 2 - 6} ${LINE_Y} h 12`}
          stroke="currentColor"
          strokeWidth={0.9}
          opacity={0.45}
        />
      )}

      <g transform={`translate(${x}, ${y}) scale(${UNIT}, ${-UNIT})`}>
        {glyph === undefined ? (
          <>
            <Outline glyph={HEADS[value]} />
            {hasStem(value) && (
              <rect
                x={0}
                y={-STEM_LENGTH}
                width={STEM_WIDTH}
                height={STEM_LENGTH}
                fill="currentColor"
              />
            )}
            {FLAGS[value] !== undefined && (
              <g transform={`translate(0, ${-STEM_LENGTH})`}>
                <Outline glyph={FLAGS[value] as Glyph} />
              </g>
            )}
          </>
        ) : (
          <Outline glyph={glyph} />
        )}
      </g>

      {dotted && <circle cx={dotX} cy={dotY} r={1.35} fill="currentColor" />}
    </svg>
  )
}
