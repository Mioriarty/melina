import { describe, expect, it } from 'vitest'

import { CATEGORIES, categoryBlurbKey, categoryTitleKey } from '@/config/curriculum'
import { INSTRUMENTS } from '@/lib/audio/instruments'
import { i18n } from '@/lib/i18n'
import { DEFAULT_LANGUAGE, LANGUAGES } from '@/lib/i18n/languages'
import { CATALOG } from '@/lib/music/catalog'
import { CLEFS } from '@/lib/music/clef'
import { PLAY_DIRECTIONS } from '@/lib/music/direction'
import { KEY_SIGNATURES } from '@/lib/music/keySignature'
import { LETTERS } from '@/lib/music/pitch'

import { NAMESPACES, RESOURCES, type Namespace } from '.'

/**
 * The guard that makes adding a language safe.
 *
 * A missing key does not crash — i18next quietly falls back to English, or
 * prints the key itself — so nothing else in the suite would catch a
 * half-translated app. This walks the whole tree and insists every language
 * says exactly the same things, and then checks that the keys the code builds
 * at runtime from registry ids actually resolve.
 */

type Tree = { [key: string]: string | Tree }

/** Every leaf path in a namespace, as dotted keys. */
function leaves(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`
    return typeof value === 'string' ? [path] : leaves(value, path)
  })
}

/** Placeholders a string interpolates, so a translation cannot drop one. */
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1] ?? '').sort()
}

function bundle(language: string, namespace: Namespace): Tree {
  return RESOURCES[language as keyof typeof RESOURCES][namespace] as unknown as Tree
}

const OTHERS = LANGUAGES.filter((language) => language.id !== DEFAULT_LANGUAGE)

describe.each(NAMESPACES)('%s namespace', (namespace) => {
  const reference = leaves(bundle(DEFAULT_LANGUAGE, namespace)).sort()

  it('has keys at all', () => {
    expect(reference.length).toBeGreaterThan(0)
  })

  it.each(OTHERS)('is fully translated into $label', ({ id }) => {
    expect(leaves(bundle(id, namespace)).sort()).toEqual(reference)
  })

  it.each(OTHERS)('keeps every placeholder in $label', ({ id }) => {
    const source = i18n.getFixedT(DEFAULT_LANGUAGE, namespace)
    const target = i18n.getFixedT(id, namespace)

    for (const key of reference) {
      // A dropped `{{count}}` is a sentence with a hole in it that no type
      // checker and no render test will notice.
      expect(placeholders(target(key)), `${id}: ${key}`).toEqual(
        placeholders(source(key)),
      )
    }
  })
})

describe('keys built from registry ids', () => {
  it.each(LANGUAGES)('names every category and exercise in $label', ({ id }) => {
    const t = i18n.getFixedT(id)

    for (const category of CATEGORIES) {
      for (const key of [categoryTitleKey(category.id), categoryBlurbKey(category.id)]) {
        expect(t(key), key).not.toBe(key)
      }

      for (const exercise of category.exercises) {
        const base = `curriculum:categories.${category.id}.exercises.${exercise.id}`
        expect(t(`${base}.title`), `${id}: ${base}.title`).not.toBe(`${base}.title`)
        expect(t(`${base}.blurb`), `${id}: ${base}.blurb`).not.toBe(`${base}.blurb`)
      }
    }
  })

  it.each(LANGUAGES)('names every musical thing in $label', ({ id }) => {
    const t = i18n.getFixedT(id, 'music')
    const named = (key: string) => {
      expect(t(key), `${id}: ${key}`).not.toBe(key)
      expect(t(key).length, `${id}: ${key}`).toBeGreaterThan(0)
    }

    for (const clef of CLEFS) {
      named(`clefs.${clef.id}.label`)
      named(`clefs.${clef.id}.spoken`)
    }
    for (const signature of KEY_SIGNATURES) {
      named(`keySignatures.${signature.id}.major`)
      named(`keySignatures.${signature.id}.minor`)
      named(`keySignatures.${signature.id}.majorName`)
      named(`keySignatures.${signature.id}.minorName`)
    }
    for (const direction of PLAY_DIRECTIONS) {
      named(`directions.${direction}.label`)
      named(`directions.${direction}.hint`)
    }
    for (const instrument of INSTRUMENTS) {
      named(`instruments.${instrument.id}.label`)
      named(`instruments.${instrument.id}.hint`)
    }
    for (const interval of CATALOG) {
      named(`qualities.${interval.quality}`)
      named(`qualitiesShort.${interval.quality}`)
      named(`qualitiesInName.${interval.quality}`)
      named(`ordinals.${interval.number}`)
      named(`ordinalsInName.${interval.number}`)
    }
    for (const letter of LETTERS) named(`pitch.letters.${letter}`)
  })
})
