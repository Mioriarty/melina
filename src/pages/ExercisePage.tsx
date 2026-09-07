import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { Icon } from '@/components/ui/Icon'
import { Tag } from '@/components/ui/Tag'
import { buttonClasses } from '@/components/ui/buttonClasses'
import {
  categoryTitleKey,
  exerciseBlurbKey,
  exerciseTitleKey,
  getCategory,
  getExercise,
} from '@/config/curriculum'
import { exerciseComponent } from '@/config/exerciseComponents'
import { isExerciseEnabled } from '@/config/features'

/**
 * Route target for every exercise.
 *
 * Renders the real module when one is built, and otherwise a page that states
 * honestly what is coming. Exercises run without the app header, so every
 * branch here provides its own way back and its own scrolling.
 */
export default function ExercisePage() {
  const { t } = useTranslation(['exercise', 'common'])
  const { categoryId, exerciseId } = useParams()
  const category = getCategory(categoryId)
  const exercise = getExercise(categoryId, exerciseId)

  if (
    category === undefined ||
    exercise === undefined ||
    categoryId === undefined ||
    exerciseId === undefined
  ) {
    return (
      <Empty title={t('exercise:notFound.title')} body={t('exercise:notFound.body')} />
    )
  }

  const ready = isExerciseEnabled(category, exercise)
  const Exercise = ready ? exerciseComponent(categoryId, exerciseId) : undefined

  if (Exercise !== undefined) {
    return (
      <Suspense fallback={<Preparing />}>
        {/*
          Not a component created during render: `exerciseComponent` is a
          lookup into a module-level record of `lazy()` calls, so the
          identity is stable across renders and state is not reset.
        */}
        {/* oxlint-disable-next-line react/static-components */}
        <Exercise />
      </Suspense>
    )
  }

  return (
    <Sheet>
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-dashed border-rule text-ink-faint">
        <Icon name={ready ? category.icon : 'musicalNotes'} size={28} />
      </span>

      <p className="mt-6 text-sm tracking-wide text-ink-faint uppercase">
        {t(categoryTitleKey(categoryId))}
      </p>
      <h1 className="mt-1.5 text-title">{t(exerciseTitleKey(categoryId, exerciseId))}</h1>
      <p className="mx-auto mt-3 max-w-md leading-relaxed text-balance text-ink-muted">
        {t(exerciseBlurbKey(categoryId, exerciseId))}
      </p>

      <div className="mt-6 flex justify-center">
        <Tag tone="accent">{t('exercise:inDevelopment')}</Tag>
      </div>

      <Link to="/" className={buttonClasses('secondary', 'md', 'mt-8')}>
        {t('common:backToPath')}
      </Link>
    </Sheet>
  )
}

/** Centred, scrollable page body — the shell itself does not scroll. */
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="pb-page mx-auto w-full max-w-xl px-5 pt-14 text-center sm:pt-20">
        {children}
      </div>
    </div>
  )
}

/**
 * Shown while an exercise chunk downloads. Interval Reading pulls in the
 * Verovio engraver, which is a real wait on a slow connection.
 */
function Preparing() {
  const { t } = useTranslation('exercise')
  return (
    <div className="grid h-full place-items-center px-5 text-center">
      <p className="text-sm text-ink-faint">{t('preparing')}</p>
    </div>
  )
}

function Empty({ title, body }: { title: string; body: string }) {
  const { t } = useTranslation()
  return (
    <Sheet>
      <h1 className="text-title">{title}</h1>
      <p className="mt-3 leading-relaxed text-ink-muted">{body}</p>
      <Link to="/" className={buttonClasses('secondary', 'md', 'mt-8')}>
        {t('backToPath')}
      </Link>
    </Sheet>
  )
}
