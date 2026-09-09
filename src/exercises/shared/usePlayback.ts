import { useCallback, useState } from 'react'

import { loadInstrument, unlockAudio } from '@/lib/audio/engine'

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

export function usePlayback(
  /** Plays the question currently on screen. `undefined` when there is none. */
  sound: (() => Promise<void>) | undefined,
  /**
   * What `preload` fetches.
   *
   * Defaults to the piano, which is what the pitched exercises play. Rhythmic
   * dictation passes the drum kit instead — without this it would quietly pull
   * down tens of megabytes of piano to play a snare, which is the whole reason
   * reading exercises do not preload at all.
   *
   * Must be a stable reference: `preload` is a dependency of the effect that
   * calls it, so an inline function would refetch on every render.
   */
  load: () => Promise<unknown> = loadInstrument,
): PlaybackController {
  const [status, setStatus] = useState<PlaybackStatus>('idle')

  const play = useCallback(() => {
    if (sound === undefined) return

    // Only announce a wait when there might be one: saying "loading" for a
    // few milliseconds on every replay is worse than saying nothing. Read
    // through the updater rather than from `status`, so this callback does
    // not change identity every time the status does — it is a dependency of
    // the effect that auto-plays a hearing question, which would replay it.
    setStatus((previous) => (previous === 'ready' ? previous : 'loading'))

    void (async () => {
      try {
        await unlockAudio()
        await sound()
        setStatus('ready')
      } catch {
        // A failed download or a blocked context must not strand the round:
        // the notation is still there and the question can still be answered.
        setStatus('failed')
      }
    })()
  }, [sound])

  const preload = useCallback(() => {
    load()
      .then(() => setStatus('ready'))
      .catch(() => setStatus('failed'))
  }, [load])

  return { status, play, preload }
}
