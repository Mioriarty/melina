/**
 * How the two notes of an interval are placed in time.
 *
 * This decides three things at once: how the interval is played, how it is
 * engraved, and — in a hearing exercise — which of the two notes is on screen
 * before the answer is given. The note heard first is the note shown first,
 * so a descending interval reveals its upper note and everything else its
 * lower one.
 */
export type PlayDirection = 'harmonic' | 'ascending' | 'descending'

export interface PlayDirectionDef {
  id: PlayDirection
  label: string
  hint: string
}

export const PLAY_DIRECTIONS: readonly PlayDirectionDef[] = [
  {
    id: 'harmonic',
    label: 'Together',
    hint: 'Both notes at once.',
  },
  {
    id: 'ascending',
    label: 'Ascending',
    hint: 'Lower note first.',
  },
  {
    id: 'descending',
    label: 'Descending',
    hint: 'Upper note first — the hardest of the three.',
  },
]

export const DEFAULT_PLAY_DIRECTIONS: readonly PlayDirection[] = ['ascending']

export function isPlayDirection(value: string): value is PlayDirection {
  return PLAY_DIRECTIONS.some((direction) => direction.id === value)
}

export function getPlayDirection(id: PlayDirection): PlayDirectionDef {
  const direction = PLAY_DIRECTIONS.find((entry) => entry.id === id)
  if (direction === undefined) throw new Error(`unknown direction: ${id}`)
  return direction
}

/**
 * Which note of the pair comes first — sounded, and therefore shown.
 *
 * Only a descending interval leads with its upper note; a simultaneous one
 * has no order at all, so it leads with the lower note for consistency with
 * ascending.
 */
export function leadingNote(direction: PlayDirection): 'lower' | 'upper' {
  return direction === 'descending' ? 'upper' : 'lower'
}

/** True when the two notes sound one after the other rather than together. */
export function isMelodic(direction: PlayDirection): boolean {
  return direction !== 'harmonic'
}
