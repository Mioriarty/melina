# melina

A progressive web app for preparing for classical composition studies — ear
training, dictation, harmony, counterpoint and daily composition practice.
Named after the toki pona word for melody.

Everything runs locally. No account, no server, no network required after the
first load.

## Getting started

```bash
npm install
npm run dev
```

## Status

**Milestone 1 — the foundation and the homescreen.** The homescreen is a
draggable map: the seven training areas scattered across a canvas, joined by
dashed routes, over dark-grey paint spots that drift with a little parallax as
you pan. Pinch or scroll to zoom; the compass button reframes the whole map.
A **List** view gives the same thing as a plain, fully accessible list.

Every training module is registered and visible on the map, but none is playable
yet — they show as _Coming soon_. **Interval Hearing** is next.

## Scripts

|                     |                                                  |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | dev server                                       |
| `npm run build`     | typecheck + production build                     |
| `npm run preview`   | serve the production build                       |
| `npm run typecheck` | `tsc -b`                                         |
| `npm run lint`      | oxlint                                           |
| `npm run format`    | Prettier, including Tailwind class ordering      |
| `npm test`          | Vitest                                           |
| `npm run icons`     | regenerate the PWA icons from `scripts/mark.mjs` |

## Stack

React 19 · TypeScript (strict) · Tailwind v4 · Vite 8 · react-router · Dexie
(IndexedDB) · Verovio (notation, Leland font) · Ionicons via react-icons ·
vite-plugin-pwa

The interval theory is implemented from scratch in `src/lib/music/` rather than
taken from a library: intervals are modelled by spelling, so a diminished second
and a perfect unison are different things.

Sampled-instrument playback arrives with Interval Hearing.

## Contributing

See [CLAUDE.md](CLAUDE.md) for architecture and conventions. The short version:
the curriculum registry in `src/config/curriculum.ts` drives the path and the
routes — never hardcode a category list in a component.
