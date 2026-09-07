import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'

import {
  difficultyBlurbKey,
  difficultyTitleKey,
  type Difficulty,
  type DifficultyGroup,
} from './difficulty'

export interface LevelsScreenProps<TSettings> {
  /** Translation key for the exercise's own name. */
  titleKey: string
  /** Translation key for the line under it. */
  blurbKey: string
  /** Which block of `levels.json` names these presets. */
  group: DifficultyGroup
  levels: readonly Difficulty<TSettings>[]
  onPick: (level: Difficulty<TSettings>) => void
  onCustom: () => void
}

/**
 * Choose what to practise.
 *
 * The landing screen for an exercise. Picking a level starts a round
 * immediately — the levels exist so that practising is one tap, not a trip
 * through six sets of checkboxes. Custom is last and opens exactly those
 * checkboxes for when a level is not what you want.
 */
export function LevelsScreen<TSettings>({
  titleKey,
  blurbKey,
  group,
  levels,
  onPick,
  onCustom,
}: LevelsScreenProps<TSettings>) {
  const { t } = useTranslation(['exercise', 'common'])

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="pb-page mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6">
        <header className="mb-6">
          <Link
            to="/"
            className="mb-1 -ml-2 inline-flex h-11 items-center gap-1.5 rounded-full pr-3 pl-2 text-sm font-medium text-ink-muted transition-colors hover:bg-accent-tint hover:text-accent"
          >
            <Icon name="arrowBack" size={18} />
            {t('common:path')}
          </Link>

          <h1 className="mt-1 text-title">{t(titleKey)}</h1>
          <p className="mt-2 leading-relaxed text-ink-muted">{t(blurbKey)}</p>
        </header>

        <ul className="grid gap-2">
          {levels.map((level, index) => (
            <li key={level.id}>
              <button
                type="button"
                onClick={() => onPick(level)}
                className={cn(
                  'group flex w-full items-center gap-3.5 rounded-2xl border border-rule bg-paper-raised p-3.5 text-left',
                  'transition-colors duration-150 hover:border-accent',
                )}
              >
                <span className="tabular grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-tint font-serif text-[1.0625rem] font-semibold text-accent">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-[1.0625rem] font-semibold">
                    {t(difficultyTitleKey(group, level.id))}
                  </span>
                  <span className="mt-0.5 block text-sm leading-snug text-ink-muted">
                    {t(difficultyBlurbKey(group, level.id))}
                  </span>
                </span>
                <Icon
                  name="chevronForward"
                  size={18}
                  className="shrink-0 text-ink-faint transition-colors group-hover:text-accent"
                />
              </button>
            </li>
          ))}

          <li>
            <button
              type="button"
              onClick={onCustom}
              className={cn(
                'group flex w-full items-center gap-3.5 rounded-2xl border border-dashed border-rule bg-paper-raised p-3.5 text-left',
                'transition-colors duration-150 hover:border-accent',
              )}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-dashed border-rule text-ink-faint transition-colors group-hover:border-accent group-hover:text-accent">
                <Icon name="options" size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-[1.0625rem] font-semibold">
                  {t('exercise:levels.custom.title')}
                </span>
                <span className="mt-0.5 block text-sm leading-snug text-ink-muted">
                  {t('exercise:levels.custom.blurb')}
                </span>
              </span>
              <Icon
                name="chevronForward"
                size={18}
                className="shrink-0 text-ink-faint transition-colors group-hover:text-accent"
              />
            </button>
          </li>
        </ul>
      </div>
    </div>
  )
}
