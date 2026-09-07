import { Outlet } from 'react-router'

import { TopNav } from './TopNav'

export interface AppShellProps {
  /**
   * Exercises hide the header: they fill the screen, and each one provides
   * its own way back so the chrome is not carrying anything.
   */
  header?: boolean
}

/**
 * Page frame.
 *
 * Exactly viewport height and `overflow-hidden`, so the page itself never
 * scrolls. Anything that needs to scroll — the homescreen path, an exercise
 * setup screen, a keyboard — owns a scroll container of its own. Letting the
 * document scroll as well produces two nested scrollbars that fight, and on
 * iOS lets the whole app rubber-band away from the viewport.
 *
 * Uses `100dvh` rather than `vh` so mobile browser chrome does not cover the
 * bottom of the layout.
 */
export function AppShell({ header = true }: AppShellProps) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <a
        href="#main"
        className="sr-only rounded-full bg-accent px-4 py-2 text-white focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:ring-accent"
      >
        Skip to content
      </a>

      {header && <TopNav />}

      <main id="main" className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
