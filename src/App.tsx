import { BrowserRouter, Route, Routes } from 'react-router'

import { AppShell } from '@/components/layout/AppShell'
import ExercisePage from '@/pages/ExercisePage'
import HomePage from '@/pages/HomePage'

// The production build is served from a subdirectory on GitHub Pages, so
// every route hangs off Vite's base rather than the origin root. In dev and
// under test BASE_URL is '/', which strips back to no basename at all.
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')

export function App() {
  return (
    <BrowserRouter basename={BASENAME}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
        </Route>

        {/* Exercises run without the header — they fill the screen and carry
            their own navigation. */}
        <Route element={<AppShell header={false} />}>
          <Route path="train/:categoryId/:exerciseId" element={<ExercisePage />} />
          <Route path="*" element={<ExercisePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
