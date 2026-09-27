# melina — project conventions

A PWA for preparing for classical composition studies. Ear training, dictation,
harmony, counterpoint and composition practice, all offline-capable and local-only.
The name comes from the toki pona word for melody.

## Commands

|                        |                                                    |
| ---------------------- | -------------------------------------------------- |
| `npm run dev`          | dev server                                         |
| `npm run build`        | typecheck + production build + SPA fallback        |
| `npm run preview`      | serve the production build                         |
| `npm run typecheck`    | `tsc -b`                                           |
| `npm run lint`         | oxlint                                             |
| `npm run format`       | Prettier (also sorts Tailwind classes)             |
| `npm test`             | Vitest                                             |
| `npm run shot`         | screenshot the running app (see **Looking at it**) |
| `npm run icons`        | regenerate PWA icons from `scripts/mark.mjs`       |
| `npm run glyphs`       | re-extract Leland note glyphs from Verovio         |
| `npm run progressions` | print generated harmony as text (see **Harmony**)  |

## Architecture

**The curriculum registry is the single source of truth.** `src/config/curriculum.ts`
defines every category, exercise and guide. The top navigation, the homescreen
path and the routes all derive from it. **Never hardcode a category or exercise
list in a component** — add it to the registry and the UI follows. The registry
holds ids, icons and status only; titles and blurbs are translated.

Five config files, deliberately separate:

- `config/curriculum.ts` — _what_ melina teaches
- `config/pathLayout.ts` — _where things sit_ on the homescreen
- `config/musicMarks.ts` — decorative notation geometry
- `config/features.ts` — _what is switched on_ (one flag per category)
- `config/exerciseComponents.ts` — which exercises have a real implementation

An exercise lives in `src/exercises/<name>/` and is reached through
`exerciseComponents.ts`; anything absent falls back to the placeholder page, so
a module can be registered long before it is built. Every module is registered
from day one so the path shows the whole journey; only flagged-on modules are
reachable. Tests enforce that every category has a flag and vice versa.

**State lives in Dexie** (`src/lib/db/`), not in React. There is no server and
no account. Bump the version and add a `.stores()` block to migrate; never edit
an existing version in place or installed clients will not upgrade.

Settings parsers are **defensive**: an unknown id is dropped, a list that comes
back empty falls back to the default, and old stored shapes keep reading (scale
degree settings stored as bare numbers read back as steps in the tonic's own
octave). Every parser is fed its own output in tests.

## Internationalisation — `src/lib/i18n/` and `src/locales/`

English and German, through i18next and `react-i18next`. **No user-visible
string is written in a component.** `src/locales/<lang>/<namespace>.json` holds
every one, bundled rather than fetched — a language that only arrives over the
network is missing on a train.

Namespaces map to areas of the app: `common`, `path`, `curriculum`, `levels`,
`exercise`, `music`, `settings`, `progress`, `guide`.

Three kinds of key:

- **Written by hand**, read with `t('exercise:round.question')`.
- **Derived from a registry id.** `curriculum.ts` and `difficulty.ts` build
  these (`categoryTitleKey`, `exerciseShortKey`, `difficultyTitleKey`, …) so a
  rename in the registry moves the key with it.
- **Music vocabulary**, through the `useMusicNames` hook.

**`lib/music` and `lib/audio` carry no display strings.** Clefs, keys, interval
qualities and pitch letters are named differently in German — B♭ major is
"B-Dur", English B is H, and qualities inflect ("reine Quinte") — so no sentence
can be assembled from English parts. Data files keep ids and arithmetic; names
live in the `music` namespace and are read through `useMusicNames`, a hook so
labels re-render when the language changes.

**A sentence with markup in it is a sentence a translator can break.**
`locales.test.ts` checks placeholders but cannot check that a `<0>` survived, so
links go on a line of their own, and a list of changed degrees is a list of
names rather than a sentence built from parts.

The chosen language is a Dexie setting (`UI_LANGUAGE`). `null` means "never
chose", which lets the browser keep deciding — different from choosing English.
`main.tsx` reads it before first paint; `useLanguage` (called once, in
`AppShell`) keeps i18next and `document.documentElement.lang` in step.

`locales.test.ts` makes adding a language safe: a missing key does not crash —
i18next quietly falls back — so it insists every language holds exactly the
same keys with the same placeholders, and that every key built at runtime from
a registry id resolves.

The PWA manifest and `<meta name="description">` stay English: both are read
before any of this runs.

## Style

- TypeScript strict, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
  No `any`. No non-null `!` without a comment justifying it.
- `verbatimModuleSyntax`: type-only imports use `import type`.
- `erasableSyntaxOnly`: no enums, no constructor parameter properties.
- Named exports everywhere except route/page components (default exports, so
  they can be lazily loaded).
- Function components and hooks only. Props interface named `XProps`, colocated.
- Absolute imports via `@/`. No barrel files — they defeat tree-shaking.
- A file exporting a component exports _only_ components, so Fast Refresh
  works. Helpers go in a sibling module (`input/Switch.tsx` →
  `input/switchClasses.ts`).
- PascalCase component files, camelCase utilities.
- Prettier and its Tailwind class-order plugin are authoritative.

## Design system

Light theme only. One accent colour, otherwise paper and ink.

**Never write a raw hex value or an arbitrary colour in a component.** All
colour, type and easing tokens live in the `@theme` block of
`src/styles/index.css`.

| token                             | value                             |                                       |
| --------------------------------- | --------------------------------- | ------------------------------------- |
| `paper` / `paper-raised`          | `#fcfcfa` / `#ffffff`             | page ground, cards                    |
| `ink` / `ink-muted` / `ink-faint` | `#1c1c1e` / `#55555a` / `#8a8a90` | text, paint spots                     |
| `rule`                            | `#e4e4e0`                         | hairlines                             |
| `accent`                          | `#0d6e6e`                         | 6.1:1 on paper, 6.2:1 white-on-accent |
| `correct` / `wrong`               | `#3f7a34` / `#b3261e`             | feedback                              |

`correct` is warm-shifted so it never reads as "a lighter accent" next to teal
chrome. **Feedback never relies on colour alone** — colour plus icon plus motion.

Headings are EB Garamond, body and UI Inter. Garamond runs light on screen, so
display sizes are bumped and tracked tighter (`text-display`, `text-title`,
`text-heading`). Fonts are self-hosted and Latin-subset only — a Google Fonts
link breaks offline, and other subsets quadruple the precache.

Icons are Ionicons via `react-icons/io5`, behind `ui/Icon.tsx`, added to its
explicit `ICONS` map. **Never `import * as`** from `react-icons`.

