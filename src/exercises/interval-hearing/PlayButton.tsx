import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'

export interface PlayButtonProps {
  onPlay: () => Promise<void>
  /** Shown while the instrument's samples are still downloading. */
  loading: boolean
  failed: boolean
}

/**
 * Replay the interval.
 *
 * Sits beside the staff rather than under it: the notation and the sound are
 * two halves of the same question, and the button is reached without the eye
 * leaving the note.
 */
export function PlayButton({ onPlay, loading, failed }: PlayButtonProps) {
  const { t } = useTranslation('exercise')
  const [busy, setBusy] = useState(false)

  const label = failed
    ? t('play.unavailable')
    : loading
      ? t('play.loading')
      : t('play.again')

  return (
    <button
      type="button"
      onClick={() => {
        setBusy(true)
        void onPlay().finally(() => setBusy(false))
      }}
      disabled={loading || failed}
      className={cn(
        'grid h-14 w-14 place-items-center rounded-full border-2 transition-all duration-150',
        'disabled:cursor-default disabled:opacity-45',
        failed
          ? 'border-rule text-ink-faint'
          : 'border-accent text-accent hover:bg-accent hover:text-white',
        busy && !loading && 'scale-95',
      )}
    >
      <Icon name={failed ? 'close' : 'volume'} size={24} label={label} />
    </button>
  )
}
