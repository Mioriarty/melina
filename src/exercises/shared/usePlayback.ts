import { useCallback, useEffect, useState } from 'react'

import { loadInstrument, stopPlayback, unlockAudio } from '@/lib/audio/engine'

/**
 * Sounding whatever question is on screen.
 *
 * All four exercises need the same three things: samples that are fetched
 * once and shared, an AudioContext that browsers will only start inside a
 * user gesture, and a status to show while that is happening or when it has
 * failed. Only *when* they play differs — a hearing question sounds itself,
 * a reading one waits to be asked.
 *
 * Nothing outlives the question it belongs to. A scale is nearly three
 * seconds long and a counted-in rhythm rather more, so answering, moving on,
 * quitting to the levels screen or leaving the exercise altogether all used
 * to walk away from a sound that carried on into whatever came next — and
 * then played underneath it. `sound` is bound to the question on screen, so
 * its identity changing *is* the question changing, and that is what this
 * hangs the silence on.
 */

export type PlaybackStatus = 'idle' | 'loading' | 'ready' | 'failed'

export interface PlaybackController {
  status: PlaybackStatus
  /**
   * Sound the current question. Safe to call before the samples exist — the
   * download is what `loading` is for — and safe to call from a click, which
   * is the gesture the AudioContext needs.
   *
   * Always allowed, even while something is still sounding: replaying is how
   * you listen again to the half you missed, and being made to wait out the
   * half you did hear is the opposite of that. It silences what is playing
   * first.
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

    // Silence the old sound in the gesture itself rather than waiting for the
    // new one to be scheduled: on the first press the samples may still be
    // downloading, and the press has to take effect now either way.
    stopPlayback()

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

  // Stop when the question changes, and when the exercise goes away — the
  // cleanup covers leaving for the summary, quitting to the levels screen and
  // navigating off the page, since all of them either rebind `sound` or
  // unmount. It runs before the effect that sounds a new question, because
  // this hook is called above that effect in the exercise's body.
  useEffect(() => stopPlayback, [sound])

  return { status, play, preload }
}