## Accessibility

- Every interactive element is keyboard-reachable, focus always visible.
- Unplayable stations are `aria-disabled` **buttons**, so a screen reader says
  why a station cannot be entered.
- Icon-only buttons need an `aria-label`; `ui/Icon` takes a `label` prop.
- Touch targets are at least 44px.
- **Anything pressable moves under a press**, not only under hover — a touch
  screen has no hover. The notation is the largest button in the app.
- **All animation is gated on `useReducedMotion`.** Parallax and draw-in fully
  switch off when the OS asks.

## Deployment

GitHub Pages, from `.github/workflows/deploy.yml` on every push to `main`. It is
a **project page** served from `/melina/`:

- `base` is `/melina/` for `vite build` only — dev and Vitest stay at `/`, so
  route assertions use bare `/train/...` paths. The router's basename comes from
  `import.meta.env.BASE_URL`, never a hardcoded string. `VITE_BASE_PATH`
  overrides it.
- Pages serves `404.html` for any path with no file, so
  `scripts/spa-fallback.mjs` copies `index.html` there after the build —
  otherwise every deep link and refresh is a dead end on the first visit.
- The manifest omits `start_url` and `scope`; vite-plugin-pwa fills both from
  `base`. Hardcoding `/` installed an app that opened on a blank page.

The precache is about **1.1 MB**. Verovio (~7 MB) and the samples are cached at
runtime; if the precache jumps to ~8 MB the lazy-engraver wiring is broken.

## Testing

Vitest with jsdom. `src/test/setup.ts` stubs `matchMedia` and `ResizeObserver`,
swaps in `fake-indexeddb`, clears the Dexie tables between tests and fails any
test that logs a React error.

- **Render smoke tests** (`src/App.test.tsx`) stay: a clean typecheck is not
  evidence the app runs — a library's declared return type once did not match
  what it returned, and the app crashed on first paint.
- **Round-trip wherever a fact can be round-tripped.** `modeOf` reads a scale
  back to its mode, `onsetsOf` a bar back to its impacts, `readChord` a stack
  back to its chord, and the settings parsers and attempt rows are fed their
  own output. A generator is checked against the model, not against a fixture.
- **Assert properties, not lists.** `catalog.test.ts` enforces that hearable
  intervals are one per semitone count, so a well-meant addition fails loudly
  instead of making a question unanswerable.
- **Levels are data**, so `shared/difficulties.test.ts` checks every preset
  names real ids, is named in every language, round-trips through its parser
  unchanged, and generates a **full** round.
- **Mixture tests.** Where a level declares weights, the generator's realised
  output is measured against them (`generate.test.ts` in rhythmic and melodic
  dictation) — a weight right on paper and never reaching a bar does nothing.
- **The real engraver runs only in the node environment**
  (`// @vitest-environment node`): the `*Verovio.test.ts` suites and the other
  notation tests in `lib/notation/`, because jsdom cannot instantiate 7 MB of
  WebAssembly. They carry the assertions nothing structural can make — whether
  an accidental is drawn, that asked and revealed engrave to the same size,
  that a bar being typed into does not move, that no key clips its note
  (`degreeClearance.test.ts`, measured from glyph outlines, not fonts).

### Looking at it — `npm run shot`

**jsdom draws nothing.** A notation change can pass every test and still be
illegible: a page in the wrong units renders every example equally wrong, so
comparisons all agree. The thoroughbass page shipped at a tenth of its size
with fifteen green assertions over it.

```
npm run dev
npm run shot -- /train/thoroughbass/realizing out.png --click "Triads"
```

`scripts/shot.mjs` drives Playwright's cached `chrome-headless-shell` over CDP
with node's own `WebSocket` — nothing to install or add to `package.json`
(`npx playwright install chromium --only-shell` if it is missing).

- `--click` presses a button by visible text or by an **accessible name on a
  descendant** (icon-only buttons), repeatable. Engraved notation is not part
  of the name. A level starts a round in the same tap.
- `--size WxH`, `--wait` (default 1200ms, for the engraver), `--origin` when
  Vite picked another port, `--scroll`, `--scale`.

Do it after anything that changes what is drawn, at **phone width** — that is
where notation and keyboard compete and layouts give out.

## The homescreen path

One vertically scrolling column of stations, serpentining side to side. No map,
no zoom, no drag, no list toggle; scrolling is the browser's own, which keeps it
usable by keyboard, screen reader and thumb without special cases.

### Stations

`stations()` in `curriculum.ts` derives the stops: a category with built
exercises contributes **one station per exercise** (reading and hearing are
different games), one with nothing built a single locked station. Guides
(`GuideDef`) are emitted **before** their category's exercises. A `Station`
carries `kind`, `titleKey` and `blurbKey`.

An **explainer node is a different shape**, not only a colour — a rounded
square with an accent hairline against the filled circle of an exercise — so it
survives a colour-blind reader. Its overline says "Read first". Dashed borders
are taken by `next` and `locked`.

### The route is a graph

`PATH_EDGES` names every join and `CONNECTORS` is built from it; joining
consecutive nodes would zig-zag through braided stations and claim an order the
braid exists to deny. `PATH_NODES` runs strictly downhill because it is the
reading order, not the doing order. `orderedPathNodes` sorts by `position.y`,
not by the registry, so keyboard focus walks down the page.

From the top:

- **The scales guide** stands alone at the head of the scales column, joined to
  scale reading only — joined over the middle it would read as the way in to
  the whole path. `GUIDE_DROP` is its room, `BRAID_TOP` where the braid starts.
- **Braid one:** intervals down the left, scales down the right, reading above
  hearing on both. Read across it is two subjects; read down, two ways of
  knowing one.
- **Braid two:** rhythmic dictation and scale degrees side by side, both
  merging into melodic dictation — the thing that needs both. It sits left of
  centre to leave the right free for thoroughbass.
- **Braid three:** the chords guide, then chord hearing (left) and reading
  (right) side by side, both merging into chord writing. The sides are forced:
  every consecutive pair down the column has to cross the middle.
- **Harmony:** the voice-leading guide, cadence writing, bass dictation — an
  even number of stations so nothing below changes side — then the planned
  categories to the daily round.
- **Thoroughbass is an island**: its guide and two exercises, joined to each
  other and to nothing else, beside the main line. It is a subject taken up
  alongside the journey, not a stage of it. So the guarding property is that
  `PATH_EDGES` has **exactly two components**, which still catches a station
  joined to nothing and the island being wired back into the line.

### Geometry

