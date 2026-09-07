import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { DEFAULT_NAMESPACE, NAMESPACES, RESOURCES } from '@/locales'

import { DEFAULT_LANGUAGE, preferredLanguage, type LanguageId } from './languages'

/**
 * i18next, initialised as a module side effect.
 *
 * Everything that renders text imports this module (directly or through
 * `App`), so the instance is always ready by the time a component asks for a
 * string — there is no loading state and no `Suspense` boundary to get wrong.
 * Translations are bundled, not fetched, so this is synchronous.
 *
 * The starting language is whatever the browser asks for. A language the
 * player has actually chosen lives in IndexedDB and is applied over the top
 * by `useLanguage`, which cannot run until React has mounted.
 */
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: RESOURCES,
    lng: preferredLanguage(
      typeof navigator === 'undefined' ? [] : [...navigator.languages],
    ),
    fallbackLng: DEFAULT_LANGUAGE,
    ns: [...NAMESPACES],
    defaultNS: DEFAULT_NAMESPACE,
    // React escapes everything it renders already; escaping here as well
    // turns an apostrophe into `&#39;` on screen.
    interpolation: { escapeValue: false },
    returnNull: false,
  })
}

export { i18n }

/**
 * Switch language and tell the document about it, so a screen reader changes
 * voice and the browser hyphenates with the right rules.
 */
export async function applyLanguage(language: LanguageId): Promise<void> {
  if (i18n.language !== language) await i18n.changeLanguage(language)
  if (typeof document !== 'undefined') document.documentElement.lang = language
}
