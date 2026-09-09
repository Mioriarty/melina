import type { IconName } from '@/components/ui/Icon'

/**
 * The curriculum registry.
 *
 * This is the single source of truth for what melina teaches. The top
 * navigation, the homescreen map and the routes are all derived from it —
 * no component may hardcode a category or exercise list. Adding a module
 * means adding an entry here and its names in `locales/<lang>/curriculum.json`.
 *
 * The registry holds ids, icons and status — the structure. Titles and
 * blurbs are translated, so they live in the `curriculum` namespace keyed by
 * exactly these ids, and the helpers at the bottom of this file are the only
 * place that mapping is spelled out.
 */

export type Status = 'ready' | 'planned'

export interface ExerciseDef {
  id: string
  /** Shown on the exercise's own station. Falls back to the category icon. */
  icon?: IconName
  status: Status
}

export interface CategoryDef {
  id: string
  icon: IconName
  status: Status
  exercises: readonly ExerciseDef[]
}

export const CATEGORIES: readonly CategoryDef[] = [
  {
    id: 'intervals',
    icon: 'swapVertical',
    status: 'ready',
    exercises: [
      {
        id: 'hearing',
        icon: 'ear',
        status: 'ready',
      },
      {
        id: 'reading',
        icon: 'swapVertical',
        status: 'ready',
      },
      {
        id: 'singing',
        status: 'planned',
      },
    ],
  },
  {
    id: 'scales',
    icon: 'trendingUp',
    status: 'ready',
    exercises: [
      {
        id: 'hearing',
        icon: 'ear',
        status: 'ready',
      },
      {
        id: 'reading',
        icon: 'trendingUp',
        status: 'ready',
      },
      {
        id: 'degrees',
        status: 'planned',
      },
    ],
  },
  {
    id: 'dictation',
    icon: 'create',
    status: 'planned',
    exercises: [
      {
        id: 'short-melodies',
        status: 'planned',
      },
      {
        id: 'rhythm',
        status: 'planned',
      },
      {
        id: 'two-voice',
        status: 'planned',
      },
    ],
  },
  {
    id: 'harmonic-prediction',
    icon: 'sparkles',
    status: 'planned',
    exercises: [
      {
        id: 'next-chord',
        status: 'planned',
      },
      {
        id: 'cadences',
        status: 'planned',
      },
    ],
  },
  {
    id: 'harmonic-completion',
    icon: 'puzzle',
    status: 'planned',
    exercises: [
      {
        id: 'figured-bass',
        status: 'planned',
      },
      {
        id: 'chorale',
        status: 'planned',
      },
    ],
  },
  {
    id: 'counterpoint',
    icon: 'network',
    status: 'planned',
    exercises: [
      {
        id: 'first-species',
        status: 'planned',
      },
      {
        id: 'second-species',
        status: 'planned',
      },
      {
        id: 'free',
        status: 'planned',
      },
    ],
  },
  {
    id: 'daily',
    icon: 'calendar',
    status: 'planned',
    exercises: [
      {
        id: 'constraint',
        status: 'planned',
      },
      {
        id: 'motif',
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

/* ---------------------------------------------------------- translation */

/**
 * Translation keys, derived from the registry ids.
 *
 * Built here rather than at each call site so a rename in the registry moves
 * the key with it, and so `locales/<lang>/curriculum.json` has exactly one shape
 * to match. Keys are fully qualified with their namespace, which lets a
 * component pass one straight to `t` without also naming `curriculum`.
 */
export function categoryTitleKey(categoryId: string): string {
  return `curriculum:categories.${categoryId}.title`
}

export function categoryBlurbKey(categoryId: string): string {
  return `curriculum:categories.${categoryId}.blurb`
}

export function exerciseTitleKey(categoryId: string, exerciseId: string): string {
  return `curriculum:categories.${categoryId}.exercises.${exerciseId}.title`
}

export function exerciseBlurbKey(categoryId: string, exerciseId: string): string {
  return `curriculum:categories.${categoryId}.exercises.${exerciseId}.blurb`
}

/**
 * Label for tight spaces, where the category name is already on screen.
 * Translations may leave it out; callers fall back to the full title.
 */
export function exerciseShortKey(categoryId: string, exerciseId: string): string {
  return `curriculum:categories.${categoryId}.exercises.${exerciseId}.short`
}

/* ------------------------------------------------------------- stations */

/**
 * A stop on the homescreen path.
 *
 * A category with built exercises contributes **one station per exercise** —
 * Interval Reading and Interval Hearing are different games and deserve
 * separate stops, not a shared one that has to guess which you meant. A
 * category with nothing built yet contributes a single locked station, so
 * the whole journey stays visible without a station per unwritten exercise.
 */
export interface Station {
  /** `intervals/reading` for an exercise, `scales` for a whole category. */
  id: string
  /** Fully qualified translation keys — pass them straight to `t`. */
  titleKey: string
  blurbKey: string
  icon: IconName
  /** Where tapping it leads. */
  path: string
  category: CategoryDef
  /** The exercise this station is, when it is one. */
  exercise?: ExerciseDef
  status: Status
}

export function stations(): readonly Station[] {
  return CATEGORIES.flatMap((category) => {
    const built = readyExercises(category)

    if (built.length === 0) {
      return [
        {
          id: category.id,
          titleKey: categoryTitleKey(category.id),
          blurbKey: categoryBlurbKey(category.id),
          icon: category.icon,
          path: categoryPath(category),
          category,
          status: category.status,
        },
      ]
    }

    return built.map((exercise) => ({
      id: `${category.id}/${exercise.id}`,
      titleKey: exerciseTitleKey(category.id, exercise.id),
      blurbKey: exerciseBlurbKey(category.id, exercise.id),
      icon: exercise.icon ?? category.icon,
      path: exercisePath(category.id, exercise.id),
      category,
      exercise,
      status: exercise.status,
    }))
  })
}
