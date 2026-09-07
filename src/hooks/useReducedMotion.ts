import { useMediaQuery } from './useMediaQuery'

/**
 * Every animation in melina is gated on this. The map's inertia, parallax and
 * path draw-in are decorative, and must fully switch off when the OS asks.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}
