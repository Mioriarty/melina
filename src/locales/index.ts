import deCommon from './de/common.json'
import deCurriculum from './de/curriculum.json'
import deExercise from './de/exercise.json'
import deLevels from './de/levels.json'
import deMusic from './de/music.json'
import dePath from './de/path.json'
import deProgress from './de/progress.json'
import deSettings from './de/settings.json'
import enCommon from './en/common.json'
import enCurriculum from './en/curriculum.json'
import enExercise from './en/exercise.json'
import enLevels from './en/levels.json'
import enMusic from './en/music.json'
import enPath from './en/path.json'
import enProgress from './en/progress.json'
import enSettings from './en/settings.json'

/**
 * Every translation, bundled into the app.
 *
 * Deliberately imported rather than fetched by an i18next backend: melina is
 * offline-first, and a language that only arrives over the network is a
 * language that is missing on a train. The whole set is a few kilobytes, so
 * there is nothing to lazy-load.
 *
 * One namespace per area of the app rather than one giant file, so a string
 * can be found from where it appears on screen:
 *
 * - `common`     — chrome that belongs to no single screen
 * - `path`       — the homescreen path
 * - `curriculum` — category and exercise names, keyed by their registry ids
 * - `levels`     — the named practice presets, keyed by exercise and level id
 * - `exercise`   — everything inside an exercise: setup, round, summary
 * - `music`      — theory vocabulary: clefs, keys, intervals, pitches
 * - `settings`   — the settings screen
 * - `progress`   — the progress overview
 */
export const NAMESPACES = [
  'common',
  'path',
  'curriculum',
  'levels',
  'exercise',
  'music',
  'settings',
  'progress',
] as const

export type Namespace = (typeof NAMESPACES)[number]

export const DEFAULT_NAMESPACE: Namespace = 'common'

export const RESOURCES = {
  en: {
    common: enCommon,
    path: enPath,
    curriculum: enCurriculum,
    levels: enLevels,
    exercise: enExercise,
    music: enMusic,
    settings: enSettings,
    progress: enProgress,
  },
  de: {
    common: deCommon,
    path: dePath,
    curriculum: deCurriculum,
    levels: deLevels,
    exercise: deExercise,
    music: deMusic,
    settings: deSettings,
    progress: deProgress,
  },
} as const
