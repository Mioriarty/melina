import { Link } from 'react-router'

/**
 * The melina wordmark. The dot over the "i" is the accent — the smallest
 * possible paint spot, and the only place the accent appears in the header.
 */
export function Wordmark() {
  return (
    <Link
      to="/"
      className="group inline-flex items-baseline gap-0.5 font-serif text-[1.5rem] leading-none font-medium tracking-tight"
    >
      <span className="text-ink">mel</span>
      <span className="relative text-ink">
        i
        <span
          aria-hidden="true"
          className="absolute -top-px left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-accent transition-transform duration-300 ease-[--ease-out-soft] group-hover:scale-150"
        />
      </span>
      <span className="text-ink">na</span>
    </Link>
  )
}
