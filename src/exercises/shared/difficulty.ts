/**
 * A named set of practice settings.
 *
 * Levels rather than a difficulty ladder: they are not strictly ordered, and
 * picking one is choosing *what* to work on as much as how hard it should be.
 * "Descending" is not harder than "Flat Keys", it is a different weakness.
 *
 * Every exercise ends its list with Custom, which opens the full settings
 * screen — the levels are shortcuts through it, never a replacement.
 *
 * The name and the one-line description are translated, so only the id lives
 * here; `locales/<lang>/levels.json` holds `<group>.<id>.title` and `.blurb`
 * for each one, and `LevelsScreen` looks them up.
 */
export interface Difficulty<TSettings> {
  id: string
  settings: TSettings
}

/** Which block of `levels.json` an exercise's presets are named in. */
export type DifficultyGroup = 'reading' | 'hearing'

export function difficultyTitleKey(group: DifficultyGroup, id: string): string {
  return `levels:${group}.${id}.title`
}

export function difficultyBlurbKey(group: DifficultyGroup, id: string): string {
  return `levels:${group}.${id}.blurb`
}
