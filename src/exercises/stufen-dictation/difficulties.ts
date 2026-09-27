import { HARMONY_DICTATION_DIFFICULTIES } from '@/exercises/harmony-shared/difficulties'
import type { HarmonySettings } from '@/exercises/harmony-shared/settings'
import type { Difficulty } from '@/exercises/shared/difficulty'

/**
 * The progression levels, with the inversion as a level axis of its own.
 *
 * The same progressions bass and soprano dictation hear — a level is *which
 * progressions* — and on top of that, whether a chord is named with its
 * inversion. It is off where the level is about something else and on where
 * the inversion *is* the subject: the six-fours, the parallel sixths, and
 * everything. `umkehrungen` is the level that introduces it on its own, in the
 * plain keys, before it is asked alongside anything harder.
 */
const NAMES_INVERSIONS: ReadonlySet<string> = new Set([
  'quartsext',
  'fauxbourdon',
  'alles',
])

const byId = (id: string): Difficulty<HarmonySettings> => {
  const found = HARMONY_DICTATION_DIFFICULTIES.find((level) => level.id === id)
  if (found === undefined) throw new Error(`no harmony level ${id}`)
  return found
}

const INVERSIONS: Difficulty<HarmonySettings> = {
  id: 'umkehrungen',
  section: 'diatonik',
  settings: {
    ...byId('dur').settings,
    keys: [...byId('dur').settings.keys, ...byId('moll').settings.keys],
    blocks: [
      'tonika-sextakkord',
      'tonika-prolongation',
      'subdominant-prolongation',
      'dominant-prolongation',
    ],
    inversions: true,
  },
}

export const STUFEN_DIFFICULTIES: readonly Difficulty<HarmonySettings>[] =
  HARMONY_DICTATION_DIFFICULTIES.flatMap((level) => {
    const named = {
      ...level,
      settings: { ...level.settings, inversions: NAMES_INVERSIONS.has(level.id) },
    }
    // Straight after the plain minor keys, and before anything chromatic.
    return level.id === 'moll' ? [named, INVERSIONS] : [named]
  })
