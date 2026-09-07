# melina — project conventions

A PWA for preparing for classical composition studies. Ear training, dictation,
harmony, counterpoint and composition practice, all offline-capable and local-only.
The name comes from the toki pona word for melody.

## Commands

|                     |                                              |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | dev server                                   |
| `npm run build`     | typecheck + production build                 |
| `npm run preview`   | serve the production build                   |
| `npm run typecheck` | `tsc -b`                                     |
| `npm run lint`      | oxlint                                       |
| `npm run format`    | Prettier (also sorts Tailwind classes)       |
| `npm test`          | Vitest                                       |
| `npm run icons`     | regenerate PWA icons from `scripts/mark.mjs` |

## Architecture

**The curriculum registry is the single source of truth.** `src/config/curriculum.ts`
defines every category and exercise. The top navigation, the homescreen map and the
routes all derive from it. **Never hardcode a category or exercise list in a
component** — add it to the registry and the UI follows.

Four config files, deliberately separate:

- `config/curriculum.ts` — _what_ melina teaches (content)
- `config/pathLayout.ts` — _where things sit_ on the homescreen (composition)
- `config/musicMarks.ts` — decorative notation geometry
- `config/features.ts` — _what is switched on_ (feature flags)
- `config/exerciseComponents.ts` — which exercises have a real implementation

An exercise lives in `src/exercises/<name>/` and is reached through
`exerciseComponents.ts`; anything absent falls back to the placeholder page, so a
module can be registered in the curriculum long before it is built.

Every module is registered from day one so the path shows the whole journey; only
flagged-on modules are reachable. Enabling a module is a one-line change in
`features.ts`. Tests enforce that every category has a flag and vice versa.

**State lives in Dexie** (`src/lib/db/`), not in React. There is no server and no
account — everything is local. Bump the version and add a `.stores()` block to
migrate; never edit an existing version in place or installed clients will not
upgrade.

## Style

- TypeScript strict, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
  No `any`. No non-null `!` without a comment justifying it.
- `verbatimModuleSyntax` is on: type-only imports must use `import type`.
- `erasableSyntaxOnly` is on: no enums, no constructor parameter properties.
- Named exports everywhere except route/page components (which are default exports
  so they can be lazily loaded later).
- Function components and hooks only. Props interface named `XProps`, colocated.
- Absolute imports via `@/`. No barrel files — they defeat tree-shaking.
- A file that exports a component should export _only_ components, so React Fast
  Refresh keeps working. Put helpers in a sibling module (see
  `ui/Button.tsx` → `ui/buttonClasses.ts`).
- PascalCase component files, camelCase utilities.
- Prettier and its Tailwind class-order plugin are authoritative. Do not hand-sort.

## Design system

Light theme only. One accent colour, otherwise paper and ink.

**Never write a raw hex value or an arbitrary colour in a component.** All colour,
type and easing tokens live in the `@theme` block of `src/styles/index.css`; add a
token there rather than inlining a value.

| token                             | value                             |                                       |
| --------------------------------- | --------------------------------- | ------------------------------------- |
| `paper` / `paper-raised`          | `#fcfcfa` / `#ffffff`             | page ground, cards                    |
| `ink` / `ink-muted` / `ink-faint` | `#1c1c1e` / `#55555a` / `#8a8a90` | text, paint spots                     |
| `rule`                            | `#e4e4e0`                         | hairlines                             |
| `accent`                          | `#0d6e6e`                         | 6.1:1 on paper, 6.2:1 white-on-accent |
| `correct` / `wrong`               | `#3f7a34` / `#b3261e`             | feedback                              |

`correct` is deliberately warm-shifted so it never reads as "a lighter accent" next
to teal chrome. **Feedback must never rely on colour alone** — always colour plus
icon plus motion.

Headings are EB Garamond, body and UI are Inter. Garamond runs light on screen, so
display sizes are bumped and tracked tighter than a stock scale (`text-display`,
`text-title`, `text-heading`). Fonts are self-hosted and Latin-subset only — a
Google Fonts link would break offline, and the other subsets quadruple the precache.

Icons are Ionicons via `react-icons/io5`, behind `ui/Icon.tsx`. Add icons to the
explicit `ICONS` map there. **Never `import * as`** from `react-icons` — it defeats
tree-shaking and pulls in the whole set.

## The homescreen path

One vertically scrolling column of stations, serpentining side to side — the
whole curriculum as a single journey. There is no map, no zoom, no drag and no
list toggle; scrolling is the browser's own, which is what keeps it usable with
a keyboard, a screen reader and a thumb without special cases.

`position.y` is the centre of a station's **medallion**, not of its whole node
box. The label hangs below and is excluded from the anchor, because connectors
are drawn from `position.y` — centring the whole box instead pushed every
medallion up by half a label (a different amount per node, depending on whether
the title wrapped) and left the dashed route touching nothing.
`MEDALLION_SIZE` lives in `pathLayout.ts` and is consumed by `PathNode`, so the
geometry cannot drift apart again.

