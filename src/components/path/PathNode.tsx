import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Icon } from '@/components/ui/Icon'
import type { Station } from '@/config/curriculum'
import { isCategoryEnabled } from '@/config/features'
import { MEDALLION_SIZE, type PathNodePosition } from '@/config/pathLayout'
import { cn } from '@/lib/utils/cn'

/**
 * `open`   — playable now.
 * `next`   — registered as ready but not switched on yet.
 * `locked` — registered, not started.
 */
type NodeState = 'open' | 'next' | 'locked'

function nodeState(station: Station): NodeState {
  if (station.status !== 'ready') return 'locked'
  return isCategoryEnabled(station.category) ? 'open' : 'next'
}

export interface PathNodeProps {
  station: Station
  position: PathNodePosition
  index: number
  reducedMotion: boolean
}

/**
 * One station on the path.
 *
 * `position.y` is the centre of the **medallion**, not of the whole node —
 * the label hangs below it and is not part of the anchor. Centring the whole
 * box instead would push each medallion up by half its label, by a different
 * amount depending on whether the title wraps, and the connectors drawn from
 * `position.y` would no longer meet the circles.
 *
 * The label is sized `min(10.5rem, 42vw)` so a station near the edge of the
 * column can never have its title clipped by the side of a narrow screen.
 *
 * Open stations are links; everything else is a button marked `aria-disabled`
 * rather than a `div`, so the whole path stays reachable by keyboard and a
 * screen reader announces why a station cannot be entered yet.
 */
export function PathNode({ station, position, index, reducedMotion }: PathNodeProps) {
  const { t } = useTranslation('path')
  const state = nodeState(station)

  const medallion = cn(
    'grid shrink-0 place-items-center rounded-full',
    'transition-[transform,background-color,border-color] duration-200 ease-[--ease-out-soft]',
    state === 'open' &&
      'bg-accent text-white shadow-lg shadow-accent/30 group-hover:-translate-y-1',
    state === 'next' &&
      'border-2 border-dashed border-accent bg-paper-raised text-accent shadow-md shadow-accent/15',
    state === 'locked' &&
      'border-2 border-dashed border-rule bg-paper-raised text-ink-faint',
  )

  const content = (
    <>
      <span
        className={medallion}
        style={{ width: MEDALLION_SIZE, height: MEDALLION_SIZE }}
      >
        <Icon name={state === 'locked' ? 'lock' : station.icon} size={30} />
      </span>

      <span className="mt-2.5 grid justify-items-center gap-0.5">
        <span
          className={cn(
            'font-serif text-[1.0625rem] leading-tight font-semibold tracking-tight text-balance',
            state === 'locked' ? 'text-ink-muted' : 'text-ink',
          )}
        >
          {t(station.titleKey)}
        </span>
        <span className="text-[0.75rem] font-medium tracking-wide text-ink-faint uppercase">
          {t(`state.${state}`)}
        </span>
      </span>
    </>
  )

  const shell =
    'group absolute top-0 left-0 flex w-[min(10.5rem,42vw)] flex-col items-center rounded-2xl px-1 text-center'

  return (
    <div
      className={cn('absolute', !reducedMotion && 'path-node')}
      style={{
        left: `${position.x}%`,
        top: position.y,
        ...(reducedMotion ? {} : { animationDelay: `${index * 80 + 60}ms` }),
      }}
    >
      {state === 'open' ? (
        <Link
          to={station.path}
          className={shell}
          // Lift by half a medallion so the circle, not the box, sits on the
          // anchor point the connectors are drawn to.
          style={{ transform: `translate(-50%, ${-MEDALLION_SIZE / 2}px)` }}
          draggable={false}
        >
          {content}
        </Link>
      ) : (
        <button
          type="button"
          className={cn(shell, 'cursor-not-allowed')}
          style={{ transform: `translate(-50%, ${-MEDALLION_SIZE / 2}px)` }}
          aria-disabled="true"
          onClick={(event) => event.preventDefault()}
        >
          {content}
        </button>
      )}
    </div>
  )
}
