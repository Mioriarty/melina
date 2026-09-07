import { describe, expect, it } from 'vitest'

import { CATEGORIES, categoryPath } from './curriculum'
import { FEATURES } from './features'

describe('feature flags', () => {
  it('has a flag for every category', () => {
    for (const category of CATEGORIES) {
      expect(
        Object.hasOwn(FEATURES, category.id),
        `no feature flag for "${category.id}" — add one to features.ts`,
      ).toBe(true)
    }
  })

  it('has no flags for categories that no longer exist', () => {
    const ids = new Set(CATEGORIES.map((category) => category.id))
    for (const key of Object.keys(FEATURES)) {
      expect(ids.has(key), `stale feature flag "${key}"`).toBe(true)
    }
  })
})

describe('curriculum', () => {
  it('has unique category ids', () => {
    const ids = CATEGORIES.map((category) => category.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has unique exercise ids within each category', () => {
    for (const category of CATEGORIES) {
      const ids = category.exercises.map((exercise) => exercise.id)
      expect(new Set(ids).size, `duplicate exercise id in ${category.id}`).toBe(
        ids.length,
      )
    }
  })

  it('gives every category at least one exercise to link to', () => {
    for (const category of CATEGORIES) {
      expect(
        category.exercises.length,
        `${category.id} has no exercises`,
      ).toBeGreaterThan(0)
    }
  })

  it('points each station at a built exercise, never a placeholder', () => {
    // Regression guard: Interval Training lists Hearing (planned) before
    // Reading (built), and linking to the first listed exercise made the
    // built one unreachable from the path.
    for (const category of CATEGORIES) {
      const built = category.exercises.filter((exercise) => exercise.status === 'ready')
      if (built.length === 0) continue

      const reachesBuilt = built.some(
        (exercise) => categoryPath(category) === `/train/${category.id}/${exercise.id}`,
      )
      expect(reachesBuilt, `${category.id} links to an unbuilt exercise`).toBe(true)
    }
  })
})
