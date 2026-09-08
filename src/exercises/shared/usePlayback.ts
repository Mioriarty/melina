import { useCallback, useState } from 'react'

import { loadInstrument, unlockAudio } from '@/lib/audio/engine'
import type { InstrumentId } from '@/lib/audio/instruments'

/**
 * Sounding whatever question is on screen.
 *
 * All four exercises need the same three things: samples that are fetched
 * once and shared, an AudioContext that browsers will only start inside a
 * user gesture, and a status to show while that is happening or when it has
 * failed. Only *when* they play differs — a hearing question sounds itself,
 * a reading one waits to be asked.
 */

export type PlaybackStatus = 'idle' | 'loading' | 'ready' | 'failed'

export interface PlaybackController {
  status: PlaybackStatus
  /**
   * Sound the current question. Safe to call before the samples exist — the
   * download is what `loading` is for — and safe to call from a click, which
   * is the gesture the AudioContext needs.
   */
  play: () => void
  /**
   * Fetch the samples without waiting for them, for an exercise that is
   * about to play by itself. Reading exercises deliberately do not: the
   * piano is tens of megabytes and most reading rounds never ask for it.
   */
  preload: () => void
}

/**
 * The status, tagged with the instrument it describes.
 *
 * Tagging rather than resetting is what makes switching instrument read as
 * "not loaded yet" during render instead of needing an effect to clear it —
 * and it means a download that lands after the switch cannot report the new
 * instrument as ready, because it is filed under the old one.
 */
interface Tagged {
  instrument: InstrumentId | undefined
  status: PlaybackStatus
}

export function usePlayback(
  instrument: InstrumentId | undefined,
  /** Plays the question currently on screen. `undefined` when there is none. */
  sound: ((instrument: InstrumentId) => Promise<void>) | undefined,
): PlaybackController {
  const [state, setState] = useState<Tagged>({ instrument: undefined, status: 'idle' })

  const status = state.instrument === instrument ? state.status : 'idle'

  const play = useCallback(() => {
    if (instrument === undefined || sound === undefined) return

    // Only announce a wait when there might be one: saying "loading" for a
    // few milliseconds on every replay is worse than saying nothing. Read
    // through the updater rather than from `status`, so this callback does
    // not change identity every time the status does — it is a dependency of
    // the effect that auto-plays a hearing question, which would replay it.
    setState((previous) =>
      previous.instrument === instrument && previous.status === 'ready'
        ? previous
        : { instrument, status: 'loading' },
    )

    void (async () => {
      try {
        await unlockAudio()
        await sound(instrument)
        setState({ instrument, status: 'ready' })
      } catch {
        // A failed download or a blocked context must not strand the round:
        // the notation is still there and the question can still be answered.
        setState({ instrument, status: 'failed' })
      }
    })()
  }, [instrument, sound])

  const preload = useCallback(() => {
    if (instrument === undefined) return

    loadInstrument(instrument)
      .then(() => setState({ instrument, status: 'ready' }))
      .catch(() => setState({ instrument, status: 'failed' }))
  }, [instrument])

  return { status, play, preload }
}
