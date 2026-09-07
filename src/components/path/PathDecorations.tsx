import { MUSIC, PATH_HEIGHT, SPLATS } from '@/config/pathLayout'

import { MusicMarkGlyph } from './MusicMarkGlyph'

export interface PathDecorationsProps {
  /** Pins decorations to the page instead of drifting them against scroll. */
  reducedMotion: boolean
}

/**
 * The ink splats and scattered notation behind the path.
 *
 * Each decoration drifts against the scroll by its own depth factor, which
 * reads as distance. The drift is driven by a `--scroll` custom property that
 * PathView publishes once per frame, so scrolling costs one style write for
 * the whole layer rather than a React render per element.
 *
 * This layer is deliberately **not** clipped. Splats are meant to bleed off
 * the sides of the column and past the ends of the path; clipping them here
 * cut them along a hard straight edge partway down the page, which was very
 * visible on wide screens. The only thing that should ever crop a splat is
 * the edge of the viewport, which the scroll container already handles.
 */
export function PathDecorations({ reducedMotion }: PathDecorationsProps) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0"
      style={{ height: PATH_HEIGHT }}
      aria-hidden="true"
    >
      {SPLATS.map((splat) => (
        <svg
          key={splat.id}
          className={reducedMotion ? 'absolute' : 'path-parallax absolute'}
          style={{
            left: `${splat.x}%`,
            top: splat.y,
            width: splat.size,
            height: splat.size,
            opacity: splat.opacity,
            ...(reducedMotion
              ? { transform: `translate(-50%, -50%) rotate(${splat.rotation}deg)` }
              : { '--depth': splat.depth, '--rotate': `${splat.rotation}deg` }),
          }}
          viewBox="0 0 100 100"
          focusable="false"
        >
          <path d={splat.d} fill="var(--color-ink)" />
        </svg>
      ))}

      {MUSIC.map((decoration) => (
        <div
          key={decoration.id}
          className={
            reducedMotion ? 'absolute text-ink' : 'path-parallax absolute text-ink'
          }
          style={{
            left: `${decoration.x}%`,
            top: decoration.y,
            opacity: decoration.opacity,
            ...(reducedMotion
              ? { transform: `translate(-50%, -50%) rotate(${decoration.rotation}deg)` }
              : { '--depth': decoration.depth, '--rotate': `${decoration.rotation}deg` }),
          }}
        >
          <MusicMarkGlyph name={decoration.mark} width={decoration.size} />
        </div>
      ))}
    </div>
  )
}
