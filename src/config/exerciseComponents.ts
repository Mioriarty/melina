import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * Which exercises have a real implementation.
 *
 * Keyed by `categoryId/exerciseId`. Everything absent falls back to the
 * placeholder page, so the curriculum can register modules long before they
 * are built. Each entry is lazy: Interval Reading pulls in the ~7 MB Verovio
 * engraver, and that must not be part of the initial download.
 */
type ExerciseComponent = LazyExoticComponent<ComponentType>

const EXERCISE_COMPONENTS: Record<string, ExerciseComponent> = {
  'intervals/hearing': lazy(
    () => import('@/exercises/interval-hearing/IntervalHearingExercise'),
  ),
  'intervals/reading': lazy(
    () => import('@/exercises/interval-reading/IntervalReadingExercise'),
  ),
  'dictation/rhythm': lazy(
    () => import('@/exercises/rhythm-dictation/RhythmDictationExercise'),
  ),
  'scales/hearing': lazy(() => import('@/exercises/scale-hearing/ScaleHearingExercise')),
  'scales/reading': lazy(() => import('@/exercises/scale-reading/ScaleReadingExercise')),
}

export function exerciseComponent(
  categoryId: string | undefined,
  exerciseId: string | undefined,
): ExerciseComponent | undefined {
  if (categoryId === undefined || exerciseId === undefined) return undefined
  return EXERCISE_COMPONENTS[`${categoryId}/${exerciseId}`]
}
