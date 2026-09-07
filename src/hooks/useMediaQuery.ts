import { useSyncExternalStore } from 'react'

/**
 * Subscribe to a CSS media query. Uses `useSyncExternalStore` so the value is
 * correct on the very first render — a `useEffect` version would flash the
 * wrong layout for one frame on mobile.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
