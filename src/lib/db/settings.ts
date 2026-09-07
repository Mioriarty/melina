import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback } from 'react'

import { db } from './schema'

/**
 * Typed accessors over the key/value settings table.
 *
 * Values arrive from IndexedDB as `unknown`; each setting declares a guard so
 * a stale or hand-edited row can never crash the UI — it falls back to the
 * default instead.
 */
export interface SettingSpec<T> {
  key: string
  fallback: T
  parse: (value: unknown) => T | undefined
}

export const LAST_CATEGORY: SettingSpec<string | null> = {
  key: 'lastCategoryId',
  fallback: null,
  parse: (value) => (typeof value === 'string' ? value : undefined),
}

export const LAST_OPENED_AT: SettingSpec<number | null> = {
  key: 'lastOpenedAt',
  fallback: null,
  parse: (value) => (typeof value === 'number' ? value : undefined),
}

export async function readSetting<T>(spec: SettingSpec<T>): Promise<T> {
  const row = await db.settings.get(spec.key)
  return (row === undefined ? undefined : spec.parse(row.value)) ?? spec.fallback
}

export async function writeSetting<T>(spec: SettingSpec<T>, value: T): Promise<void> {
  await db.settings.put({ key: spec.key, value })
}

/**
 * Read a setting reactively. Returns `undefined` on the very first render,
 * before IndexedDB has answered — callers should treat that as "not yet
 * known" rather than substituting the fallback, to avoid a visible flip.
 */
export function useSetting<T>(spec: SettingSpec<T>): T | undefined {
  return useLiveQuery(() => readSetting(spec), [spec.key])
}

export function useSettingWriter<T>(spec: SettingSpec<T>): (value: T) => void {
  return useCallback(
    (value: T) => {
      void writeSetting(spec, value)
    },
    [spec],
  )
}
