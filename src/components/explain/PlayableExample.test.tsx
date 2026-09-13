import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PlayableExample } from './PlayableExample'

/**
 * A guide's engraved example, which is also a play button.
 *
 * The two things it has to get right are both invisible to a type checker.
 * The button has to carry a **name of its own** — a `role="img"` inside it is
 * what the staff shows, and on its own that says nothing about pressing — and
 * a failure has to leave the example **on the page**, unpressable rather than
 * gone, exactly as a round stays answerable in silence.
 */
const { unlockAudio } = vi.hoisted(() => ({ unlockAudio: vi.fn() }))

vi.mock('@/lib/audio/engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/audio/engine')>()),
  unlockAudio,
  stopPlayback: () => undefined,
}))

function example(sound: () => Promise<void>) {
  render(
    <PlayableExample sound={sound} label="C major triad: C, E, G">
      <div role="img" aria-label="C major triad: C, E, G" />
    </PlayableExample>,
  )
  return screen.getByRole('button')
}

describe('an example that can be heard', () => {
  it('says what it shows and what pressing it does', () => {
    unlockAudio.mockResolvedValue(undefined)
    const button = example(() => Promise.resolve())

    // Both halves in one name. A button takes its name from its own label
    // rather than from the image inside it, so without this the staff would
    // be announced with no hint that it is pressable at all.
    const name = button.getAttribute('aria-label') ?? ''
    expect(name).toContain('C major triad')
    expect(name).not.toBe('C major triad: C, E, G')
  })

  it('sounds the example, through the gesture the AudioContext needs', async () => {
    unlockAudio.mockResolvedValue(undefined)
    const sound = vi.fn(() => Promise.resolve())

    fireEvent.click(example(sound))

    await waitFor(() => expect(sound).toHaveBeenCalledTimes(1))
    expect(unlockAudio).toHaveBeenCalled()
  })

  it('stays on the page when playback fails, and stops offering itself', async () => {
    unlockAudio.mockRejectedValue(new Error('no audio'))
    const button = example(() => Promise.resolve())

    fireEvent.click(button)

    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(true))
    // The notation is the point of the page; only the offer to play it goes.
    expect(screen.getByRole('img')).toBeTruthy()
  })
})