`position.y` is the centre of a station's **medallion**, not its node box —
connectors are drawn from it, and the label (variable height) hangs below.
`MEDALLION_SIZE` lives in `pathLayout.ts` and is consumed by `PathNode`.

Positions mix units on purpose: **x is a percentage of the column width, y is
absolute pixels**, keeping the serpentine's proportions on any width while
labels stay natural size. Connectors live in one SVG with viewBox
`0 0 100 PATH_HEIGHT` and `preserveAspectRatio="none"`, strokes
`vector-effect="non-scaling-stroke"`.

Braids are **staggered**: `BRAID_STAGGER` (70px) between the columns against a
`BRAID_DROP` (225px) from reading to hearing, so the eye pairs vertically and
everything still runs downhill. **Two stations that stand level cannot also be
joined** — below about 150px of drop a connector has no room between label and
medallion and draws as a stub or inverts. Two stations side by side is also why
the braid columns sit at `INTERVAL_X`/`SCALE_X` = 26/74: two labels of
`min(10.5rem, 42vw)` must fit on a 320px screen.

**Spacing is uneven but bounded**: a constant rhythm reads as a list, so no two
single-file gaps are equal; but gaps stay between
`CONNECTOR_LEAVE + CONNECTOR_ARRIVE` and a ceiling, or the column sprawls.

Positions are hand-placed by station id, so shipping an exercise means adding a
coordinate; an unplaced station falls back to the end and a test asserts that
never happens. `pathLayout.test.ts` guards all of it: every category on the
path once, strictly downhill, uneven spacing (skipping pairs that
`standLevel`), no joined pair level, connectors ending on their stations, full
decoration counts, no label overflowing at any width from 320px.

### Decoration

Splats and notation are placed one per horizontal band, on the side opposite
the nearest station (beside a braid, notation goes down the channel between the
tracks). Splats come from `lib/utils/splat.ts`, seeded so they are identical on
every launch. The layer is **unclipped** — splats bleed off the column and only
the viewport crops them — so parallax depth stays small or drift adds dead
scroll. Parallax reads a single `--scroll` custom property that `PathView`
publishes once per frame; **never re-render React on scroll.**

## Music theory — `src/lib/music/`

Ids and arithmetic only — every name is translated.

**A pitch is a spelling, not a frequency.** `Pitch` carries letter, alteration
and octave, and everything runs on two axes: `diatonicValue` (letter position)
and `chromaticValue` (semitones). That is what makes C→D♭♭ a diminished second
and C→C a unison at the same zero semitones. Never collapse to MIDI and expect
intervals to survive.

- **An interval cannot span negative semitones** — the general rule that rules
  out the diminished unison and doubly-diminished second. No special cases.
- The **diminished second is real** (zero semitones) and telling it from a
  unison is taught, so it must never be simplified away.
- `transpose` returns `undefined` rather than inventing a triple accidental;
  callers retry with another root.

The catalog (`catalog.ts`) orders qualities smallest-first — d, m, P, M, A —
and the keyboard gives each a fixed column.

### Scales — `scale.ts`

**A mode is stored as the interval from its tonic to each degree**, never as
semitones, which is why B♭ dorian comes out B♭ C D♭ E♭ F G A♭. `scalePitches`
walks the letters through `transpose`. Which tonics a mode may use is
**computed**: `isCleanScale` rejects anything past a double accidental, so no
exception list is kept. `modeOf` reads a run back to its mode.

**Harmonic and melodic minor share the list and are not modes** —
`ModeDef.degree` is absent, and three rules follow:

- `signatureMode` says what a scale is written under: itself for a mode, the
  natural minor for these two. The raised degrees print accidentals.
- `isCleanScale` checks the scale it is written under, so D♭ melodic minor
  drops out (D♭ minor is not a written key).
- **Melodic minor only goes up** (`ASCENDING_ONLY_MODE_IDS`): descending it is
  aeolian, a question with two right answers. `MELODY_MODE_IDS` keeps it out of
  anything with a line that moves both ways (scale degrees, melodic dictation).

### Scale degrees — `degree.ts`

**A degree names the step of the mode it is in**; an accidental means only
"not the note the scale has there" (C♯ in A aeolian is `#3`) — the classical
reading, not the jazz one.

**A degree carries an octave**, an offset from the tonic's own: `1` is the
tonic, `1'` the octave above, `7_` the seventh below. Stored `'` up and `_`
down — not the Helmholtz comma, because `degreesKey` joins a melody with
commas. `stepIndex`/`stepAt`/`stepRange` treat degree-plus-octave as one ladder.
A degree keeps its meaning wherever it sits: the fifth below is still _the
fifth_.

**The vocabulary is notes, not names.** ♯1 and ♭2 are one sound, and ♯3 in
major _is_ the fourth. `stepNotes` collects by sounding pitch, each note once
with every name it can go by; `nameMelody` picks which to print and
`degreesSoundEqual` grades by sound. **A level's outermost steps are its
range**: a flattened lowest step or raised highest one is outside it, which is
also what keeps a raised seventh (the octave) out of a major key.

`nameMelody`: a scale note takes the scale's name; a chromatic note is raised
where the line goes on up and lowered where it turns down — **unless one
spelling needs a double accidental**, which drops out first (in B♭ mixolydian
the note under the octave is A♮, not B𝄫). Only doubles: choosing between two
single accidentals is what direction is for.

### Rhythm — `meter.ts`, `rhythm.ts`, `rhythmCells.ts`

**A rhythm is a set of impacts and nothing else.** A snare hit has no audible
length, so note values and rests are engraving decisions — never generated,
stored or graded. `sameRhythm` is the whole of being correct.

**`TICKS_PER_BEAT` is 60 = LCM(4, 3, 5)**: sixteenths, triplets and
quintuplets land on whole numbers, so rhythms compare with `===` and never round.

Metre is **only `n/4`**; compound metres change what a beat is and are left out
rather than half-supported.

**A note may not cross a boundary stronger than the one it starts on** —
`maxDurationAt`, which reproduces the 4/4 table and generalises to 3/4 and 5/4.
`metricLevel` ranks boundaries (smaller is stronger); `BEAT_GROUPS` says how a
bar groups (4/4 is two halves, 5/4 is 3+2 or 2+3).

**A bar is built one beat at a time** from `RhythmCell`s — a division of the
beat plus which parts are struck. Tuplets need no mechanism, no rhythm needs a
tie, and results are idiomatic. No two cells may describe the same impacts.
Levels weight cell **groups** and pick uniformly within one, so a group's weight
does not depend on how many patterns it holds.

