import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Icon } from '@/components/ui/Icon'
import type { Station } from '@/config/curriculum'
import { isCategoryEnabled } from '@/config/features'
import { labelWidthCss, MEDALLION_SIZE, type PathNodePosition } from '@/config/pathLayout'
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

/**
 * What the overline under a station's title says.
 *
 * A guide is not open or locked in the way an exercise is — there is nothing to
 * unlock and no progress to make — so it says what it *is* instead. That is the
 * whole of why `kind` exists on a `Station`: a reader has to be able to tell,
 * before tapping, that this stop is something to read rather than something to
 * be tested on.
 */
function overline(station: Station, state: NodeState): string {
  return station.kind === 'guide' && state !== 'locked' ? 'state.guide' : `state.${state}`
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
 * The label width comes from `labelWidthCss`, not from a class here: it is
 * normally `min(10.5rem, 42vw)`, so a station near the edge of the column can
 * never have its title clipped on a narrow screen, and narrower still for a
 * station in the braid, which has to share the column with the one standing
 * beside it. Both numbers depend on the positions, so they are worked out
 * where the positions live.
 *
 * Open stations are links; everything else is a button marked `aria-disabled`
 * rather than a `div`, so the whole path stays reachable by keyboard and a
 * screen reader announces why a station cannot be entered yet.
 */
export function PathNode({ station, position, index, reducedMotion }: PathNodeProps) {
  const { t } = useTranslation('path')
  const state = nodeState(station)

  // **A guide is drawn as a different shape, not only a different colour.** It
  // is a rounded square on paper with a solid accent hairline, against the
  // filled accent circle an exercise gets — so the difference survives a
  // colour-blind reader and a greyscale screenshot, which a tint alone would
  // not. The dashed borders are already spoken for by `next` and `locked`.
  const isGuide = station.kind === 'guide' && state !== 'locked'

  const medallion = cn(
    'grid shrink-0 place-items-center',
    'transition-[transform,background-color,border-color] duration-200 ease-[--ease-out-soft]',
    isGuide ? 'rounded-2xl' : 'rounded-full',
    isGuide &&
      'border-2 border-accent bg-paper-raised text-accent shadow-md shadow-accent/15 group-hover:-translate-y-1',
    !isGuide &&
      state === 'open' &&
      'bg-accent text-white shadow-lg shadow-accent/30 group-hover:-translate-y-1',
    !isGuide &&
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
        <span
          className={cn(
            'text-[0.75rem] font-medium tracking-wide uppercase',
            isGuide ? 'text-accent' : 'text-ink-faint',
          )}
        >
          {t(overline(station, state))}
        </span>
      </span>
    </>
  )

  const shell =
    'group absolute top-0 left-0 flex flex-col items-center rounded-2xl px-1 text-center'

  // Lift by half a medallion so the circle, not the box, sits on the anchor
  // point the connectors are drawn to.
  const box = {
    width: labelWidthCss(position),
    transform: `translate(-50%, ${-MEDALLION_SIZE / 2}px)`,
  }

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
        <Link to={station.path} className={shell} style={box} draggable={false}>
          {content}
        </Link>
      ) : (
        <button
          type="button"
          className={cn(shell, 'cursor-not-allowed')}
          style={box}
          aria-disabled="true"
          onClick={(event) => event.preventDefault()}
        >
          {content}
        </button>
      )}
    </div>
  )
}
