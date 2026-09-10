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
| `npm run glyphs`    | re-extract Leland note glyphs from Verovio   |

## Architecture

**The curriculum registry is the single source of truth.** `src/config/curriculum.ts`
defines every category and exercise. The top navigation, the homescreen map and the
routes all derive from it. **Never hardcode a category or exercise list in a
component** — add it to the registry and the UI follows. The registry holds ids,
icons and status only; titles and blurbs are translated (see below).

Five config files, deliberately separate:

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

## Internationalisation — `src/lib/i18n/` and `src/locales/`

English and German, through i18next and `react-i18next`. **No user-visible string
is written in a component.** `src/locales/<lang>/<namespace>.json` holds every one
of them, bundled into the app rather than fetched — a language that only arrives
over the network is a language that is missing on a train.

Namespaces map to areas of the app so a string can be found from where it appears:
`common`, `path`, `curriculum`, `levels`, `exercise`, `music`, `settings`,
`progress`.

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

**The path opens braided and then merges.** Intervals run down the left, scales
down the right, reading above hearing on both, and the two tracks join at the
station below. Read across and it is the two subjects; read down and it is the
two ways of knowing one. Single file would have had to claim that scale reading
comes after interval hearing, which is true of neither the music nor the player.

So the route is a **graph, not a chain**: `PATH_EDGES` names every join, and
`CONNECTORS` is built from it. Joining consecutive nodes instead zig-zags
through all four braided stations, which is exactly the ordering the braid
exists to deny. `PATH_NODES` still runs strictly downhill, because it is the
order the page is read in, not the order the exercises are done in.

The braid is **staggered, not level** — `BRAID_STAGGER` (70px) between the two
columns against a `BRAID_DROP` of 260px from reading to hearing. The small
offset is what makes the eye join the vertical pairs rather than the rows, and
it keeps the four stations running downhill. Every _joined_ pair spans a normal
station gap; every _consecutive_ pair in the braid is far tighter. The one that
cannot be tight is the second track's join into the merge: below about 150px a
connector has no room left between the label it leaves and the medallion it
arrives at, and it draws as a stub or inverts entirely.

Two stations standing side by side is new, and it is what sets `INTERVAL_X` and
`SCALE_X` at 26 and 74 rather than either side of centre: two labels each want
`min(10.5rem, 42vw)`, which on a 320px screen is most of the column between
them. `pathLayout.test.ts` checks every pair of stations close enough in y to
stand level, at every supported width.

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
and dropped four fermatas next to each other. Beside the braid there is no
opposite side — both edges are taken — so notation goes down the channel
between the two tracks instead. Splats still bleed off the edges there, which
is their whole character and reads fine at 6% opacity behind a label. Splats are generated by
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
- **Anything pressable moves under a press**, not only under a hover: a touch
  screen has no hover, so a control whose only feedback is `hover:` gives a
  thumb nothing back. The notation is the largest button in the app and needs
  this most.
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

**Where a fact can be checked by round-tripping it, it is.** `modeOf` reads a
scale back to the mode that spelled it, `onsetsOf` reads a written bar back to
the impacts that produced it, and the settings parsers are fed their own output —
each one checks the generator against the model rather than against a fixture
somebody typed. Prefer this over asserting a list: `catalog.test.ts` enforces the
_property_ that hearable intervals are one per semitone count, so a well-meant
addition fails loudly instead of quietly making a question unanswerable.

Two suites run in the **node environment** (`// @vitest-environment node`):
`verovio.test.ts` and `rhythmVerovio.test.ts`, because jsdom cannot instantiate
7 MB of WebAssembly. They are the only place the real engraver runs, so they
carry the assertions nothing structural can make — that an accidental is drawn
or not drawn, that asking and revealing a question engrave to the same size, and
that a bar being typed into does not move.

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

### Scale degrees — `degree.ts`

**A degree names the step of the mode it is in**, so an accidental on one means
only "this is not the note the scale has there": C♯ in A aeolian is `#3`. That
is the classical reading rather than the jazz one, and it falls straight out of
`scale.ts` — the seven names keep their meaning in every mode.

**The vocabulary a question draws on is notes, not names.** A degree plus an
alteration is a _spelling_, and spellings are not what anyone hears: ♯1 and ♭2
are one sound under two names, so a question wanting one and refusing the other
is unanswerable however well you listen. Worse, ♯3 in a major key _is_ the
fourth — a second name for a note that already has a plainer one. `degreeNotes`
therefore collects by sounding pitch, each note once, carrying the names it can
go by; `nameMelody` chooses which to print and `degreesSoundEqual` marks by
sound. Grading on the printed spelling fails a listener for something there was
nothing to hear.

**A level's outermost degrees are its range.** A level offering the first five
is asking about the notes from the tonic up to the fifth, so a flattened tonic
sits below everything it teaches and a raised fifth above — neither belongs to
it, however the keyboard spells them. Reading the range off the degrees rather
than tabulating it means adding a degree widens the level on its own, and it is
what keeps a raised seventh out of a major key, where it is not a seventh at all
but the octave.

**A degree carries an octave.** `octave` is an offset from the tonic's own, so
`1` is the tonic and `1'` the octave above it, and scale degree identification —
which never leaves that first octave — simply never sets it. That is what lets
melodic dictation reach a fifth below its tonic and an octave above, with the
fifth below still being _the fifth_: a degree keeps its meaning wherever it
sits. `stepRange(low, high)` walks the ladder between two of them, and the run
it returns is both the vocabulary a melody draws on and the keys on the
keyboard. The stored form marks the octave `'` up and `_` down — not the
Helmholtz comma, because `degreesKey` joins a melody with commas and a
separator that appears inside a value is a format that cannot be read back.

