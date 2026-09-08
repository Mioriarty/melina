import { CATEGORIES, type CategoryDef, type ExerciseDef } from './curriculum'

/**
 * Feature flags.
 *
 * Every training module is registered in the curriculum from day one so the
 * map shows the whole journey, but only enabled modules are playable. Turning
 * a module on is a one-line change here — nothing in the UI needs touching.
 */
export const FEATURES = {
  intervals: true,
  scales: true,
  dictation: false,
  'harmonic-prediction': false,
  'harmonic-completion': false,
  counterpoint: false,
  daily: false,
  progress: false,
} satisfies Record<string, boolean>

export type FeatureKey = keyof typeof FEATURES

function isFeatureKey(id: string): id is FeatureKey {
  return id in FEATURES
}

/**
 * A category is only reachable when the registry marks it ready *and* its
 * flag is on. The flag is the switch; the registry status is the intent.
 */
export function isCategoryEnabled(category: CategoryDef): boolean {
  return category.status === 'ready' && isFeatureKey(category.id) && FEATURES[category.id]
}

export function isExerciseEnabled(category: CategoryDef, exercise: ExerciseDef): boolean {
  return isCategoryEnabled(category) && exercise.status === 'ready'
}

export const ENABLED_CATEGORY_COUNT = CATEGORIES.filter(isCategoryEnabled).length
