import { useTranslation } from 'react-i18next'

import type { VerovioOptions } from 'verovio/esm'

import { Score } from '@/components/notation/Score'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'

import { SCORE_BOX } from './scoreBox'
import type { PlaybackStatus } from './usePlayback'

/**
 * The notation, which is also the play button.
 *
 * Pressing the notes sounds them, rather than a separate control sitting
 * beside the staff: the notation *is* the thing being played, and a button
 * next to it was one more piece of furniture to explain.
 *
 * It is only pressable when every note is on screen — a hearing question can
 * be replayed at any time, a reading question only once its answer is out,
 * since before that the sound would give it away. When it is not, the staff
 * is a plain image and says nothing about playing.
 *
 * **The affordance is a mark on the staff, not a line of text under it.** A
 * caption saying "tap the notes to hear them" spent a whole line of the screen
 * on something you learn once, and on a short screen that line came out of the
 * notation's height — the scarcest thing there is here. A muted speaker in the
 * corner says the same thing where the thing it describes already is, and it
 * sits over the staff rather than beside it, so it costs no height at all.
 *
 * The staff is bounded by the room left for it rather than by a slice of the
 * viewport — see `SCORE_BOX`, which is why the row is `items-stretch` and the
 * button `h-full`.
 */

export interface PlayableScoreProps {
  mei: string
  /** What the notation shows, for screen readers. Never the answer. */
  label: string
  noteSpacing?: number
  /**
   * The page to engrave onto, for notation that needs one — a grand staff is
   * neither the size nor the shape of a single-staff example. Must be a stable
   * reference: `Score` compares it by identity.
   */
  profile?: VerovioOptions
  /**
   * How much room the staff may take. `SCORE_BOX` by default; notation that is
   * genuinely taller than one staff passes `PHRASE_SCORE_BOX` instead.
   */
  box?: string
  /** Sound the notes. Omitted while the answer is still hidden. */
  onPlay?: (() => void) | undefined
  status?: PlaybackStatus
}

export function PlayableScore({
  mei,
  label,
  noteSpacing,
  profile,
  box = SCORE_BOX,
  onPlay,
  status = 'idle',
}: PlayableScoreProps) {
  const { t } = useTranslation('exercise')

  const paper = {
    ...(noteSpacing === undefined ? {} : { noteSpacing }),
    ...(profile === undefined ? {} : { profile }),
  }

  /**
   * **The frame is the same whether or not it is pressable.**
   *
   * It used not to be: a plain score was a direct child of the stretching row,
   * so a box capped below the room available sat at the *top* of it, while the
   * button branch centred its contents — and the button's own padding left it
   * a little narrower besides. Nothing showed that up while only one staff was
   * ever on screen, but it meant a reading question's notation shifted and
   * resized the moment its answer arrived and the play button appeared with
   * it. The comparison of two staves side by side is what finally made it
   * visible: one drawn higher and larger than the other.
   */
  const frame = cn(
    'relative flex h-full min-h-0 max-w-full flex-1 items-center justify-center',
    'rounded-2xl px-2 py-1',
  )

  return (
    <div className="flex min-h-0 w-full max-w-full flex-1 items-stretch justify-center">
      {onPlay === undefined ? (
        <div className={frame}>
          <Score className={box} mei={mei} label={label} {...paper} />
        </div>
      ) : (
        <button
          type="button"
          onClick={onPlay}
          disabled={status === 'failed'}
          // Both halves in one name: what is on the staff, and what pressing
          // it does. A button takes its name from this rather than from the
          // image inside it, so the description has to be here or it is lost.
          aria-label={t('play.scoreLabel', { notes: label })}
          className={cn(
            frame,
            'transition-[background-color,transform] duration-150',
            // The press has to be felt on a touch screen, where there is no
            // hover to say a thing is pressable and nothing else answers a
            // tap: the notes are the button, and a button that does not move
            // under a thumb reads as one that did not take the press.
            'hover:bg-accent-tint/70 active:scale-[0.97] active:bg-accent-tint',
            'disabled:cursor-default disabled:bg-transparent disabled:active:scale-100',
          )}
        >
          <Score className={box} mei={mei} label={label} {...paper} />
          <PlayMark status={status} />
        </button>
      )}
    </div>
  )
}

/**
 * The speaker in the corner, and what it turns into.
 *
 * Absolutely placed so it takes none of the notation's height, and faint so it
 * cannot be mistaken for part of the music. It still carries the two things
 * the caption used to say — that the samples are on their way, and that
 * playback has failed — because those are the moments a press does not do what
 * it looks like it will.
 *
 * `title` rather than a label: the button around it is already named, and a
 * second name inside would be read out twice.
 */
/**
 * Big enough to read at a glance and to be understood as a control rather than
 * a speck. It sits over the staff's own top-right corner, where notation never
 * reaches — the highest a note goes is the top line plus its ledger lines, and
 * those are drawn at the note, not at the end of the bar.
 */
const MARK = 'absolute top-1 right-1 grid h-7 w-7 place-items-center'

function PlayMark({ status }: { status: PlaybackStatus }) {
  const { t } = useTranslation('exercise')

  if (status === 'loading') {
    return (
      <span className={MARK} title={t('play.loading')}>
        <span
          // Gated the CSS way rather than through `useReducedMotion`, so a
          // presentational component needs no prop for it.
          className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faint/25 border-t-ink-faint/80 motion-reduce:animate-none"
        />
      </span>
    )
  }

  return (
    <span
      className={cn(
        MARK,
        status === 'failed' ? 'text-ink-faint/75' : 'text-ink-faint/55',
      )}
      title={status === 'failed' ? t('play.unavailable') : t('play.hint')}
    >
      <Icon name={status === 'failed' ? 'close' : 'volume'} size={26} />
    </span>
  )
}