Which name gets printed follows the line: a note the scale has takes the
scale's own name, and one from outside it is raised where the melody carries on
up and lowered where it turns back down. **Unless one of the two cannot be
written**: across an octave boundary the "equally true" names stop being equally
writable — in B♭ mixolydian the note under the octave is ♯7 (A♮) or ♭1′ (B𝄫),
and no direction of line makes a double flat the right way to write A. So
`nameMelody` drops the spellings needing a _double_ accidental and lets the
direction decide among what is left.

Only doubles, deliberately. Keeping the smallest printed accidental instead is a
different and worse rule: in F♯ major it turns a rising ♯4 — B♯, the
conventional spelling of an ascending chromatic note — into C♮, purely because a
natural is less ink than a sharp. Choosing between two single accidentals is
exactly what the direction is for.

The keyboard is unaffected — every
degree stays pressable, including the ones that never generate, because a
player reaching for ♭1 should find it rather than a dead key.

### Rhythm — `meter.ts`, `rhythm.ts`, `rhythmCells.ts`

**A rhythm is a set of impacts and nothing else.** A snare hit has no audible
length, so you cannot hear whether a note was held or stopped and followed by a
rest: note values and rests are an _engraving_ decision, never a fact about the
rhythm. They are not generated, not stored and not graded, which is what makes
`sameRhythm` — the same impacts in the same places — the whole of being correct.

**`TICKS_PER_BEAT` is 60 because that is LCM(4, 3, 5).** Sixteenths, triplets
and quintuplets all land on whole numbers, so a rhythm compares with `===`,
stores as a plain string and never rounds. Every exactness claim above rests on
that one number.

Metre is **only `n/4`**. 6/8 and 12/8 are not "six beats" and "twelve beats" but
two and four _dotted_ beats, which changes what a beat is rather than how many
there are; they need their own grouping and are left out rather than
half-supported.

**A note may not cross a boundary stronger than the one it starts on.** That
single sentence is `maxDurationAt`, and it reproduces the familiar 4/4 table
exactly — whole note on beat 1, half on beat 3, quarter on 2 and 4, eighth on
the "and" — while generalising to 3/4 and 5/4 with nobody tabulating them.
`metricLevel` ranks the boundaries (barline, beat group, beat, eighth,
sixteenth, finer) and **smaller is stronger**. 4/4 is two halves rather than four
equal beats, which is exactly why beat 3 may carry a half note; `BEAT_GROUPS`
holds that per metre, since 5/4 has to be 3 + 2 or 2 + 3 and the choice belongs
in a table rather than in an argument at every call site.

**A bar is built one beat at a time.** A `RhythmCell` is a division of the beat
plus which of its parts are struck, and that one idea buys three things at once:
tuplets need no mechanism (a triplet is `division: 3`), no rhythm ever needs a
tie because a cell cannot cross a beat, and the results come out idiomatic —
rolling a coin per grid point across a whole bar reaches "the second and third
sixteenth only", which is a valid set of impacts and not a rhythm anyone would
write. No two cells may describe the same impacts, or a group would quietly
weigh more than its weight claims.

Cells are grouped and a level weights the **groups**, picking uniformly within
one, so `sixteenth: 3` means three parts sixteenths however many patterns that
group happens to hold. Weighting each cell instead would silently make the
larger groups heavier.

**`minOnsets` is held in view while a bar is built, never enforced by throwing
a finished one away.** Drawing bars until one clears the floor sounds
equivalent and is not: a bar survives that test in proportion to how densely it
happened to be drawn, so the levels quietly got a different mixture from the
one they declare. It halved every `hold` — 25% of the beats of Beats down to
13%, which made **half** of that level's bars four identical quarter notes —
and in Off the Beat it pushed plain eighths past the offbeats the level is
named for. Topping a thin bar up afterwards leans the same way, since what it
adds is downbeats. So a cell is refused only where taking it would put the
floor out of reach for the beats that remain, and every other beat comes from
the weights untouched. `generate.test.ts` measures the realized mixture against
the declared one for every shipped level, which is the only way this is visible
at all.

**The floor is an absolute count, so a level mixing metres is read against its
shortest bar.** Three impacts is nothing in 5/4 and forces a subdivision into
every bar of 2/4. A floor at or above the beat count means every beat must be
struck, which is not a floor but a demand for saturation: it is what made Beats
(3 in a four-beat bar) unable to deliver the held notes it declares, since one
held beat was all it could ever allow. Keep `minOnsets` well under the number
of beats in the shortest metre a level offers.

### A phrase — `phrase.ts`

**A phrase is a list of bars, not a long bar.** One stretch of ticks would have
been fewer lines and would have cost the thing that makes melodic dictation
possible: a bar is the unit every existing function already understands.
`buildBar` fills one, `notateRhythm` spells one, `maxDurationAt` knows what a
note may cross inside one. Keeping the bar whole is why going from one to four
of them changed none of them — `barRhythm(phrase, i)` hands a bar to anything
built for a single bar and it works unchanged.

**That is also why there are still no ties.** A note may not cross a boundary
stronger than the one it starts on, and the barline is the strongest there is,
so `maxDurationAt` already refuses it. A sound running past a barline is written
as a note and then a rest in the next bar — exactly what one bar already does
for any gap a single value cannot span. Since impacts are the whole of what is
graded, and playback rings every note until the next impact, the two spell the
same sound and nothing is lost.

`rhythmDivision` labels a bar by **what it asks of the player**, not by its
shortest note: a bar with one triplet in it is a triplet bar even where a
sixteenth elsewhere is shorter, because "you keep missing triplets" is the
finding the label exists to make possible.

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
cached at runtime instead. If precache jumps from its usual ~750 KiB to ~8 MB,
that wiring has been broken. Leland ships inside the wasm; `setResourcePath` is a no-op on web.

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

**A note that has not been revealed is engraved, in its place, and not
drawn** — `@visible="false"`, which Verovio emits as `visibility="hidden"` on
the whole note group, so the accidental and the stem go with it. The hearing
exercises rely on this: leaving the unheard notes out instead re-engraves a
different piece of music, so the staff narrows and the note already on screen
slides across the moment the answer arrives. `verovio.test.ts` renders each
question asked and revealed and insists the two are the same size.

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

