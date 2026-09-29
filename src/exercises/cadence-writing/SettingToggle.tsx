import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils/cn'

export interface SettingToggleProps {
  showCorrection: boolean
  onChange: (showCorrection: boolean) => void
}

/**
 * Which setting the staff shows once a wrong one is in: the corrected one or
 * the player's own.
 *
 * Two segments of one pill rather than a checkbox, because both states are
 * something to look at and neither is "off". Each segment is a full 44px
 * target, and the chosen one is filled as well as coloured.
 */
export function SettingToggle({ showCorrection, onChange }: SettingToggleProps) {
  const { t } = useTranslation('exercise')

  const segment = (selected: boolean) =>
    cn(
      'min-h-11 rounded-full px-4 text-sm font-medium transition-[background-color,color,transform] duration-150 active:scale-95',
      selected ? 'bg-accent text-white' : 'text-ink-muted hover:text-accent',
    )

  return (
    <div
      role="group"
      aria-label={t('satb.toggle')}
      className="inline-flex rounded-full border border-rule bg-paper-raised p-0.5"
    >
      <button
        type="button"
        aria-pressed={showCorrection}
        onClick={() => onChange(true)}
        className={segment(showCorrection)}
      >
        {t('satb.corrected')}
      </button>
      <button
        type="button"
        aria-pressed={!showCorrection}
        onClick={() => onChange(false)}
        className={segment(!showCorrection)}
      >
        {t('satb.yours')}
      </button>
    </div>
  )
}
