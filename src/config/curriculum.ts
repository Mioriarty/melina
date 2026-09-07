import type { IconName } from '@/components/ui/Icon'

/**
 * The curriculum registry.
 *
 * This is the single source of truth for what melina teaches. The top
 * navigation, the homescreen map and the routes are all derived from it —
 * no component may hardcode a category or exercise list. Adding a module
 * means adding an entry here and nothing else.
 */

export type Status = 'ready' | 'planned'

export interface ExerciseDef {
  id: string
  title: string
  /**
   * Label for tight spaces, where the category name is already on screen.
   * Falls back to `title`.
   */
  short?: string
  blurb: string
  status: Status
}

export interface CategoryDef {
  id: string
  title: string
  /** Shown on the map node and in the nav. Keep to a single short line. */
  blurb: string
  icon: IconName
  status: Status
  exercises: readonly ExerciseDef[]
}

export const CATEGORIES: readonly CategoryDef[] = [
  {
    id: 'intervals',
    title: 'Interval Training',
    blurb: 'Hear and read the distance between two notes.',
    icon: 'swapVertical',
    status: 'ready',
    exercises: [
      {
        id: 'hearing',
        short: 'Hearing',
        title: 'Interval Hearing',
        blurb: 'Identify an interval played melodically or harmonically.',
        status: 'ready',
      },
      {
        id: 'reading',
        short: 'Reading',
        title: 'Interval Reading',
        blurb: 'Name the interval you see on the staff.',
        status: 'ready',
      },
      {
        id: 'singing',
        short: 'Singing',
        title: 'Interval Singing',
        blurb: 'Sing the target interval from a given root.',
        status: 'planned',
      },
    ],
  },
  {
    id: 'scales',
    title: 'Scale Training',
    blurb: 'Scale degrees, modes and their colours.',
    icon: 'trendingUp',
    status: 'planned',
    exercises: [
      {
        id: 'degrees',
        title: 'Scale Degrees',
        blurb: 'Place a pitch against its tonic by function.',
        status: 'planned',
      },
      {
        id: 'modes',
        title: 'Mode Recognition',
        blurb: 'Tell the seven diatonic modes apart by ear.',
        status: 'planned',
      },
    ],
  },
  {
    id: 'dictation',
    title: 'Melodic Dictation',
    blurb: 'Write down what you hear, one phrase at a time.',
    icon: 'create',
    status: 'planned',
    exercises: [
      {
        id: 'short-melodies',
        title: 'Short Melodies',
        blurb: 'Notate a two to four bar melody after limited hearings.',
        status: 'planned',
      },
      {
        id: 'rhythm',
        title: 'Rhythmic Dictation',
        blurb: 'Capture rhythm alone, without pitch.',
        status: 'planned',
      },
      {
        id: 'two-voice',
        title: 'Two-Voice Dictation',
        blurb: 'Track two independent lines at once.',
        status: 'planned',
      },
    ],
  },
  {
    id: 'harmonic-prediction',
    title: 'Harmonic Prediction',
    blurb: 'Guess where the progression wants to go.',
    icon: 'sparkles',
    status: 'planned',
    exercises: [
      {
        id: 'next-chord',
        title: 'Next Chord',
        blurb: 'Predict the chord that follows what you just heard.',
        status: 'planned',
      },
      {
        id: 'cadences',
        title: 'Cadence Recognition',
        blurb: 'Name the cadence closing a phrase.',
        status: 'planned',
      },
    ],
  },
  {
    id: 'harmonic-completion',
    title: 'Harmonic Completion',
    blurb: 'Fill the gap in a progression that already works.',
    icon: 'puzzle',
    status: 'planned',
    exercises: [
      {
        id: 'figured-bass',
        title: 'Figured Bass',
        blurb: 'Realise a bass line from its figures.',
        status: 'planned',
      },
      {
        id: 'chorale',
        title: 'Chorale Harmonisation',
        blurb: 'Harmonise a given soprano in four parts.',
        status: 'planned',
      },
    ],
  },
  {
    id: 'counterpoint',
    title: 'Counterpoint',
    blurb: 'Species writing against a cantus firmus.',
    icon: 'network',
    status: 'planned',
    exercises: [
      {
        id: 'first-species',
        title: 'First Species',
        blurb: 'Note against note, consonance only.',
        status: 'planned',
      },
      {
        id: 'second-species',
        title: 'Second Species',
        blurb: 'Two notes against one, with passing dissonance.',
        status: 'planned',
      },
      {
        id: 'free',
        title: 'Free Counterpoint',
        blurb: 'Mixed values with full rhythmic freedom.',
        status: 'planned',
      },
    ],
  },
  {
    id: 'daily',
    title: 'Daily Composition',
    blurb: 'One constraint a day. Write something small.',
    icon: 'calendar',
    status: 'planned',
    exercises: [
      {
        id: 'constraint',
        title: "Today's Constraint",
        blurb: 'A fresh limitation to compose against.',
        status: 'planned',
      },
      {
        id: 'motif',
        title: 'Motif Development',
        blurb: 'Take one motif and put it through its paces.',
        status: 'planned',
      },
    ],
  },
  {
    id: 'progress',
    title: 'Progress',
    blurb: 'Where you are strong, and where to aim next.',
    icon: 'analytics',
    status: 'planned',
    exercises: [
      {
        id: 'overview',
        title: 'Overview',
        blurb: 'Practice history and streaks at a glance.',
        status: 'planned',
      },
      {
        id: 'weak-spots',
        title: 'Weak Spots',
        blurb: 'The intervals and chords that keep catching you out.',
        status: 'planned',
      },
    ],
  },
]

export function getCategory(categoryId: string | undefined): CategoryDef | undefined {
  if (categoryId === undefined) return undefined
  return CATEGORIES.find((category) => category.id === categoryId)
}

export function getExercise(
  categoryId: string | undefined,
  exerciseId: string | undefined,
): ExerciseDef | undefined {
  if (exerciseId === undefined) return undefined
  return getCategory(categoryId)?.exercises.find((exercise) => exercise.id === exerciseId)
}

/** Route to a category's first exercise, which is what nav links point at. */
/**
 * Where a category's station on the path leads.
 *
 * The first exercise that is actually built, not simply the first one listed:
 * Interval Training lists Hearing before Reading, but Hearing is still
 * planned, so linking to `exercises[0]` dead-ends on a placeholder and leaves
 * the built exercise unreachable.
 *
 * This is only the landing point. Once a category has more than one built
 * exercise the others are reached from the setup screen's switcher, so
 * nothing becomes unreachable.
 */
export function categoryPath(category: CategoryDef): string {
  const target =
    category.exercises.find((exercise) => exercise.status === 'ready') ??
    category.exercises[0]
  return target === undefined ? '/' : `/train/${category.id}/${target.id}`
}

/** The exercises in a category that are actually built. */
export function readyExercises(category: CategoryDef): readonly ExerciseDef[] {
  return category.exercises.filter((exercise) => exercise.status === 'ready')
}

export function exercisePath(categoryId: string, exerciseId: string): string {
  return `/train/${categoryId}/${exerciseId}`
}