Scales ship at 0.3 against Verovio's default of 0.25, which takes the staff
from 104px to 89px in a 375px phone's column; the table in `verovio.ts` carries
the measured alternatives, because the value is meant to be turned. The scale is
steeper than it looks: 0.6 is already four times as wide as 0.25, and the
engraver refuses anything above 1.0. Nothing asserts the exact number — the
tests only check a scale gets more room than the default and still fills its
column.

Staff size therefore only matters for an interval, which is two notes wide and
never overflows. `DEFAULT_STAFF_SIZE` came down from 126 to **110** for exactly
that reason: at 126 a two-note staff stood 258px tall on a desktop while a scale
beside it stood 166px and a bar of rhythm 113px, so the notation was largest in
the exercise showing the least of it. Because a scale is fitted to the column at
every supported width, the same change provably leaves it alone — at both 126 and
110 it renders 343×91 on a 375px phone — and a rhythm is fitted the same way in
every metre but 2/4.

Spacing is applied per render rather than once at startup, since one toolkit is
shared by the whole app. `renderMei` sets the options immediately before the
render they belong to, and everything from there to `renderToSVG` is
synchronous, so no other render can interleave and pick up the wrong spacing.

### A phrase on the page — `melodicPhraseMei`, `melodicPhraseProfile`

A five-line staff under a key signature, one `<measure>` per bar, each note
taking its pitch from a list zipped against the note-symbols of `notateRhythm`.
Three things are load-bearing and two of them are invisible when wrong, so
`melodicVerovio.test.ts` pins all three:

- **`measureAccidentals` resets at every barline.** It exists for precisely this
  and had only ever seen one measure: `melodyMei` writes the whole of scale
  degrees' answer as a single measure, so reusing it would have run one
  accidental state across the entire phrase and printed a note bare that reads
  as the pitch before it.
- **The system breaks are encoded** — an `<sb/>` per system under
  `breaks: 'encoded'`. Verovio otherwise breaks by what fits, so a half-written
  phrase sits on one system and jumps to two the moment a bar fills, halving the
  staff under the player's hands. That is the failure the fixed page exists to
  stop, arriving by another door.
- **The page reserves one system of the worst case**, not the whole phrase. The
  reserve is what a player might still type — every beat of the bar divided into
  a quintuplet, each note carrying a double accidental, under a seven-sharp
  signature — and two of those side by side come out around 1300 units wide,
  which a 375px phone scales to a staff of some 35px. So **one bar to a
  system**, and a phrase is read down the page.

The width is checked twice, and the second check is the one that bites. Nothing
running off the page is the obvious test and it is not enough: Verovio _fits_ a
system to the width it is given, so a page that is too narrow produces notation
with no room between the notes rather than notation hanging off the edge —
invisible to any measurement of where the ink stops. So the reserve is also
compared against what the same music wants when it sizes its own page.

`SCORE_BOX` has a sibling, `PHRASE_SCORE_BOX`, a little taller: two stacked
systems at the single-staff ceiling come out around half the height one staff
gets, which is the wrong way round for the thing that is _more_ to read.

### Writing a rhythm down — `rhythmNotation.ts`

This is the **spelling** half of a rhythm; `lib/music/rhythm.ts` holds the facts.
Nothing decided here is ever graded. What it must be instead is readable and
**stable**: the same impacts always spell the same way, and reading the impacts
back off the spelling returns exactly what went in. `rhythmNotation.test.ts`
asserts that round trip over every rhythm the generator can produce — the same
trick `modeOf` plays on the scale generator.

**There are no ties**, which is affordable only because tuplets are beat-local,
and it is what keeps the keyboard down to one row of note values. There is no
dotted sixteenth either: it is 22.5 ticks, and every impact is a whole number of
them, so no gap can ever call for one.

**A rhythm is engraved to a fixed page, not fitted to its content.** Every other
example is engraved to its own width and then scaled down to the column — which
is exactly wrong for a bar being typed into, because each keystroke widens the
content, the column scales it down harder, and the staff shrinks under the
player's hands. `rhythmProfile` pins `pageWidth` and `pageHeight` instead, so a
note already placed never moves. Three things make it work: `breaks: 'auto'`
(under `breaks: 'none'` Verovio ignores the width), a pinned height (left alone
it grew the moment a beam appeared), and `rhythmMei` padding the unentered end
of the bar with `<space>` so the measure keeps its full duration.

**The page width is per metre.** It has to hold the densest bar the keyboard can
produce — every sixteenth of every beat — since that is what a player might type
whatever the question was. Sizing for the worst case in 5/4 and reusing it in
2/4 would draw every 2/4 bar in the left third of a box twice as wide as it
needs, halving the staff on a phone. Note spacing stays at the default here:
widening it stretches the densest bar as much as the sparsest, so the page grows
to match and the staff ends up smaller for no gain.

A rhythm staff is **one line with a percussion clef** — there are no pitches to
place — and stems point down so a bar filling with beams cannot push the line
around.

### A staff sized for the worst case has to be filled

Both answer staves reserve a **fixed page** so the box and the staff size
cannot move while an answer is typed — and the reserve is the widest thing that
could ever be written into it: sixteen sixteenths, or a melody under seven
accidentals with one on every note. A typical question uses about half of that,
so the music sat hard against the left edge with an empty staff beside it.

The page cannot simply shrink — the reserve is what a player may still type —
so the system is stretched to fill it instead (`FILL_THE_PAGE`). Verovio leaves
the _last_ system unjustified when it falls short of `minLastJustification` of
the page, which is right for the final line of a piece and wrong for every
example here, where the only system there is _is_ the last one.

