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

/**
 * An explainer page that belongs to a category without being an exercise.
 *
 * A guide is something you **read**, not something you practise, and it earns a
 * stop on the path because some of what melina teaches cannot be learnt by
 * being tested on it — the rules of omission in a figured bass are conventions
 * you have to be told before you can be asked. Hiding that behind a question
 * mark on a settings screen puts it where nobody meets it first.
 *
 * It has no settings, no round and no accuracy, so it is deliberately not an
 * `ExerciseDef`: everything that walks the exercises — the routes, the feature
 * flags, the attempt log — keeps working without learning about it.
 */
export interface GuideDef {
  id: string
  icon: IconName
  status: Status
}

export interface CategoryDef {
  id: string
  icon: IconName
  status: Status
  exercises: readonly ExerciseDef[]
  /** Explainers that stand on the path before the exercises they serve. */
  guides?: readonly GuideDef[]
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
    guides: [
      {
        // **The modes are the vocabulary of all three scale exercises**, and
        // the shortcut for remembering them — lydian is major with a raised
        // fourth — is the kind of thing you are told once and then have. A
        // question mark on a settings screen is where nobody meets it first,
        // and the settings screen itself is behind Custom.
        id: 'scales',
        icon: 'book',
        status: 'ready',
      },
    ],
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
        icon: 'locate',
        status: 'ready',
      },
    ],
  },
  {
    id: 'dictation',
    icon: 'create',
    status: 'ready',
    exercises: [
      {
        id: 'short-melodies',
        icon: 'musicalNotes',
        status: 'ready',
      },
      {
        id: 'rhythm',
        icon: 'pulse',
        status: 'ready',
      },
      {
        id: 'two-voice',
        status: 'planned',
      },
    ],
  },
  {
    // **Thoroughbass — a braid of two.** A figure and the chord it stands for
    // are one fact read from either end, and neither end comes first: you can
    // learn to write the figure from the notes or the notes from the figure,
    // and each teaches the other.
    id: 'thoroughbass',
    icon: 'layers',
    status: 'ready',
    guides: [
      {
        id: 'figured-bass',
        icon: 'book',
        status: 'ready',
      },
    ],
    exercises: [
      { id: 'figuring', icon: 'create', status: 'ready' },
      { id: 'realizing', icon: 'layers', status: 'ready' },
      { id: 'unfigured', status: 'planned' },
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
    // Figured bass used to be planned here. It is its own category now —
    // reading one and writing one are two exercises rather than one — so what
    // is left of harmonic completion is the chorale.
    exercises: [
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

/**
 * A guide's route, station id and translation keys.
 *
 * Guide ids are globally unique rather than unique within a category, because
 * the route `/guide/<id>` is global — the id in the URL and the id in the
 * registry are the same string, so there is nothing to keep in step.
 */
export function guidePath(guideId: string): string {
  return `/guide/${guideId}`
}

export function guideStationId(guideId: string): string {
  return `guide/${guideId}`
}

export function guideTitleKey(guideId: string): string {
  return `curriculum:guides.${guideId}.title`
}

export function guideBlurbKey(guideId: string): string {
  return `curriculum:guides.${guideId}.blurb`
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
  /**
   * `intervals/reading` for an exercise, `scales` for a whole category,
   * `guide/figured-bass` for an explainer.
   */
  id: string
  /**
   * What tapping it gets you. A guide is read rather than practised, and the
   * path draws it differently — see `PathNode`.
   */
  kind: 'exercise' | 'guide'
  /** Fully qualified translation keys — pass them straight to `t`. */
  titleKey: string
  blurbKey: string
  icon: IconName
  /** Where tapping it leads. */
  path: string
  category: CategoryDef
  /** The exercise this station is, when it is one. */
  exercise?: ExerciseDef
  /** The guide this station is, when it is one. */
  guide?: GuideDef
  status: Status
}

export function stations(): readonly Station[] {
  return CATEGORIES.flatMap((category): Station[] => {
    const built = readyExercises(category)

    if (built.length === 0) {
      return [
        {
          id: category.id,
          kind: 'exercise' as const,
          titleKey: categoryTitleKey(category.id),
          blurbKey: categoryBlurbKey(category.id),
          icon: category.icon,
          path: categoryPath(category),
          category,
          status: category.status,
        },
      ]
    }

    // Guides come first, because a guide exists to be read before the exercise
    // it serves. Where they actually sit is `pathLayout.ts`'s business — this
    // only decides the order `orderedPathNodes` falls back to.
    const guides: Station[] = (category.guides ?? []).map((guide) => ({
      id: guideStationId(guide.id),
      kind: 'guide' as const,
      titleKey: guideTitleKey(guide.id),
      blurbKey: guideBlurbKey(guide.id),
      icon: guide.icon,
      path: guidePath(guide.id),
      category,
      guide,
      status: guide.status,
    }))

    return [
      ...guides,
      ...built.map((exercise) => ({
        id: `${category.id}/${exercise.id}`,
        kind: 'exercise' as const,
        titleKey: exerciseTitleKey(category.id, exercise.id),
        blurbKey: exerciseBlurbKey(category.id, exercise.id),
        icon: exercise.icon ?? category.icon,
        path: exercisePath(category.id, exercise.id),
        category,
        exercise,
        status: exercise.status,
      })),
    ]
  })
}
