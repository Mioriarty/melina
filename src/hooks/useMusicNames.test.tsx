import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'

import { useMusicNames } from './useMusicNames'

// Only this file drives a React update from outside `render` — switching
// language while a component is mounted — so only this file needs React to
// accept a hand-written `act`.
const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true

function names() {
  return renderHook(() => useMusicNames()).result
}

// The shared setup resets to English before each test, but a language change
// made here would otherwise leak into whatever runs next in this file.
afterEach(async () => {
  // Still mounted at this point, so the re-render it triggers has to be
  // act-wrapped like any other.
  await act(async () => {
    await i18n.changeLanguage('en')
  })
})

describe('useMusicNames', () => {
  it('names an interval in English', () => {
    const { current } = names()
    expect(current.interval({ number: 5, quality: 'perfect' })).toBe('Perfect fifth')
    expect(current.interval({ number: 3, quality: 'diminished' })).toBe(
      'Diminished third',
    )
    expect(current.interval({ number: 1, quality: 'perfect' })).toBe('Perfect unison')
  })

  it('inflects the quality in German rather than gluing English parts together', async () => {
    const { result } = renderHook(() => useMusicNames())
    await act(async () => {
      await i18n.changeLanguage('de')
    })

    // "Rein Quinte" would be the concatenation; "reine Quinte" is the term.
    expect(result.current.interval({ number: 5, quality: 'perfect' })).toBe(
      'reine Quinte',
    )
    expect(result.current.interval({ number: 3, quality: 'minor' })).toBe('kleine Terz')
    // Standalone, on a keyboard key, the quality is not inflected.
    expect(result.current.quality('perfect')).toBe('Rein')
  })

  it('uses each language’s own note names', async () => {
    const { result } = renderHook(() => useMusicNames())

    // B♭ major is "B-Dur" in German, and the note English calls B is H.
    expect(result.current.keyMajorName('2f')).toBe('B♭ major')
    expect(result.current.pitchSpoken({ letter: 'B', alteration: 0, octave: 4 })).toBe(
      'B 4',
    )

    await act(async () => {
      await i18n.changeLanguage('de')
    })

    expect(result.current.keyMajorName('2f')).toBe('B-Dur')
    expect(result.current.pitchSpoken({ letter: 'B', alteration: 0, octave: 4 })).toBe(
      'H 4',
    )
  })

  it('falls back for an interval number the ordinals do not cover', () => {
    const { current } = names()
    expect(current.number(20)).toBe('20th')
  })
})