**What that costs is different for the two exercises.** A melody has one event
per slot from the first keypress — `<space>` for the rest — so justification
lands every note on exactly the same x at every stage, and nothing is given up.
A rhythm has no fixed event count, since four sixteenths can replace one
quarter, so its notes do shift as the bar fills. That is deliberate: how wide a
finished bar will be is not knowable while it is being written, and a bar
huddled in one corner of a staff reads worse than one that moves. The box and
the staff size still never change, which was the jarring half.

### An accidental holds until the barline

`melodyMei` decides what to print against **what is currently in force on that
staff position**, not against the key signature. The signature only says what
stands before anything else has happened; after that, a printed accidental
governs every later note on its own line or space, and its own octave alone.

Getting this wrong is invisible to a type checker and nearly invisible on the
page — a note silently inherits the accidental before it and reads as a
different pitch. A B major melody touching A𝄪 and then A♯ drew the second one
bare, so it read as another A𝄪, a whole tone out. Taking back a double
accidental needs the cancelling glyph rather than a plain one: ♮♯, which MEI
writes `ns` and SMuFL draws as a single character.

This lives in `melodyMei` alone. An interval is two notes that may share a
staff position deliberately — a harmonic unison is written as two noteheads
each carrying its own accidental — and a scale is keyless, with every
alteration printed by design. Both would be _wrong_ under barline rules, which
is why the rule is not in `accidentalAttributes` where every caller would get
it.

### Engraved text takes the app's serif

Verovio writes `font-family="Times, serif"` onto the inner `<svg>` of every
render. `Score` overrides it with one `[&_svg]:font-serif` class, and every
Verovio render in the app goes through `Score`, so that is the whole mechanism.

It rests on two properties of Verovio's output, neither obvious and neither ours
to control, so `rhythmVerovio.test.ts` pins both:

- The font is a **presentation attribute**, which the cascade ranks below every
  author rule — a plain class beats it with no `!important`. Emitted as
  `style="…"` it would not budge.
- **The only real `<text>` is staff labels.** Noteheads, rests, clefs, time
  signatures and tuplet numbers are all glyph outlines, so restyling text cannot
  reach the notation and turn it into type.

Verovio still _lays the label out_ with Times metrics — it indents the system by
exactly the width it measures, leaving no slack — so a swapped face that ran
wider would be clipped by the inner `<svg>`, which has no `overflow`. EB Garamond
is narrower than Times for both labels (0.99 and 0.97 of the width, against a
1.15 ceiling), so there is room; a much longer label, or a change of face, is
what would spend it.

**The keyboard draws real Leland glyphs**, extracted from Verovio by
`npm run glyphs` into `components/notation/glyphs.ts` and committed. Leland
ships inside the wasm rather than as a font file, so there is nothing to subset,
and the keyboard has to draw before the engraver has finished downloading. They
were drawn by hand first and the rests gave that away: a quarter rest is a shape
you cannot approximate and an eighth rest is not a "7". `NoteGlyph` places them
from measured boxes, the way notation anchors them — a notehead's origin is its
left edge, a rest's is the line it hangs from.

## Audio — `src/lib/audio/`

Sampled, not synthesised: ear training is about timbre as much as pitch, and a
sine wave teaches you to recognise a sine wave. `smplr` streams **one instrument
per kind of question** — a Steinway (`SplendidGrandPiano`) for anything pitched,
and a drum kit for rhythm. **What a question is played on is not one of the
things melina asks anyone to decide**: there is no instrument setting, no
instrument in the stored settings, and no level that differs only by timbre.

The kit is the LinnDrum (`LM-2`) rather than the TR-808, because its drums are
sampled acoustic ones — the snare has a real transient and a short decay, so
adjacent sixteenths stay separate instead of smearing. **Samples are named one
by one, never by group**: smplr resolves a bare `snare` to whichever variation
comes first in the manifest, and on the 808 that is the one with tone and snap
wound to zero, which measures as a kick and sounds like one. The count-in uses
sidesticks — a click, plainly not a drum being struck.

Two rules the browser imposes, both easy to get wrong:

- **An AudioContext must be created and resumed inside a user gesture.** That
  gesture is the "Start round" tap, which calls `unlockAudio()`. Do this in the
  handler itself, not in an effect afterwards.
- A context can be **suspended again** whenever a tab is backgrounded, so
  `playSequence` resumes defensively before every note.

`playMelody` is the first question in the app that needs **two instruments at
once** — a piano for the notes and the kit's sidesticks to count the bar in —
and they share the one list of scheduled notes, because a melody and its own
count-in are never wanted separately. It is also the most expensive preload
there is, and still a preload: the exercise plays by itself the moment a
question appears.

`playInterval` and `playScale` are both thin wrappers over `playSequence`, which
schedules a run of notes; a gap of zero is what makes an interval harmonic. A
scale is played faster and shorter than an interval — eight notes at interval pace
is a series of separate notes rather than a scale.

`playRhythm` counts a bar and then plays one. When everything sounds is pure
arithmetic in `rhythmSchedule.ts`, deliberately kept out of `engine.ts` so it can
be checked without a network or an AudioContext — otherwise the scheduling would
be the one part of playback nothing could test. Whether the click keeps going
under the bar being asked about (`MetronomeMode`) is a real difficulty axis
rather than a preference: counted in and then left alone, you have to hold the
pulse yourself, which is most of what rhythmic dictation is.

**`instrument.stop()` does not stop what has not started yet.** smplr registers
a voice only when its scheduler dispatches the note, ~200ms ahead, so stopping
the instrument silences what is already sounding and leaves the rest of a scale,
the second note of a melodic interval and a whole bar of drums queued to fire on
time. The stop function `start` returns is the only handle that also drops a note
from that queue, so the engine keeps one per scheduled note and `stopPlayback`
calls all of them. It is synchronous for the same reason: called from a click or
an effect cleanup, anything deferred to a promise can land after the _next_
question has scheduled itself and cut that off instead.

