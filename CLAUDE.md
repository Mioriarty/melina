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
component** — add it to the registry and the UI follows. The registry holds ids,
icons and status only; titles and blurbs are translated (see below).

Four config files, deliberately separate:

- `config/curriculum.ts` — _what_ melina teaches (content)
- `config/pathLayout.ts` — _where things sit_ on the homescreen (composition)
- `config/musicMarks.ts` — decorative notation geometry
- `config/features.ts` — _what is switched on_ (feature flags)
- `config/exerciseComponents.ts` — which exercises have a real implementation
- `lib/audio/instruments.ts` — the instruments notes can be played with

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

## Internationalisation — `src/lib/i18n/` and `src/locales/`

English and German, through i18next and `react-i18next`. **No user-visible string
is written in a component.** `src/locales/<lang>/<namespace>.json` holds every one
of them, bundled into the app rather than fetched — a language that only arrives
over the network is a language that is missing on a train.

Namespaces map to areas of the app so a string can be found from where it appears:
`common`, `path`, `curriculum`, `levels`, `exercise`, `music`, `settings`.

Three kinds of key:

- **Written by hand** in the JSON, read with `t('exercise:round.question')`.
- **Derived from a registry id.** `curriculum.ts` and `difficulty.ts` build these
  (`categoryTitleKey`, `exerciseShortKey`, `difficultyTitleKey`, …) so a rename in
  the registry moves the key with it and nothing spells the mapping out twice.
- **Music vocabulary**, reached through the `useMusicNames` hook.

**`lib/music` and `lib/audio` carry no display strings at all.** A clef, a key
signature, an interval quality and a pitch letter are all named differently in
German — B♭ major is "B-Dur", the note English calls B is H, and the quality
inflects ("reine Quinte", not "Rein Quinte") — so none of it survives a sentence
assembled from English parts. The data files keep ids and arithmetic; the names
live in the `music` namespace and are read through `useMusicNames`, which is a
hook so the labels re-render when the language changes.

The chosen language is a Dexie setting (`UI_LANGUAGE`), not React state, so it
survives a reload and reaches every screen. `null` means "never chose one", which
is different from choosing English: it lets the browser's own preference keep
deciding. `main.tsx` reads it before the first paint so a German browser does not
flash German at someone who picked English, and `useLanguage` (called once, in
`AppShell`) keeps i18next and `document.documentElement.lang` in step afterwards.

`locales.test.ts` is the guard that makes adding a language safe: a missing key
does not crash — i18next quietly falls back — so it walks every namespace and
insists the languages hold exactly the same keys with exactly the same
placeholders, then checks that every key built at runtime from a registry id
actually resolves.

The PWA manifest and the `<meta name="description">` in `index.html` stay English:
both are read at build and install time, before any of this runs.

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

## Deployment

GitHub Pages, from `.github/workflows/deploy.yml` on every push to `main`. The
site is a **project page**, so it is served from `/melina/`, not from a domain
root, and two things depend on that:

- `base` is `/melina/` for `vite build` only — dev and Vitest stay at `/`, which
  is why route assertions in tests can keep using bare `/train/...` paths. The
  router's basename comes from `import.meta.env.BASE_URL`, never from a
  hardcoded string. `VITE_BASE_PATH` overrides it.
- Pages serves `404.html` for any path with no file behind it, so
  `scripts/spa-fallback.mjs` copies `index.html` there after the build. Without
  it, every deep link and every refresh inside an exercise is a dead end on the
  first visit — the service worker's `navigateFallback` only covers later ones.

The PWA manifest deliberately omits `start_url` and `scope`; vite-plugin-pwa
fills both from `base`. Hardcoding `/` there installed an app that opened on a
blank page.

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

Ids and arithmetic only — every name a player reads is translated. See
**Internationalisation**.

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

**A mode is stored as the interval from its tonic to each degree** (`scale.ts`),
never as a list of semitones — that is what makes B♭ dorian come out as B♭ C D♭ E♭
F G A♭ rather than B♭ C C♯ D♯. `scalePitches` walks the letters and lets
`transpose` work out each accidental, so it returns `undefined` for a scale that
would need a triple accidental instead of inventing one.

