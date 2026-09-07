import { BrowserRouter, Route, Routes } from 'react-router'

import { AppShell } from '@/components/layout/AppShell'
import ExercisePage from '@/pages/ExercisePage'
import HomePage from '@/pages/HomePage'

export function App() {
  return (
    <BrowserRouter>
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