Nothing outlives the question it belongs to. `usePlayback` stops on unmount and
whenever `sound` is rebound — which is every question change, and every move to
the summary or the levels screen — and the replay control stops before it plays,
inside the gesture, so it is pressable at any moment rather than only between
sounds.

Sample requests are cached at runtime (`melina-samples`), never precached — the
piano is tens of megabytes, and a round of reading may never ask for it. `smplr`
itself is a small lazy chunk and _is_ precached, so only the samples need the
network. The drum kit is a few hundred kilobytes rather than tens of megabytes,
which is why rhythmic dictation preloads it up front and passes `loadDrums` to
`usePlayback`: without that it would quietly pull down the whole piano to play a
snare.

The player type is imported from smplr rather than declared by hand, so an
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

**The second braid merges.** Rhythmic Dictation and Scale Degrees stand side by
side — the _when_ and the _what_, learnable in either order — and Melodic
Dictation sits below them with both edges arriving at it, because it is the
thing that needs both. It is the first station since the top of the path with
two edges arriving, which is what the graph in `PATH_EDGES` exists to express.

It sits **left of centre rather than on it**, because the room to its right is
spoken for: the next exercise stands beside it. Placed that way now rather than
when that arrives, so shipping it is a coordinate and not a re-layout of
everything below — and if the two do end up standing level, `pathLayout.test.ts`
will say so, since it checks every such pair for overlapping labels at every
supported width.

`orderedPathNodes` sorts by `position.y`, **not** by the curriculum. The
registry lists hearing before reading and the path puts reading first, so
following the registry would tab a keyboard from the third station to the first
and back down again. Layout owns the order things are walked in.

Positions in `pathLayout.ts` are hand-placed by **station id**, so shipping an
exercise means adding a coordinate. `orderedPathNodes` falls back to the end of
the path for an unplaced station so nothing can silently vanish, and
`pathLayout.test.ts` asserts the fallback is never actually reached.

## Exercises — `src/exercises/`

Five exercises — two reading/hearing pairs and one that is neither — and the
folders say which is which:

- `shared/` is **exercise-agnostic**. The levels → setup → round → summary state
  machine (`useRound`), the levels screen, the round screen, the summary, the
  setup chips and the playable score all live here, generic over what is being
  asked and what answers it. It must never learn what an interval or a mode is.
- `interval-shared/` and `scale-shared/` bind that machinery to one subject: a
  generator, a `RoundRules` object (how to build a round, what counts as right,
  what to write into the attempt log), and thin round-screen and summary
  wrappers that supply the right keyboard and the right names.
- `interval-reading/`, `interval-hearing/`, `scale-reading/`, `scale-hearing/`
  hold only what differs: settings, levels, a setup screen, and the component
  that decides what notation to show.
- `rhythm-dictation/` has no pair. It binds the same machinery to rhythms and
  then supplies its own round screen, because the staff is where its _answer_
  goes rather than where the question is.
- `dictation-shared/` is what the two dictation exercises genuinely share: the
  draft being typed into, and `buildBar`. Neither was written twice — the draft
  moved here and grew two things when melodic dictation arrived, and the bar
  builder moved untouched.
- `melodic-dictation/` is the two halves at once, and is described below.

Within a pair, reading and hearing differ only in what notation they show and
whether there is a play button beside it, so anything else belongs one level up.
When a third pair arrives, generalise `shared/` rather than copying a sibling.

**Rhythmic dictation is the exercise that says which parts of `shared/` are
really generic**, and it fits without changing any of them: `useRound`,
`RoundScreen`, `RoundSummary`, `LevelsScreen` and `usePlayback` all took it as
written. What it needed instead were three escape hatches, each earned —
`RoundScreen` takes a whole `score` node for a screen whose notation is not the
question, `RoundSummary` groups by a caller-supplied label because a bar has no
name to group by, and `usePlayback` takes the instrument to preload. Prefer that
shape over widening a shared component's idea of what a question is.

**A string read by a shared screen may not name what only one exercise asks
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

**The affordance is a mark on the staff, not a caption under it.** A line
reading "tap the notes to hear them" spent a whole row of the screen on
something learnt once, and on a short screen that row came out of the
notation's height — the scarcest thing on the round screen. A faint speaker in
the corner of the staff says it where the thing it describes already is, sits
over the notation rather than beside it, and still carries the two states the
caption did: the samples arriving, and playback having failed. Everything above
the staff is tighter on a small screen for the same reason — the prompt is read
once per question and gives up its air before the notation gives up any height.

**The staff is bounded by the room left for it, never by a slice of the
viewport alone** — `SCORE_BOX` in `exercises/shared/scoreBox.ts`. A
`max-h-[Ndvh]` cap cannot know what the prompt above and the feedback below
have taken, and on a screen where the remainder came out under that fraction
the notation grew past its box: because the column centres its children, it
spilled from _both_ ends at once, swallowing the prompt at the top and being
painted over by the Next button at the bottom. The height has to come down the
flex chain instead — `h-full` on the box so its height is definite, `min-h-0`
on every ancestor so they may shrink, `items-stretch` on the row so the box is
given the height rather than centred at its content's. Only then does the
SVG's own `max-h-full` mean anything; without a definite parent it resolves to
nothing and the drawing sizes the box that was supposed to size it.

**The notation is the play button.** Pressing the staff sounds it, rather
than a control beside it — the notation _is_ what is being played. It is
pressable only when every note is on screen: a hearing question at any time,
a reading question once its answer is out, since before that the sound would
answer it. Rhythmic dictation is the one exception, and the reason is the
same rule read backwards: there the staff is where the answer is going, and
pressing your own half-finished answer to hear the question would be
backwards, so its replay control stands on its own above the bar. A muted caption under the staff carries the affordance and doubles
as the place that says the samples are downloading or that playback failed;
its height is reserved either way, so revealing an answer does not move the
staff. `usePlayback` holds the whole of it — the gesture the AudioContext
needs, the status, and the failure that has to leave a round playable in
silence.