**`minOnsets` is held in view while building, never enforced by rejection.**
Redrawing bars until one clears the floor skews the mixture towards dense bars
(it once made half of a level's bars four quarter notes). A cell is refused only
where taking it would put the floor out of reach. The floor is absolute, so keep
it well under the beat count of the shortest metre a level offers.

### A phrase — `phrase.ts`

**A phrase is a list of bars, not a long bar.** `barRhythm(phrase, i)` hands a
bar to everything built for one. There are still **no ties**: a barline is the
strongest boundary, so a sound running past it is written as a note then a rest
— the same sound under legato playback. `rhythmDivision` labels a bar by what it
asks of the player (a bar with one triplet is a triplet bar).

### Melodic contour — `contour.ts`

The next note of a melody is drawn against a weight that falls with distance.
Two shapes: **`steady`** — one spread at every note — and **`paced`** — **the
time to the next note sets the spread** (a sixteenth steps, a half note may
leap), an exponential whose width is a power of the gap. Fixed properties:
**every interval keeps a non-zero weight** (`floor`), the curve is
**symmetrical**, and a **repeated note is notched down** hard. The constants
are meant to be turned; tests assert the properties, and
`melodic-dictation/generate.test.ts` measures what comes out. The rhythm is
generated before the pitches because `paced` needs the note lengths.

### Chords — `chord.ts`

**A chord is a stack of thirds above a root, spelled**: four triads and five
sevenths — the list German Hochschulen ask for. Qualities are stored as
intervals from the root, so B♭ half-diminished is B♭ D♭ F♭ A♭. A sibling of
`figuredBass.ts`, not a replacement: a figure is arithmetic above a bass; root,
quality and inversion are what _naming_ says.

**Inversion is which member is lowest; Lage is which is highest**; the rest
fills in cyclically. `closePosition` is the Lage stacking straight up gives.

**A chord may need one double accidental, never two** (C°7 _is_ B𝄫);
`isCleanChord` computes it. **The augmented triad and fully diminished seventh
have no audible inversion**: `isSymmetric` computes that from the semitone
pattern, and `hearableInversions` offers root position alone for them.
`readChord` reads a stack back. `inversionFigure` is the one table (`5/3`, `6`,
`6/4`, `7`, `6/5`, `4/3`, `2`) and carries no accidentals.

### Where a chord's notes sit — `voicing.ts`

The one place that decides, read by staff, verdict and keyboard alike.

- **Close position**: each note at the lowest place above the one before, in
  the order given — so the player shapes the chord by press order, and a Lage is
  voiced by handing its top member last.
- **A chord after another sits nearest to it**: its first (lowest) note goes at
  the octave closest to where the previous chord began. A close chord is
  positioned entirely by its lowest note, so this is the whole of the voice
  leading, and a 4–3 resolves by a step.
- **An opening chord starts low** (`openingPitch`): the first note goes at the
  octave within three staff steps of the clef's bottom line — B3–A4 treble,
  D2–C3 bass — so a close seventh chord built upward stays on the staff. Opened
  mid-staff, a chord had to be moved down an octave while it was being typed.
- `ontoTheStaff` moves a whole chord by an octave only if it would leave the
  clef's range.

**A note already on the staff never moves when the next one arrives**, which is
why the anchor is the first note rather than the chord's centre. `voiceChords`
threads the reference along a succession, and **everything that builds a
question uses it**, including reading a row back out of the attempt log.

### Figured bass — `figuredBass.ts`

Ground truth is Grove's article on Thoroughbass.

**A figure is interval arithmetic above a bass, read through a key signature**
— never a chord name. `6` means a sixth above this bass, spelled as the key
spells it; resolution walks up the letters asking `alterationInKey`. No roots,
qualities or Roman numerals.

**A question is a bass line**: a `BassEvent` holds a bass note and a _list_ of
figures, so a suspension is two figures under one held bass, and a line is
several events.

`STACKS` is the one table — the complete sonorities a written figure
abbreviates (a convention, not arithmetic). `expandFigure` takes the first stack
containing every number written; `canonicalFigures` runs it backwards. Order
matters: `[5, 4]` before `[6, 4]` (a bare `4` is a suspended fourth), ninths
last. Each compound figure has **one** spelling in `STACKS` (`7/4/2`, not
`9/7/4`), because a number names a letter and register is what a figure does not
say. `10`–`14` are read in the guide and never asked for.

**Grading is canonical, not merely correct** — "a wholesome rule forbids any
Figure not absolutely necessary". It accepts a set where two forms are current
(`2` and `4/2`), the full form when a figure follows another on the same bass
(`afterAnother`), and a figure following another writes only the line that moved
(`4 3`, via `previous`). **A line carrying an accidental is always written**,
which is where the bare `♯` comes from.

**`♯` and `♭` shift a semitone from what the key gives; `♮` asks for the natural
note** — so a `♮` on an already-natural note is not a figure.

**No written figure stands for two chords over one bass**, enforced as a
property. **The generator derives each question's figure from its notes**
(`preferredFigure`), so it can never ask for something grading would reject; a
bass is drawn from the key's notes. A figure needs at most a double accidental,
by construction. **2–3 is absent**: the bass is the dissonance and moves, which
is a bass line, not a suspension.

## Harmony — `key.ts`, `harmony.ts`, `satzmodell.ts`, `progression.ts`

**A progression is a stack of named blocks, not a chain of chords** — so it
arrives somewhere, uses techniques with names, and carries a label saying what
was heard. Four layers:

- **Key** (`key.ts`) — tonic and mode. **Minor is stored as `aeolian`**; the
  raised degrees come from the chords, as in the notation.
- **`ChordSpec`** — the plan: step, quality, inversion, beats. No pitches.
- **`HarmonicEvent`** — the fact: spelled pitch classes over a bass, and a
  length in ticks.
- **`Satz`** (`satbVoicing.ts`) — four spelled pitches per event.

**The plan generates downward; every reading derives upward**: figure
(`preferredFigure`), Stufe (`readChord`), function symbol (a table) — one model,
not three. **One convention table**: `RAISED_DEGREES` raises the seventh scale
degree in V and vii of minor, which gets V, V7, vii° and vii°7 right at once.
**A sequence stays in the mode** (`ChordSpec.plain`): a passing `v` in a
Quintfall must not raise its third into a cross-relation.

### The backwards walk

**The destination is chosen first**: a cadence is picked and blocks are
prepended until the length is reached — "what may precede a dominant" has a
short confident answer. A single chord is a block of length one
(`FREE_BLOCKS`); `freeWeight` is how often the walk reaches for them, and the
analysis records `frei`. **One table**, `PRECEDENTS`, is both transition weights
and adjacency rule. Two mechanisms express the literature: **fixed schemas** and
**transposition sequences** — widening the vocabulary is rows, never code. **A
walk that runs out of moves is refused**, not shortened; the caller draws again.

### Stored as a figured bass

```
bass    "C,F,G,G,C"
figures ",,6/4-5/3,"      ← ',' bass notes · '-' successive figures · '/' lines
```

`preferredFigure` and `figurePitches` are exact inverses, so bass plus figures
is all a progression needs; chords, Stufen, functions, voices and the answer are
derived. **The analysis is the one thing stored and not derived** — whether
`I–IV–V–I` is a cadence or the tail of a sequence is a reading.
`constraintsOf` places a span's voicing constraints by the span's own `from`.

### Four parts — `satbVoicing.ts` → `voiceLeading.ts` → `satb.ts`

A line, not a cycle: `satbVoicing.ts` is vocabulary (`VoiceId`, `Voicing`,
`SATB_RANGES`, `Move`, `motionBetween`), `voiceLeading.ts` the rules, `satb.ts`
the search and its pricing (`CHORALE_WEIGHTS`, `voicingCost`, `transitionCost`).

**`voiceLeading.ts` is written once and read three times**: as a filter the
generator searches through, as a **grader** returning findings over a finished
`Satz`, and as the **list** the guide walks. Every rule is a row in
`VOICE_LEADING_RULES` with id, kind, severity and a `check` returning the voices
at fault. `RuleKind` separates _a different chord_ (`wrong-note`,
`incomplete-chord`, always in force) from the Satzfehler a level may select
(`SELECTABLE_RULE_IDS`). Every findings function takes a `RuleSet`;
`undefined` means all, which is what the generator passes — a level's selection
never makes the app's own writing worse. Tests voice every level's progressions
and insist the grader finds nothing.

**Voicing is a shortest path**: Viterbi over (event, voicing) nodes, with an
exact branch and bound (`contourFloor` is measured, not assumed). The soprano
is shaped by `leapWeight` from `contour.ts`, and `voicingCost` pulls each voice
towards the middle of its compass. `SATB_RANGES` are chorale ranges, not the
staff ranges in `clef.ts`.

**`npm run progressions`** prints Stufen, figures, voices and analysis for many
progressions at once — the fast loop for tuning block weights.

## Notation — `src/lib/notation/` and `src/components/notation/`

Verovio is **~7 MB of WebAssembly embedded in JavaScript**. It stays lazy:
dynamic `import()` from a `React.lazy` route, its own Rollup chunk, excluded
from the precache by `globIgnores` and cached at runtime. Leland ships inside
the wasm.

Every render goes through **`Score`**, which is where app-wide fixes live:
`[&_svg]:font-serif` swaps Verovio's `Times, serif` for EB Garamond (a
presentation attribute, so a class beats it; the only real `<text>` is staff
labels and figures, and Garamond is narrower than Times so labels are not
clipped), and a `decorate` hook applies markup changes without re-engraving.

