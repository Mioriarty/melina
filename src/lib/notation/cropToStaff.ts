/**
 * Trim the drawing to its staff.
 *
 * The page is a fixed size so that every key comes out identical, but Verovio
 * lays the music out from the left, and how far right it reaches depends on
 * whether the note carries an accidental. Centring the *box* in a key therefore
 * leaves the staff sitting left of centre by a varying amount.
 *
 * Cropping to the staff lines fixes the frame to the thing that should be
 * centred. They are the only long horizontal strokes in the drawing — barlines
 * and stems are vertical, and ledger lines sit inside the staff's own span — so
 * the outermost horizontal reach is the staff. Vertical is deliberately left
 * alone: the staff must sit at the same height on every key, and where the note
 * falls on it is the whole point.
 *
 * Anything unexpected leaves the drawing untouched rather than guessing.
 */
export function cropToStaff(svg: string): string {
  const box = svg.match(/viewBox="0 0 (\d+) (\d+)"/)
  if (box === null) return svg
  const height = Number(box[2])
  if (!Number.isFinite(height) || height <= 0) return svg

  const horizontal = [
    ...svg.matchAll(/<path d="M(-?\d+) (-?\d+) L(-?\d+) (-?\d+)"/g),
  ].filter((match) => match[2] === match[4])
  if (horizontal.length === 0) return svg

  const left = Math.min(...horizontal.map((match) => Number(match[1])))
  const right = Math.max(...horizontal.map((match) => Number(match[3])))
  if (!(right > left)) return svg

  const cropped = right - left
  return svg
    .replace(box[0], `viewBox="${left} 0 ${cropped} ${height}"`)
    .replace(
      /^(<svg[^>]*?)width="\d+px"/,
      `$1width="${Math.round((cropped / height) * 100)}px"`,
    )
    .replace(/^(<svg[^>]*?)height="\d+px"/, '$1height="100px"')
}