Reading exercises fetch their samples on that first press rather than up
front. The piano is tens of megabytes and most reading rounds never ask for
it; a hearing exercise preloads, because it plays by itself.

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

### Writing the answer — rhythmic dictation

The first exercise where the answer is **written rather than chosen**, and so
the first with no fixed set of answers at all.

**The draft is the keys that were pressed, not the impacts they imply.** The
staff has to show what the player wrote — someone who enters a quarter rest
should see a quarter rest — so `RhythmDraft` keeps the entries and derives the
impacts for grading. Only the impacts are graded, which is why choosing a rest
over a held note can never be wrong.

**The bar answers itself when it is exactly full.** There is no confirm key:
every key that would overflow the bar is disabled instead, so the only press
left is the one that completes it, and backspace covers everything before that.
The submit rides on the shared screen's `onAnswer`, which is what gives it the
same answer timing every other exercise is measured with.

The keyboard is **modes, not keys**: sixteenth-through-whole times note-or-rest
times plain-or-dotted is thirty keys, and thirty keys is a form rather than an
instrument. Rest and dotted **mean exactly the next key** and switch themselves
off once a value is entered, so half a bar cannot come out as rests because a
switch was still down. The tuplet switch is not one of them — a bracket changes
how long a value lasts, so it belongs to the draft, which is the thing that
knows where the beat boundaries are, and it stays on until its beat is full.

A level's `cellWeights` does two jobs with one field: a group at `0` is not in
the level at all, and the rest are relative likelihoods. That is deliberate —
"which subdivisions" and "how often" are the same question, and splitting them
into a list and a table would let the two disagree.

### Melodic dictation — the culmination of the two beside it

Hear a phrase, see its first note, write down the rest. **Nothing underneath it
was new**: the bar builder, the degree model, the round machinery, the playback
hook and the attempt log all took it as written, and what it needed instead were
three widenings, each earned — a degree gained an octave, a rhythm gained bars,
and `RoundSummary`'s `answerName` was given the whole answer rather than only
what was chosen.

**Correctness is two independent facts.** The impacts are in the right places,
bar by bar (`samePhrase`), and the notes are the right notes **by sound**
(`sameSounds`). Everything the player had to decide that could not be heard —
how a rhythm was spelled, how a note was spelled — is a decision that cannot
cost them the answer. `♯4` and `♭5` are one note, and so are a held quarter and
a quarter followed by a rest.

**That second one is only true because playback is legato.** Every note rings
until the next impact begins. A half note that damped where a quarter-and-a-rest
did not would make the spelling audible, and a player could then be marked right
for writing down something other than what they heard. `melodyDurations` is that
rule, and `rhythmSchedule.test.ts` holds it — including across a barline, which
is the case that lets the tie go.

**The first note's pitch is given as a placeholder, not as a note.** It is drawn
greyed on the staff, the way a form field shows what goes in it, and the first
thing typed replaces it. The draft itself starts empty, so the player writes
every note including the first.

Only the pitch. An earlier version seeded the draft with the leading symbol of
the answer's own spelling and locked it against backspace, which gave away the
note's _length_ as well — and the length is exactly the thing there is to hear.
A draft entry is a written value, so there was no way to seed one without
saying how long it was; a placeholder on the staff is not an entry, and can say
one without the other. It is a plain quarter note whatever the answer is.

Marked by `@type="placeholder"`, which Verovio copies into the rendered
element's `class`, so how faint it is stays in the styling rather than being a
colour written into the MEI. **Faded with `opacity`, not coloured** — see
`placeholderClasses.ts`. Verovio ships its own stylesheet inside every render
containing `#<id> path { stroke: currentColor }`, an _ID_ selector that beats
any class rule of ours, and a stem is a `<path>` with no stroke of its own; so
setting `stroke` on the note group reached the noteheads and left every stem
full black. Opacity is not a property that rule touches, and it is what "greyed
out" means here anyway: the ink of a real note, faded.

**Ledger lines need a second rule, because they are a second element.** Verovio
draws them as `<g class="ledgerLines">` inside the _staff_, a sibling of the
layer rather than a child of the note that needs them, so nothing scoped to the
note can reach them. Fading every ledger line on the staff is exact rather than
approximate only because of when it is applied: while the placeholder is
showing it is the only note there, so every ledger line drawn belongs to it.
Once anything is written the rule comes off, or a wrong answer would show its
own ledger lines — and the correct answer's — faded.

Beat one of bar one is still always struck — the placeholder needs somewhere to
stand — and a phrase still has more than one impact, now because a one-note
phrase is not a melody rather than because the hint would have answered it.

### How far a melody leaps — `lib/music/contour.ts`

A generator that draws each note independently of the last produces a line that
jumps about, which is neither musical nor, for dictation, honest: the difficulty
would come from the leaps rather than from the degrees or the subdivisions the
level names. So the next note is drawn against a weight that falls away with
distance from the last one. **Two shapes**, and a level picks one:

- **`steady`** — one spread of intervals, the same at every note. Steps common,
  thirds ordinary, wide leaps rare, and the rhythm has no say.
- **`paced`** — **the time to the next note sets the spread.** A quick note
  steps; a long one may leap. The weight is an exponential centred on the last
  note whose _width_ is a power of the gap in beats, so a long gap is the same
  shape smeared out rather than a different shape.

Paced is how melodies are actually written and actually sung — a run of
sixteenths that leaps a seventh at every note is unsingable and unhearable,
while the same leap after a half note is ordinary. Steady is kept because it is
a _harder_ line to hear rather than a worse one, and Leaps is the level for it.

