/**
 * The languages the interface is available in.
 *
 * Each is named in its own language: a chooser that says "German" is only
 * useful to someone who already reads English, which is exactly the person
 * who does not need the chooser.
 */
export type LanguageId = 'en' | 'de'

export interface LanguageDef {
  id: LanguageId
  /** Endonym — never translated. */
  label: string
}

export const LANGUAGES: readonly LanguageDef[] = [
  { id: 'en', label: 'English' },
  { id: 'de', label: 'Deutsch' },
]

export const DEFAULT_LANGUAGE: LanguageId = 'en'

export function isLanguageId(value: string): value is LanguageId {
  return LANGUAGES.some((language) => language.id === value)
}

/**
 * The best match for what the browser asks for, ignoring the region: a
 * `de-AT` reader gets German. Falls back to English when nothing matches.
 */
export function preferredLanguage(tags: readonly string[]): LanguageId {
  for (const tag of tags) {
    const base = tag.toLowerCase().split('-')[0]
    if (base !== undefined && isLanguageId(base)) return base
  }
  return DEFAULT_LANGUAGE
}
