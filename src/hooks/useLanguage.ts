import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { UI_LANGUAGE, useSetting, useSettingWriter } from '@/lib/db/settings'
import { applyLanguage } from '@/lib/i18n'
import { preferredLanguage, type LanguageId } from '@/lib/i18n/languages'

export interface Language {
  /** The language currently on screen. */
  current: LanguageId
  /** What the player picked, or `null` while the browser is still deciding. */
  chosen: LanguageId | null | undefined
  choose: (language: LanguageId) => void
}

/**
 * The interface language, and the one place it is changed.
 *
 * The choice lives in IndexedDB rather than in React state so it survives a
 * reload and follows the player to every screen. i18next is told about it
 * from an effect, which also means a change made in another tab arrives here
 * through Dexie's live query without any extra wiring.
 */
export function useLanguage(): Language {
  const { i18n } = useTranslation()
  const chosen = useSetting(UI_LANGUAGE)
  const write = useSettingWriter(UI_LANGUAGE)

  useEffect(() => {
    // `undefined` is "IndexedDB has not answered yet" — leave the browser's
    // guess in place rather than flipping the app to English and back.
    if (chosen === undefined) return
    void applyLanguage(chosen ?? preferredLanguage([...navigator.languages]))
  }, [chosen])

  const choose = useCallback(
    (language: LanguageId) => {
      write(language)
      void applyLanguage(language)
    },
    [write],
  )

  return { current: preferredLanguage([i18n.language]), chosen, choose }
}