Rules the engraver will not enforce, each pinned by a node-environment test:

- **Print an accidental only when it differs from what is in force.** `@accid`
  is drawn, `@accid.ges` silent. In a melody (`melodyMei`) **an accidental
  holds until the barline** on its own line or space and octave, and taking back
  a double needs ♮♯ (`ns`). Intervals and scales are exempt: a harmonic unison
  is two noteheads each with its own accidental, and a scale is keyless.
  `measureAccidentals` resets at every barline.
- **A double sharp is `x`, not `ss`** (two sharps); `ff` is right. Written and
  gestural accidentals are separate MEI types with separate maps in `mei.ts`.
- **A harmonic unison is two successive noteheads**, not a chord — stacked,
  C→C♯ and C♯→C♯ engrave identically. Anything spanning two positions stacks.
- **A hidden note is engraved and not drawn** (`@visible="false"`), so asking
  and revealing produce the same page and nothing slides.
- **Scales and chords are keyless**: a mode or quality is read off the
  accidentals, and a signature would answer half the question.
- The question generator anchors an accidental to the key signature ~78% of
  the time; uniform picks produced F♭ in D major.

### Size

**The page only ever scales an engraved SVG down to fit its column**, so for
anything that overflows, staff size changes nothing visible and **note
spacing** is the dial: `SCALE_NOTE_SPACING` (0.3; the default is 0.25, the
engraver refuses >1.0 — alternatives are tabled in `verovio.ts`). Staff size
(`DEFAULT_STAFF_SIZE`, 95) matters only for what never overflows, like a
two-note interval. `renderMei` sets options immediately before its render, and
everything to `renderToSVG` is synchronous, so renders cannot interleave.

**A staff being typed into is engraved to a fixed page**, not fitted to its
content, or it shrinks under the player's hands. A profile pins `pageWidth` and
`pageHeight` (needing `breaks: 'auto'`), the unentered remainder is padded with
`<space>`, and the page is sized for the **worst case** the keyboard could
produce. **That worst case is then stretched to fill** (`FILL_THE_PAGE`,
`minLastJustification: 0`), or a typical answer huddles at the left. A melody
has one event per slot, so its notes never move; a rhythm's do shift as the bar
fills, which is accepted — the box and staff size never change.

**`pageWidth`/`pageHeight` are a tenth of the viewBox units a render reports.**
Calibrating from the viewBox makes a page ten times too big, and nothing that
compares renders against each other can see it — so profiles are checked
against a bar of rhythm known to be right.

**The staff is bounded by the room left for it**, never by a viewport slice:
`SCORE_BOX` / `PHRASE_SCORE_BOX` in `exercises/shared/scoreBox.ts`, with `h-full`
on the box, `min-h-0` on every ancestor and `items-stretch` on the row, so the
SVG's `max-h-full` has a definite parent. Without that the notation sizes the
box and spills over the prompt and the Next button.

### Rhythm on the page — `rhythmNotation.ts`

The spelling half of a rhythm: readable and **stable**, and reading impacts back
off the spelling returns what went in, over every generatable rhythm. No ties,
no dotted sixteenth (22.5 ticks). One-line staff, percussion clef, stems down.
The page width is **per metre** (the densest bar in 5/4 would halve a 2/4
staff); note spacing stays default. **A half-typed tuplet pads itself**
(`tupletSpaces`, the `space` symbol kind), because padding after it could never
land on the grid, and a short measure made the justified bar open and close
under the player's hands. A beat, not a change of division, closes a bracket
(`draftNodes`) — two triplets are two brackets, not a sextuplet.