Measured, the curve is about 2 semitones wide at a sixteenth and 9 at a half
note; the table in `contour.ts` carries the rest, and the constants are meant to
be turned. Three properties are not: **every interval keeps a non-zero weight**
(a `floor`, because an exponential underflows at a small width and a wide leap,
and a level whose far notes could never be drawn is quietly narrower than it
says), the curve is **symmetrical** (which way a line goes is decided
elsewhere), and a **repeated note is notched down** — legal, since the rhythm
tells two notes on one pitch apart, but a line that keeps sitting still is not
asking anything. The notch has to be deep because the pool is _notes_ rather
than intervals: the nearest neighbours in a diatonic range are a semitone or two
away, and at a short gap the curve has barely fallen by then.

`contour.test.ts` asserts the properties rather than the numbers, and
`melodic-dictation/generate.test.ts` measures the melodies that actually come
out — the same reasoning as rhythmic dictation's mixture test, since a weight
that is right on paper and never reaches a bar is a weight that does nothing.

**It is also explained in the app**, at `/guide/melodic-shape`, reached from the
question mark in the corner of the Melodic shape setting — one line of hint
cannot explain a probability model. See below.

**The rhythm is generated before the pitches, and that ordering is load-bearing
now**: `paced` needs to know how long each note has, which is a fact about the
bars.

**The vocabulary is a contiguous run of scale steps**, `low` to `high`, and the
run _is_ the keyboard: one key per step. A range rather than a set because a
melody moves through its range rather than picking out of it, and because two
ends is one thing to choose where a set is seven. It caps the key count
structurally — `MAX_STEPS` is 13 — and it reuses `stepNotes`, so a melody is
still drawn as **notes rather than names** and can never be asked to distinguish
two spellings of one sound.

**Two bars ship and four do not.** One bar to a system is what keeps the staff
the size rhythmic dictation's is, so four bars is four systems, and four systems
in the room the notation gets on a phone is smaller than anyone can read. It
stays a Custom setting rather than a level that looks fine on a desk.

The keyboard is three rows, and the middle one is what makes writing a melody
one press per note. The switches on top mean the next key only — the two
accidentals, the dot, the tuplet brackets. **The note value is a mode that
stays**: a bar of eighths is eight presses of the same length, and a value that
let go after every note would double the work of writing anything down. Then the
notes, one key per step, plus a rest.

**Each pitch key draws the note that pressing it would write**, at the armed
value and dots — arm a dotted half and the keys become dotted halves. That is
what makes the value row legible without reading it: the mode is visible in the
thing it modifies rather than only in the switch that set it. `MiniStaff` holds
its last picture rather than blanking while the new one engraves, because
redrawing a whole row on a value change otherwise flickers under the hand that
just pressed it.

**The armed value falls back rather than going dead.** Three beats into a bar of
four with a half note armed, nothing on the bottom row could be pressed; instead
the largest value that _does_ fit is used for this press, and the player's own
choice returns the moment there is room for it again. The row highlights what
will actually be written, since that is the honest thing for it to say. A
keyboard where every key is grey and nothing says why is the worst of the
available behaviours.

The summary is the one place the two halves separate again. Grading is a single
verdict, but a melody can be right in its rhythm and wrong in its notes or the
reverse, and "you had the rhythm" is the most useful thing there is to read
back — which is why `answerName` sees the question as well as the answer.

## Guides — `src/pages/MelodyShapePage.tsx` and `components/explain/`

A setting whose meaning takes a picture gets a page, reached from a question
mark in the corner of its section — `SetupSection` takes an `action` for it.
Corner rather than a line under the hint, so it is there the first time you meet
the setting and invisible every time after.

**The figures are computed from the model, never drawn to match it.**
`contourSeries.ts` evaluates `contour.ts` itself, and `ContourFigures.tsx` plots
what comes back, so turning a constant moves the pictures with it and the page
cannot come to describe something the app no longer does. That is the whole
reason `contourCurve` is exported: the bare curve is what the drawing needs,
and a second copy of the formula in a chart is a copy that can go stale.
`MelodyShapePage.test.ts` asserts the _shape_ of what the figures say — a leap
grows likelier with the gap, a repeat is damped at every gap — so the page fails
rather than lies if the model changes underneath it.

The drawings keep their aspect ratio, unlike the path's connectors: a dot has to
stay a dot, and `preserveAspectRatio="none"` turned every marker into an
ellipse. Strokes are still non-scaling, so a line is the same thickness on a
phone and a desktop.

A guide lives on a **headerless route**, like the exercises it is read from, and
carries its own back link. That link returns to `?screen=setup`, because the
settings survive the trip in Dexie but _which screen was showing_ is React state
and does not — without it, reading the explainer costs the player their place
and drops them on the level list.

Guides have their own `guide` translation namespace rather than living in
`exercise`: a page is an area of the app, which is what a namespace is for.

## The attempt log — `src/lib/db/attemptQuestion.ts` and `progress.ts`

Every answer is recorded, right or wrong. A row keeps **exactly enough to ask the
question again and no more**: an interval is a lower note and an interval key
(`C4` + `A4`), a scale is a tonic with its octave and a mode (`Bb3` + `dorian`),
plus the clef, key signature and direction. A rhythm is a metre, its impacts as
ticks (`4/4` + `0,60,90,120`) and the tempo it went by at — the impacts _are_ the
rhythm, and how the bar was spelled on the page is decided again by
`notateRhythm`, so a row can never disagree with the notation it produces. What
those imply is never stored — the upper note, the eight pitches of a scale, the
note values of a bar, and the answer that would have been correct are all derived
on the way back out, so a row cannot disagree with itself.

Nothing about the _level_ is stored either. `staffOnly` narrowed the range the
generator drew from; whether the notes it chose need ledger lines is a fact about
those notes, worked out again by `attemptFacets`.

