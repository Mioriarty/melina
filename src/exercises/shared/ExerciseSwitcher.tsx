import { Link } from 'react-router'

import { exercisePath, getCategory, readyExercises } from '@/config/curriculum'
import { cn } from '@/lib/utils/cn'

export interface ExerciseSwitcherProps {
  categoryId: string
  /** The exercise currently open. */
  current: string
}

/**
 * Switch between the built exercises in a category.
 *
 * A station on the path leads to one exercise, so without this the others in
 * the same category would be unreachable — the path is the only navigation
 * there is. Sits on the setup screen rather than behind an extra chooser
 * screen, so starting a round is still one tap.
 *
 * Renders nothing when the category has only one built exercise, which is
 * why it can be dropped into every setup screen unconditionally.
 */
export function ExerciseSwitcher({ categoryId, current }: ExerciseSwitcherProps) {
  const category = getCategory(categoryId)
  if (category === undefined) return null

  const exercises = readyExercises(category)
  if (exercises.length < 2) return null

  return (
    <div
      className="mt-4 inline-flex gap-1 rounded-full border border-rule bg-paper-raised p-1"
      role="group"
      aria-label={`${category.title} exercises`}
    >
      {exercises.map((exercise) => {
        const active = exercise.id === current
        return (
          <Link
            key={exercise.id}
            to={exercisePath(categoryId, exercise.id)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-10 items-center rounded-full px-3.5 text-[0.8125rem] font-medium',
              'transition-colors duration-150',
              active ? 'bg-accent-tint text-accent' : 'text-ink-muted hover:text-accent',
            )}
          >
            {exercise.short ?? exercise.title}
          </Link>
        )
      })}
    </div>
  )
}