Which tonics a mode may stand on is **computed, not tabulated**: `isCleanScale`
spells the scale and rejects anything past a double accidental, so A♭ locrian
(B double flat) and G♯ lydian (F triple sharp) drop out on their own and a new
mode needs no one to work the exceptions out again. `modeOf` reads a run of
pitches back to the mode that spelled it, which is how the generator is checked
rather than trusted.

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

**A double sharp is `x`, not `ss`.** MEI has both and they draw differently: `ss`
is two separate sharp signs, which is what Verovio drew for months. A double flat
_is_ two flats, so `ff` is right. Written and gestural accidentals are separate MEI
data types with separate lists — the gestural list has no `x` — so they are two
maps in `mei.ts` and must not be merged.

**A harmonic unison is written as two successive noteheads, not as a chord.** Both
noteheads want the same spot on the staff, so stacked, C→C♯ and C♯→C♯ engrave as
_the same picture_: one sharp against two touching noteheads. Side by side each
note carries its own accidental. The rule lives in `harmonicIntervalMei` rather
than in an exercise, because it is engraving, not gameplay. Anything spanning two
staff positions still stacks — including the diminished second, which has to go on
looking like a second.

**A scale is always keyless** (`scaleMei` writes the signature itself rather than
taking one). A mode is read from the accidentals in front of its notes, and under a
signature F♯ mixolydian looks exactly like G major.

**How airy the notation looks is note spacing, not staff size** —
`SCALE_NOTE_SPACING` in `lib/notation/verovio.ts` is the dial. The reason is
that the page only ever scales an engraved SVG _down_ to fit its column: a
staff wider than the column is fitted to exactly that width whatever size it
was drawn at, so for anything that overflows, staff size changes nothing you
can see. Eight notes always span the column, and spacing decides how large the
notes are within it. Widening it therefore spreads the notes _and_ shrinks the
staff, in the same space on screen — which is the effect, not a side effect.

Scales use 0.45 against Verovio's default of 0.25, which takes the staff from
104px to 62px in a 375px phone's column. The scale is steeper than it looks:
0.6 is already four times as wide as 0.25, and the engraver refuses anything
above 1.0. Staff size still matters for an interval, which is two notes wide
and never overflows.

Spacing is applied per render rather than once at startup, since one toolkit is
shared by the whole app. `renderMei` sets the options immediately before the
render they belong to, and everything from there to `renderToSVG` is
synchronous, so no other render can interleave and pick up the wrong spacing.

## Audio — `src/lib/audio/`

Sampled, not synthesised: ear training is about timbre as much as pitch, and a
sine wave teaches you to recognise a sine wave. `smplr` streams a Steinway
(`SplendidGrandPiano`) and an orchestral harp (`Soundfont`, MusyngKite kit).

Two rules the browser imposes, both easy to get wrong:

- **An AudioContext must be created and resumed inside a user gesture.** That
  gesture is the "Start round" tap, which calls `unlockAudio()`. Do this in the
  handler itself, not in an effect afterwards.
- A context can be **suspended again** whenever a tab is backgrounded, so
  `playSequence` resumes defensively before every note.

`playInterval` and `playScale` are both thin wrappers over `playSequence`, which
schedules a run of notes; a gap of zero is what makes an interval harmonic. A
scale is played faster and shorter than an interval — eight notes at interval pace
is a series of separate notes rather than a scale.

Sample requests are cached at runtime (`melina-samples`), never precached — the
piano alone is tens of megabytes, and which instrument you practise with is your
choice, not the installer's. `smplr` itself is a small lazy chunk and _is_
precached, so only the samples need the network.

The instrument type is imported from smplr rather than declared by hand, so an
upstream API change is a type error. Declaring it structurally hid the fact that
`output.setVolume` had been deprecated in favour of `output.volume`.

## The path is made of stations, not categories

`stations()` in `config/curriculum.ts` derives the homescreen stops: a category
with **built exercises contributes one station per exercise**, and one with
nothing built yet contributes a single locked station for itself. Interval
Reading and Interval Hearing are different games, so they get separate stops
rather than one that has to guess which you meant.

A station carries `titleKey` and `blurbKey`, not a title — the words come from
`curriculum.json`.

Positions in `pathLayout.ts` are hand-placed by **station id**, so shipping an
exercise means adding a coordinate. `orderedPathNodes` falls back to the end of
the path for an unplaced station so nothing can silently vanish, and
`pathLayout.test.ts` asserts the fallback is never actually reached.

