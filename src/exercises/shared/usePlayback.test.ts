import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePlayback } from './usePlayback'

/**
 * Sounding a question, on its own.
 *
 * The awkward parts are all about time: the samples take a while to arrive,
 * a replay must not claim to be loading them again, and a failure has to
 * leave the round playable in silence rather than stuck.
 */

const silent = () => Promise.resolve()

const { loadInstrument, stopPlayback, unlockAudio } = vi.hoisted(() => ({
  loadInstrument: vi.fn(() => Promise.resolve({})),
  stopPlayback: vi.fn(),
  unlockAudio: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/audio/engine', () => ({ loadInstrument, stopPlayback, unlockAudio }))

beforeEach(() => {
  loadInstrument.mockReset().mockResolvedValue({})
  stopPlayback.mockReset()
  unlockAudio.mockReset().mockResolvedValue(undefined)
})

function playback(sound: (() => Promise<void>) | undefined) {
  return renderHook(() => usePlayback(sound))
}

describe('usePlayback', () => {
  it('knows nothing until something is played', () => {
    expect(playback(silent).result.current.status).toBe('idle')
  })

  it('plays the question, on the one instrument there is', async () => {
    const sound = vi.fn(() => Promise.resolve())
    const { result } = playback(sound)

    act(() => result.current.play())

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(sound).toHaveBeenCalled()
    // The context is started inside the gesture, which is the only time a
    // browser will allow it.
    expect(unlockAudio).toHaveBeenCalled()
  })

  it('says it is loading, but only while that might be true', async () => {
    let release = () => undefined as void
    const sound = vi.fn(() => new Promise<void>((resolve) => (release = resolve)))
    const { result } = playback(sound)

    act(() => result.current.play())
    await waitFor(() => expect(result.current.status).toBe('loading'))

    act(() => release())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    // A replay of samples already in memory must not flash "loading" again.
    act(() => result.current.play())
    expect(result.current.status).toBe('ready')
  })

  it('goes quiet rather than stranding the round when playback fails', async () => {
    const { result } = playback(() => Promise.reject(new Error('offline')))

    act(() => result.current.play())
    await waitFor(() => expect(result.current.status).toBe('failed'))
  })

  it('fetches the samples ahead of time when asked', async () => {
    const { result } = playback(silent)

    act(() => result.current.preload())

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(loadInstrument).toHaveBeenCalled()
  })

  it('fetches whatever instrument it was given, not always the piano', async () => {
    // Rhythmic dictation plays a snare. Without this it would quietly pull down
    // tens of megabytes of piano to do it — which is the exact cost the reading
    // exercises avoid by not preloading at all.
    const drums = vi.fn(() => Promise.resolve({}))
    const { result } = renderHook(() => usePlayback(silent, drums))

    act(() => result.current.preload())

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(drums).toHaveBeenCalled()
    expect(loadInstrument).not.toHaveBeenCalled()
  })

  it('silences what is playing in the press itself, not once it is ready', () => {
    // The press has to take effect now. Waiting for the new sound to be
    // scheduled means a first press, with the samples still downloading,
    // leaves the old one playing for as long as the download takes.
    const { result } = playback(() => new Promise<void>(() => undefined))

    act(() => result.current.play())

    expect(stopPlayback).toHaveBeenCalled()
  })

  it('stops when the question changes', () => {
    const { rerender } = renderHook(({ sound }) => usePlayback(sound), {
      initialProps: { sound: () => Promise.resolve() },
    })
    expect(stopPlayback).not.toHaveBeenCalled()

    // A new question is a new `sound`. A scale runs for nearly three seconds
    // and a counted-in rhythm rather longer, so without this the last one
    // plays on underneath the next.
    rerender({ sound: () => Promise.resolve() })

    expect(stopPlayback).toHaveBeenCalled()
  })

  it('stops when the exercise goes away', () => {
    const { unmount } = playback(silent)
    expect(stopPlayback).not.toHaveBeenCalled()

    // Navigating off the page; the summary and the levels screen arrive here
    // too, by way of `sound` becoming undefined.
    unmount()

    expect(stopPlayback).toHaveBeenCalled()
  })

  it('does nothing at all when there is no question to play', () => {
    const { result } = playback(undefined)

    act(() => result.current.play())

    expect(result.current.status).toBe('idle')
  })
})
