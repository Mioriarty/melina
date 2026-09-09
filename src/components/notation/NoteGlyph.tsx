import type { NoteValue } from '@/lib/notation/rhythmNotation'

/**
 * A single note or rest, drawn.
 *
 * Hand-drawn rather than typeset. Leland lives inside the Verovio WebAssembly
 * and is not a web font, the app's own two faces are Latin-only, and the
 * Unicode musical symbols that do exist have no rests below the whole and are
 * unreliably shaped across platforms. Twelve small paths cost nothing, work
 * offline, take `currentColor`, and — unlike a font — never arrive late.
 *
 * These are keyboard glyphs, not engraving: what appears on the staff is
 * Verovio's, and this never has to match it exactly.
 */

export interface NoteGlyphProps {
  value: NoteValue
  kind: 'note' | 'rest'
  dotted?: boolean
  size?: number
  className?: string
}

/** Notehead centre and stem, in the 24 x 28 box every glyph is drawn in. */
const HEAD_X = 8
const HEAD_Y = 19
const STEM_X = 12.7
const STEM_TOP = 4

function Flag({ at }: { at: number }) {
  return (
    <path
      d={`M ${STEM_X} ${at} C ${STEM_X + 4.6} ${at + 2.2} ${STEM_X + 5.8} ${at + 5.4} ${STEM_X + 3.6} ${at + 9.4} C ${STEM_X + 4.4} ${at + 5.6} ${STEM_X + 2.4} ${at + 3.6} ${STEM_X} ${at + 3}  Z`}
      fill="currentColor"
    />
  )
}

function Head({ filled }: { filled: boolean }) {
  return (
    <ellipse
      cx={HEAD_X}
      cy={HEAD_Y}
      rx={5.3}
      ry={3.9}
      transform={`rotate(-22 ${HEAD_X} ${HEAD_Y})`}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.7}
    />
  )
}

function Stem() {
  return (
    <path
      d={`M ${STEM_X} ${HEAD_Y - 1.4} L ${STEM_X} ${STEM_TOP}`}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
    />
  )
}

function NoteShape({ value }: { value: NoteValue }) {
  if (value === 1) return <Head filled={false} />

  return (
    <>
      <Head filled={value !== 2} />
      <Stem />
      {value === 8 && <Flag at={STEM_TOP} />}
      {value === 16 && (
        <>
          <Flag at={STEM_TOP} />
          <Flag at={STEM_TOP + 5.4} />
        </>
      )}
    </>
  )
}

/** A hooked stroke, which is what an eighth and a sixteenth rest are made of. */
function RestHook({ at }: { at: number }) {
  return (
    <>
      <circle cx={7.4} cy={at} r={2.1} fill="currentColor" />
      <path
        d={`M 9.3 ${at - 1.1} C 12.4 ${at - 2.2} 13.4 ${at - 1.4} 13.2 ${at + 1.2}`}
        stroke="currentColor"
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
    </>
  )
}

function RestShape({ value }: { value: NoteValue }) {
  // A whole rest hangs from its line and a half rest sits on it, and that is
  // the *only* thing that tells them apart — so on a key, where there is no
  // staff to refer to, the line has to come with them or the two are the same
  // picture.
  if (value === 1 || value === 2) {
    return (
      <>
        <path
          d="M 3.4 17.2 L 17.6 17.2"
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.4}
        />
        <rect
          x={5.6}
          y={value === 1 ? 17.2 : 12.8}
          width={10.4}
          height={4.4}
          fill="currentColor"
        />
      </>
    )
  }

  if (value === 4) {
    // The quarter rest's zigzag, then the hook that finishes it.
    return (
      <path
        d="M 7.4 5.2 L 13.1 11.6 C 10.4 13.6 10.2 15 12.6 17.2 L 7.6 13.6 C 10.6 16.6 9.4 19.4 12.4 22.4 C 9.4 20.8 6.6 22 8.4 25.4 C 5.2 22.4 6.2 18.6 10.4 19.8 L 5.6 14.2 C 8.6 12.4 8.8 10.6 6.2 8.2 Z"
        fill="currentColor"
      />
    )
  }

  const hooks = value === 16 ? [10.6, 16.4] : [12.6]
  return (
    <>
      <path
        d={`M ${13.2} ${(hooks[0] as number) - 1.6} L 9.6 24`}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {hooks.map((at) => (
        <RestHook key={at} at={at} />
      ))}
    </>
  )
}

export function NoteGlyph({
  value,
  kind,
  dotted = false,
  size = 26,
  className,
}: NoteGlyphProps) {
  return (
    <svg
      viewBox="0 0 24 28"
      width={size}
      height={(size * 28) / 24}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'note' ? <NoteShape value={value} /> : <RestShape value={value} />}
      {dotted && (
        <circle
          cx={kind === 'note' ? HEAD_X + 8.6 : 18.4}
          cy={kind === 'note' ? HEAD_Y : 17}
          r={1.55}
          fill="currentColor"
        />
      )}
    </svg>
  )
}