## Exercises — `src/exercises/`

Four exercises in two pairs, and the folders say which is which:

- `shared/` is **exercise-agnostic**. The levels → setup → round → summary state
  machine (`useRound`), the levels screen, the round screen, the summary, the
  setup chips and the play button all live here, generic over what is being
  asked and what answers it. It must never learn what an interval or a mode is.
- `interval-shared/` and `scale-shared/` bind that machinery to one subject: a
  generator, a `RoundRules` object (how to build a round, what counts as right,
  what to write into the attempt log), and thin round-screen and summary
  wrappers that supply the right keyboard and the right names.
- `interval-reading/`, `interval-hearing/`, `scale-reading/`, `scale-hearing/`
  hold only what differs: settings, levels, a setup screen, and the component
  that decides what notation to show.

Within a pair, reading and hearing differ only in what notation they show and
whether there is a play button beside it, so anything else belongs one level up.
When a third pair arrives, generalise `shared/` rather than copying a sibling.

**A string read by a shared screen may not name what only one pair asks
about.** The Custom row said "choose the clefs, keys and intervals" and the
play button was labelled "Play the interval again" — on screens that ask about
modes. `ScaleExercise.test.tsx` walks the levels, settings and round screens
and fails on the word "interval", in visible text _and_ in accessible names,
because an icon-only button says nothing in its text.

**Levels are the landing screen**, not the settings form. Each exercise defines
a `difficulties.ts` of named presets, and picking one starts a round in the same
tap — the presets exist so that practising is one tap rather than a trip through
six sets of checkboxes. Custom is last and opens the full settings screen. They
are levels, not a difficulty ladder: "Descending" is not harder than "Flat Keys",
it is a different weakness.

A preset is an id and a settings object; its name and one-line description live in
`levels.json` under `<group>.<id>`, where the group names the _exercise_
(`scale-reading`), not the kind — interval reading and scale reading are both
"reading" and share nothing else.

Levels are data, so `shared/difficulties.test.ts` checks what types cannot — that
every preset names real clefs, keys, intervals, modes and tonics, is named and
described in every language, round-trips through the defensive settings parser
unchanged, and actually generates a **full** round. A level too narrow to place
its intervals, or whose modes will not spell on any of its tonics, would
otherwise serve a short round in silence.

`staffOnly` narrows a clef to its five lines, removing ledger lines entirely —
the difference between reading an interval and counting lines above the staff.
Because that range is barely more than an octave, `generateRound` retries
without it rather than dropping a wide interval from the round.

**Hearing offers only intervals that sound different from one another** —
`HEARABLE_INTERVAL_KEYS` in `lib/music/catalog.ts`. Spelling is inaudible: an
augmented second _is_ a minor third to the ear, a diminished second _is_ a
perfect unison. Offering both names for one sound makes a question unanswerable
however well you listen, so the set holds exactly one interval per semitone
count. Six semitones has no plain spelling, so the tritone is the augmented
fourth and the diminished fifth is dropped. `catalog.test.ts` enforces the
uniqueness property rather than the list, so a well-meant addition fails loudly.
Reading is unaffected — there the spelling is on the page to be read.

`PlayDirection` (`harmonic | ascending | descending`) decides three things at
once: how the interval is played, how it is engraved, and **which note is on
screen before the answer**. The note heard first is the note shown first, so a
descending interval reveals its upper note and everything else its lower one —
that rule lives in `leadingNote()` and nowhere else. Scales follow the same rule
through `firstNote()`: ascending starts on the tonic, descending on the octave
above it. There is no harmonic option for a scale — eight notes at once is a
cluster.

**Every mode sounds different from every other**, so scale hearing needs no
equivalent of `HEARABLE_INTERVAL_KEYS`; `scale.test.ts` asserts that property
rather than assuming it. What scale hearing has instead is which modes are set
_against_ each other: lydian alone is unmistakable, lydian beside ionian is one
raised note.

On a keyless staff **the tonic decides how much ink is on the page** — B♭ locrian
prints seven accidentals in eight notes — which is why tonics are a setting and a
level axis of their own.

## Not yet built

Melodic dictation is next. Everything after Scale Training is still a placeholder
page.

Settings holds one setting — the interface language. It is reached only from the
button at the far left of the top bar; there is no station for it on the path,
because it is not something you practise.
