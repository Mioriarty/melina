import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { readSetting, UI_LANGUAGE } from '@/lib/db/settings'
import { applyLanguage, i18n } from '@/lib/i18n'
import { preferredLanguage } from '@/lib/i18n/languages'

import { App } from './App'
import './styles/index.css'

const container = document.getElementById('root')
if (container === null) throw new Error('Root element #root is missing from index.html')

/**
 * Read the chosen language before the first paint.
 *
 * i18next already starts on the browser's own preference, so the app would
 * render correctly without this — but someone whose browser is German and
 * who chose English would watch it flip one frame in. Reading one row from
 * IndexedDB first costs a few milliseconds and removes that flash.
 */
async function start() {
  const chosen = await readSetting(UI_LANGUAGE)
  await applyLanguage(chosen ?? preferredLanguage([...navigator.languages]))
}

start()
  .catch(() => {
    // A blocked or broken IndexedDB must not stop the app from rendering;
    // the browser's language is a perfectly good fallback.
    document.documentElement.lang = i18n.language
  })
  .finally(() => {
    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
