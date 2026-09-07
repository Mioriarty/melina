import { MUSIC_MARKS, type MarkPart, type MusicMarkName } from '@/config/musicMarks'

export interface MusicMarkGlyphProps {
  name: MusicMarkName
  /** Rendered width in px; height follows the glyph's own aspect ratio. */
  width: number
  className?: string
}

/** Renders one decorative notation glyph from its authored geometry. */
export function MusicMarkGlyph({ name, width, className }: MusicMarkGlyphProps) {
  const mark = MUSIC_MARKS[name]

  return (
    <svg
      className={className}
      width={width}
      height={width / mark.aspect}
      viewBox={mark.viewBox}
      aria-hidden="true"
      focusable="false"
    >
      {mark.parts.map((part, index) => (
        <Part key={index} part={part} />
      ))}
    </svg>
  )
}

function Part({ part }: { part: MarkPart }) {
  if (part.kind === 'fill') {
    return <path d={part.d} fill="currentColor" transform={part.transform} />
  }

  if (part.kind === 'stroke') {
    return (
      <path
        d={part.d}
        fill="none"
        stroke="currentColor"
        strokeWidth={part.width}
        strokeLinecap={part.cap ?? 'butt'}
      />
    )
  }

  return (
    <text
      x={part.x}
      y={part.y}
      fontSize={part.size}
      textAnchor="middle"
      fill="currentColor"
      className="font-serif italic"
    >
      {part.value}
    </text>
  )
}