Reading it back goes through **one query with an open-ended filter**, not a
per-exercise statistic. `accuracy(filter)` names any subset of the dimensions an
answered question has and leaves the rest unconstrained: `{}` is every answer ever
given, `{ format: 'hearing' }` everything heard rather than read, `{ root: 'Eb' }`
every question built on an E♭ in any exercise, and a level's settings are simply a
filter that names all of its dimensions at once (`intervalFilter`, `scaleFilter`).
`category` and `format` are split out of the exercise id rather than stored, so
they cannot disagree with it.

The filter matches against the flat facets `attemptFacets` derives, which is what
keeps `progress.ts` from knowing what an interval is — rhythmic dictation added
`meter`, `tempo`, `division`, `offBeat` and `impacts` there and every existing
query kept working, which was the design being tested. `root` is deliberately
shared: an interval's lower note and a scale's tonic are the same dimension, and
that is what lets one query span the whole app. A rhythm deliberately has **no**
`root` — it is built on no note at all — so it drops out of every filter that
asks about pitch, which is exactly the documented behaviour of a filter naming a
dimension an attempt does not have.

A melody row is the two vocabularies side by side — a rhythm's metre and
impacts, a degree question's tonic, mode and degrees — and **nothing had to be
invented for it**, which was the design being tested a third time. The impacts
are kept bar by bar, because which bar a note fell in is part of the answer:
`0,60|0,90` is not the melody `0,60,300,390`. Its facets are likewise both sets
at once plus `bars` and `span`, so every query that already existed reaches it:
`{ root: 'Eb' }` meant "every question built on an E♭" before melodies existed
and did not have to learn that they now do.

A rhythm level filters on metre and tempo, the dimensions it actually pins, and
**not** on its cell weights: weights shape what comes up rather than bounding it,
so a level cannot claim the bars it happened not to draw.

The levels screen shows a level's accuracy beside it, but only past
`ACCURACY_MINIMUM` (15) matching answers — below that the figure moves seven
points on the next question, which misleads rather than informs, so nothing is
shown at all rather than a number with a caveat. `LevelsScreen` takes an
`accuracyFilter` per level rather than a percentage, so the shared screen still
never learns what its levels are made of. The visible figure is `aria-hidden`
and a spoken form beside it says what was measured and over how many answers: a
bare "82%" inside a button reads as "82% of what?".

Accuracy is measured over the **last `ACCURACY_WINDOW` (100) matching answers**,
newest first, so it says where the player is now rather than averaging in a bad
week from months ago. `rate` is `undefined` and not `0` when nothing matched:
never practised and never right are different things, and a screen that renders
0% for the first is lying. The window walks backwards over `[exerciseId+ts]` and
stops as soon as it is full, so the usual query reads a hundred rows however long
the log has grown.

## Progress — `src/pages/ProgressPage.tsx` and `lib/db/history.ts`

Reached from the **streak button at the right of the header**, the mirror of the
settings button at the left. Neither is a station: the path is what you
practise, and the chrome is what you look at. Progress was a registered
category once; it was removed rather than left as a locked station claiming "in
development" for a screen that exists.

Nothing new is stored. A streak, a total and every breakdown on the screen are
facts _about_ the attempt log, recomputed from it — a counter kept alongside
would be a second copy that could drift out of step with the answers it claims
to summarise. `history.ts` is therefore pure functions over rows, and the page
reads the log once and slices it in memory rather than running a dozen queries
over the same rows.

The one exception is `practiceDays`, which walks the `ts` index with `eachKey`
and never touches a row: the header draws a streak on **every** screen, and
loading a year of practice to render one small number is a cost that only grows.

**A streak survives until a whole day passes without practice.** Practise on
Monday and Tuesday morning still reads 1 — greyed, because today is untouched —
and only Wednesday resets it. Counting only days with practice in them empties
the number every midnight, which reads as punishment for not having practised
before breakfast. The flame is filled and accent-coloured once today has an
answer in it and a grey outline until then: filled against outline carries the
state as well as the colour does, because a state a colour-blind player cannot
see is not a state.

**A day is the local day**, never UTC. A session at 23:30 belongs to that
evening, and shifting it forward would break a streak someone had earned.
`shiftDay` walks by calendar date rather than by adding 24 hours, so a daylight
saving boundary does not swallow a day.

The chart stacks two scales rather than overlaying them — accuracy across the
upper band, volume as bars along the bottom. One axis cannot carry a percentage
and a count at once, and the questions are genuinely different: a bad day at
forty answers and a bad day at four look identical on a line alone. Empty days
are drawn as gaps and the accuracy line breaks across them, because a week off
is the most informative shape a practice chart has. Columns are real `<button>`s
overlaid on the SVG, so the chart is reachable by keyboard and announces what it
holds instead of relying on a hover tooltip.

**The heatmap is a picture, not a control.** Half a year of squares across a
phone is a ten-pixel target, which fails the 44px rule and any thumb; picking a
day belongs to the chart, whose columns are the full height of the plot. The
grid carries one accessible summary rather than a hundred and eighty
announcements, and a `title` gives a mouse the same detail for free. Its range
must start on a Monday — the grid fills column by column, so the range's own
start is what puts a day in its weekday row.

Breakdowns go through `groupBy(rows, dimension)`, which groups on the same flat
facets the accuracy filter matches on. It knows nothing about music, so `root`
puts an interval's lower note and a scale's tonic in one list, and a derived
dimension like `staffOnly` groups exactly as readily as a stored one. The page
currently lists `interval`, `mode`, `clef`, `keySignature` and `root`; the rhythm
facets are derived and queryable but not yet shown, and adding one is a row on
this page rather than anything new underneath it. Lists are
ordered **weakest first**: a list you read from the top tells you what to
practise next, and the strengths are still there at the other end.

## Not yet built

Everything after Melodic Dictation — harmonic prediction, harmonic completion,
counterpoint, the daily round — is still a placeholder page.

Settings holds one setting — the interface language. Like Progress it is
reached only from the top bar and has no station on the path, because neither
is something you practise.