### A phrase on the page — `melodicPhraseMei`

A five-line staff, one `<measure>` per bar, **one bar to a system** with
encoded `<sb/>` breaks (Verovio otherwise re-breaks as a bar fills). The page
reserves one system of the worst case — a quintuplet per beat, a double
accidental per note, seven sharps. The reserve is also compared against what
the music wants on its own page, because Verovio _fits_ a too-narrow page by
squeezing, which no ink-extent check sees. Two bars ship; four is a Custom
setting, since four systems on a phone is unreadable.

### The grand staff and figures — `thoroughbassMei`

- The brace is a `<grpSym>` child, not `@symbol`.
- An accidental in a figure is the character `♯`, not `<accid>`.
- `@extender` draws nothing, so a suspension's dash is part of the figure's
  text (`figureLines`); the test asserts the silence so it fails the day
  Verovio grows a real extender. Continuation lines wait on the same thing.
- **Figures are anchored by timestamp and then centred** by `centreFigures`
  (`text-anchor="middle"` at the notehead's middle, keeping the engraver's x in
  `data-engraved-x`); the half-notehead and half-dash offsets are measured
  constants in `renderGeometry.ts`, and `figureAlignment.test.ts` pins what the
  measurement rests on.
- **A figure's accidental needs `smuflTextFont: 'embedded'`** (Leipzig is not a
  browser font); the embed costs ~60 KB per render that has one.
- The brace draws at x ≈ −432, so this profile widens `pageMarginLeft` or it is
  clipped.
- One measure per bass note, invisible barlines, no time signature.

**The chord cursor** is a `<rect>` drawn into the render (via `decorate`), not
an HTML overlay, so it scales with the engraving. Positions are read back off
the render (`scoreCursor.ts`): authored `xml:id`s survive as element ids, a
measure's staff lines give its width, and nothing moves while typing. Every band
is the same width, there is none when a question has one chord, and the first is
held off the clef. It draws `stroke-width: 0` rather than no stroke, because
Verovio's own `#id rect { stroke: currentColor }` beats any class.

### A four-part setting — `satbMei.ts`, `satbProfile`

Two layers to a staff (upper stems up, lower down), one measure per bass note
with a held bass written once, and three `<harm>` rows under it — figures,
Stufen, functions. The page is fixed and sized for the **revealed** version,
measured against the widest labels: sized from the music alone it wrapped under
`breaks: 'auto'` and **chords silently vanished** onto an unrendered page.

### The placeholder note

Melodic dictation's first-note hint is `@type="placeholder"`, faded with
**`opacity`, not colour** (`placeholderClasses.ts`) — Verovio's `#id path
{ stroke: currentColor }` beats any class, so stroke never reaches stems.
Ledger lines are a separate `<g class="ledgerLines">` in the staff, faded
wholesale only while the placeholder is the only note.

### The keyboard's glyphs

The keyboards draw real Leland glyphs extracted by `npm run glyphs` into
`components/notation/glyphs.ts`, because they must draw before the engraver
downloads. `NoteGlyph` places them from measured boxes. `MiniStaff` (a pitch on
a key) renders through Verovio with `cropToStaff`, and holds its last picture
while re-engraving so a row does not flicker.

## Audio — `src/lib/audio/`

Sampled, not synthesised — a sine wave teaches you to recognise a sine wave.
`smplr` provides a Steinway (`SplendidGrandPiano`) for anything pitched and the
LinnDrum (`LM-2`) for rhythm. **What a question is played on is not a setting.**
Drum samples are named one by one (a bare `snare` resolves to whatever comes
first in the manifest); the count-in uses sidesticks.

- **An AudioContext must be created and resumed inside a user gesture** —
  `unlockAudio()` in the tap handler itself, not an effect.
- A context can be suspended again when a tab is backgrounded, so playback
  resumes defensively before every note.
- **`instrument.stop()` does not stop notes not yet dispatched** (smplr
  schedules ~200ms ahead), so the engine keeps each note's own stop function and
  `stopPlayback` calls them all, **synchronously** — a deferred stop can land
  after the next question has scheduled itself.
- Nothing outlives its question: `usePlayback` stops on unmount and whenever
  `sound` is rebound, and replay stops before it plays.

**When things sound is pure arithmetic outside `engine.ts`** —
`rhythmSchedule.ts`, `chordSchedule`, `harmony-shared/schedule.ts` — so it is
testable without a network or an AudioContext. Rules there:

- **Legato**: every melody note rings until the next impact
  (`melodyDurations`), which is what makes a held note and a note-plus-rest the
  same answer.
- Chords of a figured bass **follow one another**, and **a held bass is struck
  once** — restriking says it moved.
- An arpeggiated chord **accumulates**, every note ringing to the end.
- **Harmony**: the key-establishing cadence (I–IV–V7–I) is quarter notes at a
  fixed `ESTABLISH_TEMPO` (80) whatever the question's tempo, because it is
  heard before every question; the question plays at its level's tempo (64,
  80 or 100).
- `MetronomeMode` (whether the click continues under the bar) is a real
  difficulty axis, not a preference.

`playInterval`, `playScale` and `playChord` wrap `playSequence`; a gap of zero
makes an interval harmonic. `playMelody` shares one note list between the piano
and the count-in. The player type is imported from smplr, so upstream API
changes are type errors.

Samples are cached at runtime (`melina-samples`), never precached; `smplr`
itself is a small precached chunk. Hearing exercises preload the piano; reading
exercises fetch it on first press; rhythmic dictation passes `loadDrums` to
`usePlayback` so it does not pull the piano for a snare.

## Exercises — `src/exercises/`

Fourteen exercises. The folders say which share what:

- `shared/` is **exercise-agnostic** and must never learn what an interval or a
  mode is: the `useRound` state machine, `LevelsScreen`, `RoundScreen`,
  `RoundSummary`, setup controls, `PlayableScore`, `usePlayback`, `SCORE_BOX`.
- `interval-shared/` + `interval-reading/`, `interval-hearing/`
- `scale-shared/` + `scale-reading/`, `scale-hearing/`
- `scale-degrees/` — hear a tonic triad and a short melody, write it as degrees.
- `rhythm-dictation/`, `melodic-dictation/`, sharing `dictation-shared/` (the
  bar draft, `buildBar`, and `DegreeDraft`, which bass dictation also writes
  into).
- `thoroughbass-shared/` + `thoroughbass-figuring/`, `thoroughbass-realizing/`
- `chord-shared/` + `chord-reading/`, `chord-hearing/`, `chord-writing/`
- `harmony-shared/` + `bass-dictation/`, `cadence-writing/` (the harmony setup
  screen is shared, taking a settings **patch** and the exercise's own sections
  as `children`).
- `chord-entry/` — the draft a chord is pressed into (thoroughbass realising,
  chord writing); `satb-entry/` — its sibling where which voice sings which
  note is the answer.

A subject folder supplies a generator, a `RoundRules` (build a round, what is
right, what to log) and thin wrappers. Within a pair, only what differs lives in
the exercise folder. **Prefer an escape hatch on a shared component over
widening its idea of a question** — `RoundScreen` takes a whole `score` node,
`RoundSummary` groups by a caller-supplied label, `usePlayback` takes the
instrument to preload.

**A string read by a shared screen may not name what one exercise asks about**
— `ScaleExercise.test.tsx` fails on the word "interval" in visible text _and_
accessible names.

### The round

**Levels are the landing screen.** Each exercise has a `difficulties.ts` of
presets; picking one starts a round in the same tap. Custom is last and opens
the full settings screen. They are **weaknesses, not rungs**. Names and blurbs
live in `levels.json` under `<exercise-group>.<id>`. A list may come in
**sections** (`Difficulty.section`, grouped by `levelRuns`) with continuous
numbering.

**"Change settings" returns to where the settings were chosen**:
`useRound.changeSettings` goes to Custom after a round started from Custom
(kept across Play again) and to the levels after one a level started.

`?screen=setup` on an exercise URL restores the Custom screen after a trip to a
guide — settings survive in Dexie, the visible screen is React state.

**Nothing advances by itself**, not even a right answer: the reveal is the
first moment a reading or writing question's music can be heard.

**The notation is the play button**, pressable only once every note is on
screen (a hearing question at once, a reading question after the reveal). The
affordance is `PlayMark`, a faint speaker in the staff's corner, which also
shows loading and failure. Where the staff holds the _answer_ — rhythmic
dictation, scale degrees — replay is its own control above it. **The frame
around the notation is identical whether or not it is pressable**, or the staff
shifts at the moment the answer arrives.

**A wrong answer is not replaced by the right one**: both are drawn side by
side, each named, with the play button on the right-hand one.

**An answer written rather than chosen submits itself when exactly full**:
keys that would overflow are disabled, so the last possible press answers. Only
`FigureKeyboard` has a confirm key, because a figure has no fixed length.

### Intervals and scales

`PlayDirection` (`harmonic | ascending | descending`) decides playback,
engraving, and **which note is shown first** (`leadingNote()`, `firstNote()`).
`staffOnly` narrows a clef to its five lines; the generator retries without it
rather than drop a wide interval.

**Hearing offers only intervals that sound different** —
`HEARABLE_INTERVAL_KEYS`, one per semitone count (the tritone is the augmented
fourth). Every mode sounds different from every other (asserted); melodic minor
is dropped from descending rounds by `modeDirections`. On a keyless staff **the
tonic decides how much ink there is**, so tonics are a level axis.

### Scale degrees

A tonic triad, then a short melody with no rhythm. **Steps are octave-specific**:
a level names steps as degree keys (`7_`, `1`, `1'`), `DEGREE_STEP_CHOICES`
runs from the fifth below the tonic to its octave, and the keyboard has one key
per step, each drawing its note in its own octave. Grading is by sounding pitch,
so the seventh below and the seventh above are different answers. A level
reaching below the tonic places the key so those steps fit the clef too.

