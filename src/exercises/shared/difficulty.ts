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
  /**
   * Which run of the level list this belongs to.
   *
   * An exercise whose vocabulary outgrows one list splits it rather than
   * growing a second station: the path is what you practise, and a subject
   * does not become two subjects because it has more in it. Levels with no
   * section are a single unnamed run, which is what every exercise but
   * thoroughbass has.
   *
   * The sections are still not a difficulty ladder *within* themselves — the
   * rule at the top of this file holds — but between them they are honestly
   * ordered: you cannot read a ninth before you can read a sixth.
   */
  section?: string
}

/**
 * Which block of `levels.json` an exercise's presets are named in. One per
 * exercise, not per kind: interval reading and scale reading are both
 * "reading" and share nothing else.
 */
export type DifficultyGroup =
  | 'interval-reading'
  | 'interval-hearing'
  | 'scale-reading'
  | 'scale-hearing'
  | 'rhythm-dictation'
  | 'thoroughbass-figuring'
  | 'thoroughbass-realizing'
  | 'scale-degrees'
  | 'melodic-dictation'

export function difficultyTitleKey(group: DifficultyGroup, id: string): string {
  return `levels:${group}.${id}.title`
}

export function difficultyBlurbKey(group: DifficultyGroup, id: string): string {
  return `levels:${group}.${id}.blurb`
}

export function difficultySectionKey(group: DifficultyGroup, section: string): string {
  return `levels:${group}.sections.${section}`
}

/**
 * The list as runs, in the order it was written.
 *
 * Consecutive levels sharing a section become one run; a level with no section
 * joins the unnamed run beside it. Order is preserved rather than sorted,
 * because the order a level list is written in is the order it is meant to be
 * read in — and `difficulties.test.ts` insists a section's levels are
 * contiguous, so a run can never be split in two by a stray entry.
 */
export interface LevelRun<TLevel> {
  section: string | undefined
  levels: readonly { level: TLevel; index: number }[]
}

/** Generic over anything carrying a section, because that is all it reads. */
export function levelRuns<TLevel extends { section?: string }>(
  levels: readonly TLevel[],
): readonly LevelRun<TLevel>[] {
  const runs: LevelRun<TLevel>[] = []

  levels.forEach((level, index) => {
    const last = runs[runs.length - 1]
    if (last !== undefined && last.section === level.section) {
      runs[runs.length - 1] = {
        section: last.section,
        levels: [...last.levels, { level, index }],
      }
      return
    }
    runs.push({ section: level.section, levels: [{ level, index }] })
  })

  return runs
}
