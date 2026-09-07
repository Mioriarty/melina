import { Wordmark } from './Wordmark'

/**
 * The header.
 *
 * Deliberately just the wordmark. The path itself is the navigation — a nav
 * bar duplicating it earned nothing, and on mobile a hamburger opening a menu
 * of the same eight stations was pure ceremony. Settings will live on the
 * right here when there is something worth putting in them.
 */
export function TopNav() {
  return (
    <header className="pt-safe sticky top-0 z-20 border-b border-rule bg-paper/85 backdrop-blur-md">
      <div className="flex h-14 items-center px-4 sm:px-5">
        <Wordmark />
      </div>
    </header>
  )
}
