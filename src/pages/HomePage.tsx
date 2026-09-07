import { useEffect } from 'react'

import { PathView } from '@/components/path/PathView'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { LAST_OPENED_AT, writeSetting } from '@/lib/db/settings'

export default function HomePage() {
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    void writeSetting(LAST_OPENED_AT, Date.now())
  }, [])

  return <PathView reducedMotion={reducedMotion} />
}