Only the first level opens every melody on the tonic (`startOnTonic`); the
triad is anchor enough. The summary groups misses by **the first degree that
went wrong**, compared by sound.

### Rhythmic dictation

**The draft is the keys pressed, not the impacts** — a player who writes a rest
should see a rest — and only impacts are graded. The keyboard is **modes, not
keys**: rest and dotted are one-shot and mean the next key; the tuplet switch
belongs to the draft and holds until its beat is full. A level's `cellWeights`
both admits (`0` = absent) and weights a group.

### Melodic dictation

Hear a phrase, write it down. **Correctness is two facts**: impacts right bar
by bar (`samePhrase`) and notes right **by sound** (`sameSounds`). The first
note's pitch is a **placeholder on the staff**, not a draft entry, so its
length is not given away. Beat one of bar one is always struck.

The vocabulary is a **contiguous run of steps**, `low` to `high` (`MAX_STEPS`
13), and the run _is_ the keyboard. Three rows: one-shot switches; **the note
value, a mode that stays** (and falls back to the largest value that fits rather
than going dead); the pitch keys, **each drawing the note that pressing it would
write** at the armed value. The summary separates rhythm from notes.

### Thoroughbass

**Figuring** shows the chord and asks for the figure; **Realising** shows the
figure and asks for the chord. Correct realising is **the set of pitch classes
above the bass** — octave and spacing are the player's; `voiceChord` places
them for staff and verdict alike. A row keeps bass and figures only. The verdict
checks every figure under a bass. Three bass notes is the most a level asks for
— a fourth fits a desk, not a phone.

**`FigureKeyboard` is a telephone pad**: accidentals as one-shot switches,
`1`–`9`, then `—`, `✓`, `⌫`. A digit adds a line to the column, the dash opens
the next column under the same bass (`4 — 3`), and a column draws
highest-first however it was typed. "No figure" is pressing ✓ straight away.

**`ChordKeyboard`** is seven letter keys spelled by `alterationInKey`, plus
one-shot accidentals (which stack to a double for chord writing). **Each key
draws the note pressing it would write, octave and all**, computed by
`placedPitch` through the same `voiceChords` the staff runs — two answers to
where a note sits could disagree. A note already in the chord shows where it
sits; once every chord is written, keys show where a new chord would open.

The levels share one list in two runs; vocabulary (which figures) and span
(bass notes, figures per note) are separate axes. A level naming a figure must
name its canonical form (`6/♯4`, not `♯4`).

### Chords

**One question type serves reading, hearing and writing**; `ChordRoundSpec`
adds what the exercise fixes (`byEar`, `namesRoot`), and `chordSpec` is the one
place a level's settings meet those facts. Only reading asks for the root.
**`asks` is carried on the question** (a symmetric chord asks no inversion),
while `keyboardRows` is per round — a row appearing per question would give the
quality away.

`ChordNameKeyboard` has no confirm key (one choice per row) and
size-independent position labels. Writing reuses `ChordKeyboard` and grades the
notes, the bass, and the top only where a Lage was named. **Playback is a level
axis only for hearing**; `chordSpec` forces `harmonic` for reading and writing,
because the direction is what the attempt log records.

