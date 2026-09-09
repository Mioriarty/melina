import { beforeEach, describe, expect, it, vi } from 'vitest'

import { pitch } from '@/lib/music/pitch'
import type { Rhythm } from '@/lib/music/rhythm'

/**
 * Stopping.
 *
 * The engine's one genuinely counter-intuitive property, and the reason a
 * sound used to outlive the question it belonged to. smplr registers a voice
 * only when its scheduler dispatches the note — a couple of hundred
 * milliseconds ahead — so `instrument.stop()` walks what has already begun and
 * silences exactly that. Everything further out is still sitting in a queue and
 * fires on time regardless: the rest of a scale, the second note of a melodic
 * interval, a whole bar of drums waiting behind the count-in.
 *
 * So these tests assert on the stop function each `start` hands back, which is
 * the only handle that reaches a note that has not been dispatched yet.
 * Asserting that "playback stopped" through `instrument.stop` would have passed
 * on the broken version.
 */

interface FakeNote {
  note: number | string
  time: number
  stop: ReturnType<typeof vi.fn>
}

/** Every note handed to the instruments this test file has faked. */
let notes: FakeNote[] = []
let stopAll: ReturnType<typeof vi.fn>

function fakeInstrument() {
  return {
    ready: Promise.resolve(),
    output: { volume: 0 },
    stop: stopAll,
    start: (event: { note: number | string; time: number }) => {
      const stop = vi.fn()
      notes.push({ note: event.note, time: event.time, stop })
      return stop
    },
  }
}

vi.mock('smplr', () => ({
  SplendidGrandPiano: () => fakeInstrument(),
  DrumMachine: () => fakeInstrument(),
  Soundfont: () => fakeInstrument(),
}))

/** Enough of an AudioContext for scheduling; nothing here makes a sound. */
class FakeAudioContext {
  state = 'running'
  currentTime = 0
  resume = () => Promise.resolve()
}

/**
 * A fresh copy of the engine per test: it keeps the loaded instruments and the
 * list of pending notes at module scope, which is what makes one shared piano
 * possible in the first place.
 */
async function engine() {
  vi.resetModules()
  notes = []
  stopAll = vi.fn()
  vi.stubGlobal('AudioContext', FakeAudioContext)
  return import('./engine')
}

const pending = () => notes.every((note) => note.stop.mock.calls.length > 0)

beforeEach(() => {
  vi.unstubAllGlobals()
})

const C4 = pitch('C', 0, 4)
const D4 = pitch('D', 0, 4)
const E4 = pitch('E', 0, 4)

describe('stopPlayback', () => {
  it('drops the notes that have not sounded yet, not only the ones that have', async () => {
    const { playScale, stopPlayback } = await engine()

    await playScale([C4, D4, E4])
    // Spread across time — the whole point. If they were simultaneous there
    // would be nothing queued to leak.
    expect(notes).toHaveLength(3)
    expect(notes[2]?.time).toBeGreaterThan(notes[0]?.time ?? 0)

    stopPlayback()

    expect(pending()).toBe(true)
  })

  it('cancels the count-in and the bar behind it', async () => {
    const rhythm: Rhythm = { meter: { beats: 4, unit: 4 }, onsets: [0, 240, 480, 720] }
    const { playRhythm, stopPlayback } = await engine()

    await playRhythm(rhythm, { tempo: 90, metronome: 'count-in' })
    // Four clicks and four hits: the hits are a whole bar out, which is
    // exactly the sound that used to play on into the next question.
    expect(notes.length).toBeGreaterThan(4)

    stopPlayback()

    expect(pending()).toBe(true)
  })

  it('leaves nothing to stop twice', async () => {
    const { playScale, stopPlayback } = await engine()

    await playScale([C4, D4, E4])
    stopPlayback()
    stopPlayback()

    for (const note of notes) expect(note.stop).toHaveBeenCalledTimes(1)
  })

  it('is quiet when nothing has ever played', async () => {
    const { stopPlayback } = await engine()

    expect(() => stopPlayback()).not.toThrow()
  })
})

describe('replaying', () => {
  it('cuts off the previous take rather than stacking on it', async () => {
    const { playScale } = await engine()

    await playScale([C4, D4, E4])
    const first = [...notes]

    await playScale([C4, D4, E4])

    // Everything from the first take is cancelled, and the replay itself is
    // left intact — stopping after scheduling would silence the new one.
    for (const note of first) expect(note.stop).toHaveBeenCalled()
    for (const note of notes.slice(first.length)) expect(note.stop).not.toHaveBeenCalled()
  })

  it('silences a piano when a drum takes over', async () => {
    // One list across both instruments: nothing wants a scale and a rhythm at
    // once, and an exercise that switches has no way to know what was playing.
    const { playScale, playRhythm } = await engine()

    await playScale([C4, D4, E4])
    const scale = [...notes]

    await playRhythm(
      { meter: { beats: 4, unit: 4 }, onsets: [0] },
      { tempo: 90, metronome: 'count-in' },
    )

    for (const note of scale) expect(note.stop).toHaveBeenCalled()
  })
})