Station labels are `min(10.5rem, 42vw)` wide so a title near the edge of the
column is never clipped on a narrow screen; `pathLayout.test.ts` checks this
across viewports from 320px up.

The decoration layer is deliberately **unclipped**. Splats are meant to bleed
off the sides of the column and past the ends of the path — the only thing that
should ever crop one is the edge of the viewport, which the scroll container
already handles. Clipping them to the column cut them along a hard straight
edge, very visible on wide screens. Because nothing clips them, parallax depth
has to stay small, or drift would push a splat well past the last station and
add dead scroll.

Positions in `config/pathLayout.ts` mix units on purpose: **x is a percentage of
the column width, y is absolute pixels.** That keeps the serpentine's
proportions identical on a phone and a desktop while labels stay at their
natural size. Connectors are drawn in one SVG with a `0 0 100 PATH_HEIGHT`
viewBox and `preserveAspectRatio="none"` so its coordinate space _is_ that
mixed space; strokes are marked `vector-effect="non-scaling-stroke"` so the
horizontal stretch does not smear the dashes.

Decorations (ink splats, scattered notation) are placed one per horizontal
band, on the opposite side of the column from the nearest station. Both rules
exist because plain rejection sampling clumped everything into the bottom half
and dropped four fermatas next to each other. Splats are generated by
`lib/utils/splat.ts` rather than authored, seeded so they are identical on every
launch.

Parallax is driven by a single `--scroll` custom property that `PathView`
publishes once per animation frame; the decoration layer reads it in CSS. Never
re-render React on scroll.

## Accessibility

- Every interactive element is keyboard-reachable, and focus is always visible.
- Unplayable stations are `aria-disabled` **buttons**, not `div`s, so the whole
  path can be explored and a screen reader says why a station cannot be entered.
- Icon-only buttons need an `aria-label`; `ui/Icon` takes a `label` prop for it.
- Touch targets are at least 44px.
- **All animation is gated on `useReducedMotion`.** Parallax and draw-in must
  fully switch off when the OS asks.

## Testing

Vitest with jsdom. `src/test/setup.ts` stubs `matchMedia` and `ResizeObserver` and swaps in
`fake-indexeddb`; it also clears the Dexie tables between tests and fails any
test that logs a React error.

Render smoke tests (`src/App.test.tsx`) exist because a clean typecheck is not
evidence the app runs: an earlier version typechecked perfectly and crashed on
first paint, because a library's declared return type did not match what it
actually returned. Keep them.

`config/pathLayout.test.ts` guards the composition itself — that every category
is on the path exactly once, that it runs strictly downhill, that spacing stays
uneven, that the decoration samplers place their full count, that connectors
start and end on the stations they join, and that no label overflows the column
at any supported width. The last two are regression guards for real bugs.

## Music theory — `src/lib/music/`

**A pitch is a spelling, not a frequency.** `Pitch` carries a letter, an alteration
and an octave, and everything runs on two independent axes: `diatonicValue` (letter
position) and `chromaticValue` (semitones). That is what makes C→D♭♭ a diminished
second and C→C a perfect unison, when both span zero semitones. Never collapse a
pitch to a MIDI number and expect intervals to survive it.

Two rules the model enforces, both discovered by the round-trip test rather than
reasoned out in advance:

- **An interval cannot span negative semitones.** This rules out the diminished
  unison, the doubly-diminished unison and the doubly-diminished second. It is
  the general rule; do not re-add a special case for unisons.
- The **diminished second is real** and spans exactly zero semitones. Telling it
  from a perfect unison is a thing the app teaches, so it must never be
  "simplified" away.

`transpose` returns `undefined` rather than inventing a triple accidental; callers
retry with a different root.

The catalog (`catalog.ts`) orders qualities smallest-first — d, m, P, M, A — and
the keyboard gives each one a fixed column so a quality never moves between rows.

## Notation — `src/lib/notation/` and `src/components/notation/`

**Print an accidental only when it differs from the key signature.** `@accid` is
written and drawn; `@accid.ges` is gestural and silent. In D major an F♯ takes
`accid.ges` and prints nothing, while an F♮ takes `accid` and prints a natural.
Getting this backwards produces notation that reads perfectly and means something
else, which no type checker will catch — `verovio.test.ts` asserts it end to end by
counting drawn glyphs.

Verovio is **~7 MB of WebAssembly embedded in JavaScript**, not a separate `.wasm`
file. It must stay lazy: dynamic `import()` only, from a `React.lazy` route, in its
own named Rollup chunk, excluded from the Workbox precache by `globIgnores` and
cached at runtime instead. If precache jumps from ~544 KiB to ~8 MB, that wiring
has been broken. Leland ships inside the wasm; `setResourcePath` is a no-op on web.

The question generator anchors a note's accidental to the key signature ~78% of the
time. Picking uniformly at random is what produced F♭ in D major and A♯♯ in C major
— valid spellings that no one would ever write.

## Not yet built

Interval Hearing is next, and brings audio: `smplr` for sampled instruments. That
needs its own offline-caching design, like Verovio got.
