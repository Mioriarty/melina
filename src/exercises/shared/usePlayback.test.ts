import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { InstrumentId } from '@/lib/audio/instruments'

import { usePlayback } from './usePlayback'

/**
 * Sounding a question, on its own.
 *
 * The awkward parts are all about time: samples take a while to arrive, a
 * player can change instrument while they are still coming, and a failure
 * must leave the round playable in silence rather than stuck.
 */

const silent = () => Promise.resolve()

const { loadInstrument, unlockAudio } = vi.hoisted(() => ({
  loadInstrument: vi.fn(() => Promise.resolve({})),
  unlockAudio: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/audio/engine', () => ({ loadInstrument, unlockAudio }))

beforeEach(() => {
  loadInstrument.mockReset().mockResolvedValue({})
  unlockAudio.mockReset().mockResolvedValue(undefined)
})

// No default for the instrument: a default parameter swallows an explicit
// `undefined`, which is precisely the case one test here needs.
function playback(
  sound: (id: InstrumentId) => Promise<void>,
  instrument: InstrumentId | undefined,
) {
  return renderHook(
    ({ id }: { id: InstrumentId | undefined }) => usePlayback(id, sound),
    { initialProps: { id: instrument } },
  )
}

describe('usePlayback', () => {
  it('knows nothing until something is played', () => {
    expect(playback(silent, 'piano').result.current.status).toBe('idle')
  })

  it('plays the question on the chosen instrument', async () => {
    const sound = vi.fn(() => Promise.resolve())
    const { result } = playback(sound, 'harp')

    act(() => result.current.play())

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(sound).toHaveBeenCalledWith('harp')
    // The context is started inside the gesture, which is the only time a
    // browser will allow it.
    expect(unlockAudio).toHaveBeenCalled()
  })

  it('says it is loading, but only while that might be true', async () => {
    let release = () => undefined as void
    const sound = vi.fn(() => new Promise<void>((resolve) => (release = resolve)))
    const { result } = playback(sound, 'piano')

    act(() => result.current.play())
    await waitFor(() => expect(result.current.status).toBe('loading'))

    act(() => release())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    // A replay of samples already in memory must not flash "loading" again.
    act(() => result.current.play())
    expect(result.current.status).toBe('ready')
  })

  it('goes quiet rather than stranding the round when playback fails', async () => {
    const { result } = playback(() => Promise.reject(new Error('offline')), 'piano')

    act(() => result.current.play())
    await waitFor(() => expect(result.current.status).toBe('failed'))
  })

  it('treats a different instrument as a different download', async () => {
    const { result, rerender } = playback(silent, 'piano')

    act(() => result.current.play())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    rerender({ id: 'harp' })
    // Derived from the tag rather than cleared by an effect, so it reads as
    // unknown immediately instead of after a correcting render.
    expect(result.current.status).toBe('idle')
  })

  it('ignores a download that lands after the instrument changed', async () => {
    let release = () => undefined as void
    const sound = vi.fn(() => new Promise<void>((resolve) => (release = resolve)))
    const { result, rerender } = playback(sound, 'piano')

    act(() => result.current.play())
    rerender({ id: 'harp' })
    act(() => release())

    // The piano finished loading; the harp still has not been touched.
    await waitFor(() => expect(result.current.status).toBe('idle'))
  })

  it('fetches the samples ahead of time when asked', async () => {
    const { result } = playback(silent, 'piano')

    act(() => result.current.preload())

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(loadInstrument).toHaveBeenCalledWith('piano')
  })

  it('does nothing at all when there is nothing to play', () => {
    const sound = vi.fn(() => Promise.resolve())
    const { result } = playback(sound, undefined)

    act(() => result.current.play())
    act(() => result.current.preload())

    expect(sound).not.toHaveBeenCalled()
    expect(loadInstrument).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })
})