### Bass dictation — `harmony/bass`

Hear a four-part progression, write the bass as scale degrees, **without an
octave** (the octave is the voicing search's, not the harmony's). A cadence is
played first to fix the key, built and voiced like any progression. The summary
groups misses by **the cadence the progression closed with**.

### Cadence writing — `harmony/cadence`

A figured bass and a named opening Lage; write the upper three parts. **The
answer is not compared against anything** — it is marked by which rules it
broke: the chords always, the Lage always (from the question, not a rule), and
the Satzfehler the level names, of which **only errors fail**. A level names
rule families (parallels, spacing, doubling, resolutions) — weaknesses, not
rungs. `cadenceConstraints` lets the prompt's Lage outrank a block's own
soprano, for both generator and attempt read-back. Nothing sounds until the
answer is in; then the staff sounds what the player wrote. No model answer is
drawn.

`SatbKeyboard`: seven letter keys, with `placedPitch` following each voice from
the chord before, and one one-shot **other octave** switch (a voice's compass
spans under two octaves). Keys draw on their voice's staff with its stem
(`VOICE_PARTS`, shared with `satbMei`). Accidentals are always offered. The
findings are text, in a `shrink-0` list capped at three lines with its height
reserved.

## Guides — `src/pages/*Page.tsx` and `components/explain/`

Five: **melodic shape** (`/guide/melodic-shape`, contextual help from a
setting's question mark), and four **stations** that must be read before their
exercises make sense — **modes** (`/guide/scales`), **figured bass**,
**chords** and **voice leading**. Stations also keep their question mark;
`?from=` says which exercise opened a guide (an unknown value is the path), and
returning to a setting goes to `?screen=setup`. Guides are `GuideDef`s, not
`ExerciseDef`s — no round, settings or accuracy — on headerless routes with
their own back link, and use the `guide` namespace.

**Guides are computed from the model, never drawn to match it**, and tested so
they cannot describe what the app no longer does:

- `contourSeries.ts` evaluates `contour.ts`; `MelodyShapePage.test.tsx` asserts
  the shape of what the figures say.
- Figured bass examples come from `describeEvent` with bass/key data in
  `figuredBassExamples.ts`, held to `canonicalFigures` — the guide can never
  print a figure the exercise would mark wrong.
- The modes page draws all nine on C, and the shorthand (`1 2 ♭3 4 5 6 ♭7`,
  and which of major/minor a mode is read against — whichever is fewer changes)
  is computed from `DEGREE_QUALITIES`.
- Chord examples are held to `isCleanChord`.
- The voice-leading table walks `VOICE_LEADING_RULES`, and each example shows
  **exactly** its one fault by the real detector.

**Every engraved example is playable** through `PlayableExample`, which wraps
the staff without changing its layout. Its sound must be **memoised** — the
playback hook stops on identity change. A figured bass pair sounds the bass
alone for the printed half and the chord for the played half. Examples use
non-fixed profiles (nothing is typed into them) inside a box of definite height.

The figured bass guide links Grove — the app's only external link — on its own
translated line, with the leaving icon and no opener reference.

## The attempt log — `lib/db/attemptQuestion.ts` and `progress.ts`

Every answer is recorded, right or wrong. **A row keeps exactly enough to ask
the question again**: an interval is a lower note and an interval key, a scale a
tonic and mode, a rhythm a metre, impacts and tempo, a melody its impacts bar by
bar (`0,60|0,90`) plus tonic, mode and degrees, a chord root, quality, inversion
and Lage, a progression its bass, figures and analysis. Everything implied —
upper notes, spellings, note values, voicings, the right answer — is derived on
the way out, so a row cannot disagree with itself or its notation. Nothing about
the level is stored; `staffOnly` and `close` are derived facets.

**One query with an open-ended filter**: `accuracy(filter)` names any subset of
the flat facets `attemptFacets` derives and leaves the rest open — `{}` is
everything, `{ root: 'Eb' }` every question built on E♭ in any exercise. A
level's settings are a filter naming its bounded dimensions (weights shape what
comes up and are not a filter). `category` and `format` are split from the
exercise id. A dimension an attempt lacks (a rhythm has no `root`) excludes it.

The levels screen shows accuracy only past `ACCURACY_MINIMUM` (15) matching
answers, over the last `ACCURACY_WINDOW` (100), newest first, walking
`[exerciseId+ts]` backwards. `rate` is `undefined`, not `0`, when nothing
matched. The visible figure is `aria-hidden` beside a spoken form saying what
was measured.

## Progress — `ProgressPage.tsx` and `lib/db/history.ts`

Reached from the streak button at the right of the header, mirroring settings
at the left; neither is a station. **Nothing new is stored**: streaks, totals
and breakdowns are pure functions over the log, read once and sliced in memory.
`practiceDays` walks the `ts` index with `eachKey` and never loads a row, since
the header draws a streak on every screen.

- **A streak survives until a whole day passes without practice**; today
  untouched shows it greyed. The flame is filled and accent once today has an
  answer, a grey outline until then.
- **A day is the local day**; `shiftDay` walks by calendar date, so daylight
  saving does not swallow one.
- The chart stacks accuracy (line, broken across empty days) over volume (bars).
  Columns are real `<button>`s.
- The heatmap is a picture, not a control (ten-pixel targets fail 44px), with
  one accessible summary; its range starts on a Monday.
- Breakdowns use `groupBy(rows, dimension)` on the same facets, **weakest
  first**; the page lists `interval`, `mode`, `clef`, `keySignature` and `root`.

## Settings

One setting, the interface language, reached from the top bar only.

## Not yet built

Harmonic prediction, harmonic completion, counterpoint and the daily round are
placeholders, as are interval singing, two-voice dictation and unfigured bass.

- **The chorale is next for the four-part machinery**: `satb-entry` already
  takes which voices are given, `voiceLeading.ts` grades any `Satz`, and
  `SatbKeyboard` is voice-agnostic. It needs public-domain melodies, a
  harmoniser, and — for a modal Kantionalsatz — a second rule set.
- **Harmoniefremde Töne** would be a layer over a finished setting
  (`HarmonicEvent.ticks` leaves room); only figured suspensions ship.
- **More blocks** — Romanesca, Folia, Lamentobass, Oktavregel, 5–6/7–6,
  augmented sixths, mixture — are rows in `satzmodell.ts`, not code.
- **Modulation**: a block may change key; none does.
- A true continuation line waits on Verovio drawing `@extender`.
- A figure's accidental could self-host the Leipzig font (as `npm run glyphs`
  does for Leland) instead of embedding it per render.
