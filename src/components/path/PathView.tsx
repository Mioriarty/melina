import { useEffect, useRef } from 'react'

import { PATH_HEIGHT, orderedPathNodes } from '@/config/pathLayout'

import { PathConnectors } from './PathConnectors'
import { PathDecorations } from './PathDecorations'
import { PathNode } from './PathNode'

export interface PathViewProps {
  reducedMotion: boolean
}

/**
 * The homescreen: one vertically scrolling path through the curriculum.
 *
 * Scrolling is the browser's own — no gesture handling, no zoom, no drag —
 * which is what makes this reachable with a keyboard, a screen reader and a
 * thumb without any special cases. The only scroll work we do is publishing
 * the offset as a custom property for the parallax layer.
 */
export function PathView({ reducedMotion }: PathViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scroller = scrollRef.current
    const surface = surfaceRef.current
    if (scroller === null || surface === null || reducedMotion) return

    let frame = 0
    const update = () => {
      frame = 0
      surface.style.setProperty('--scroll', `${scroller.scrollTop}px`)
    }

    const onScroll = () => {
      // Coalesce to one style write per frame; scroll fires far more often.
      if (frame === 0) frame = requestAnimationFrame(update)
    }

    update()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [reducedMotion])

  return (
    <div ref={scrollRef} className="h-full overflow-x-hidden overflow-y-auto">
      <div ref={surfaceRef} className="mx-auto w-full max-w-[34rem] px-4">
        <header className="pt-8 pb-2 text-center">
          <h1 className="text-title">Your path</h1>
          <p className="mx-auto mt-2 max-w-xs text-[0.9375rem] leading-relaxed text-balance text-ink-muted">
            Eight stations, from hearing an interval to writing your own counterpoint.
          </p>
        </header>

        <div className="relative" style={{ height: PATH_HEIGHT }}>
          <PathDecorations reducedMotion={reducedMotion} />
          <PathConnectors reducedMotion={reducedMotion} />

          {orderedPathNodes().map(({ position, category }, index) => (
            <PathNode
              key={category.id}
              category={category}
              position={position}
              index={index}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
