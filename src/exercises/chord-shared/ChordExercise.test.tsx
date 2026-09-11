import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import type { Answered } from '@/exercises/shared/round'
import { closeChord } from '@/lib/music/chord'
import { parseTonicKey, type PitchClass } from '@/lib/music/scale'

import ChordHearingExercise from '../chord-hearing/ChordHearingExercise'
import ChordReadingExercise from '../chord-reading/ChordReadingExercise'
import ChordWritingExercise from '../chord-writing/ChordWritingExercise'
import { WritingSummary } from '../chord-writing/WritingSummary'
import { ChordSummary } from './ChordSummary'
import type { ChordQuestion } from './generate'
import type { ChordAnswer } from './rules'

/**
 * Render smoke tests for all three chord exercises.
 *
 * A clean typecheck is not evidence that an exercise runs: everything is wired
 * through a registry, a settings table and a generic round machine, and any of
 * those joins can be wrong in a way only mounting the thing reveals.
 *
 * The engraver and the instrument are stubbed — one is 7 MB of WebAssembly and
 * the other wants an AudioContext jsdom does not have. Both are covered on
 * their own elsewhere.
 */
vi.mock('@/lib/notation/verovio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/notation/verovio')>()),
  preloadEngraver: () => undefined,
  renderMei: vi.fn(() => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"/>')),
}))

const playStruck = vi.fn(() => Promise.resolve())

vi.mock('@/lib/audio/engine', () => ({
  loadInstrument: vi.fn(() => Promise.resolve({})),
  playStruck: (...args: unknown[]) => playStruck(...(args as [])),
  stopPlayback: vi.fn(),
  unlockAudio: vi.fn(() => Promise.resolve()),
}))

const t = (key: string) => i18n.t(key)

function open(Exercise: () => React.ReactNode, path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Exercise />
    </MemoryRouter>,
  )
}

const level = (group: string, id: string) => t(`levels:${group}.${id}.title`)

function press(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

/** Every accessible name on the screen, which visible text alone misses. */
function labels(container: HTMLElement): string {
  return [...container.querySelectorAll('[aria-label]')]
    .map((element) => element.getAttribute('aria-label'))
    .join(' | ')
}

async function start(
  Exercise: () => React.ReactNode,
  path: string,
  group: string,
  id: string,
  prompt: string,
) {
  const view = open(Exercise, path)
  await screen.findByText(level(group, id))
  press(new RegExp(level(group, id)))
  await screen.findByText(prompt, { exact: false })
  return view
}

describe('reading chords', () => {
  it('opens on the levels, in runs, and starts a round in the same tap', async () => {
    open(ChordReadingExercise, '/train/chords/reading')

    // The list comes in runs rather than one flat ladder, and the headings are
    // what say so.
    await screen.findByText(level('chord-reading', 'major-minor'))
    expect(screen.getByText(t('levels:chord-reading.sections.triads'))).toBeTruthy()
    expect(screen.getByText(t('levels:chord-reading.sections.sevenths'))).toBeTruthy()

    press(new RegExp(level('chord-reading', 'major-minor')))
    await screen.findByText(t('exercise:chord.prompt.reading'))
    expect(screen.getByRole('progressbar')).toBeTruthy()
  })

  it('asks for the root, because here it can be seen', async () => {
    const { container } = await start(
      ChordReadingExercise,
      '/train/chords/reading',
      'chord-reading',
      'major-minor',
      t('exercise:chord.prompt.reading'),
    )

    expect(
      screen.getByRole('group', { name: t('exercise:chord.keyboard.root') }),
    ).toBeTruthy()
    expect(labels(container)).toContain(t('exercise:chord.keyboard.root'))
  })

  it('draws the chord from the start and answers when every row is filled', async () => {
    await start(
      ChordReadingExercise,
      '/train/chords/reading',
      'chord-reading',
      'major-minor',
      t('exercise:chord.prompt.reading'),
    )

    // Two rows in this level: a root and a quality. Neither on its own is an
    // answer, and the second completes it — there is no confirm key.
    press(new RegExp(`^${t('music:tonics.C')}$`))
    expect(screen.queryByText(t('exercise:round.next'))).toBeNull()

    press(new RegExp(t('music:chordQualities.major')))
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeTruthy()
    })
  })
})

describe('hearing chords', () => {
  it('never asks for the root, because there is nothing to hear it in', async () => {
    const { container } = await start(
      ChordHearingExercise,
      '/train/chords/hearing',
      'chord-hearing',
      'major-minor',
      t('exercise:chord.prompt.hearing'),
    )

    expect(
      screen.queryByRole('group', { name: t('exercise:chord.keyboard.root') }),
    ).toBeNull()
    expect(labels(container)).not.toContain(t('exercise:chord.keyboard.root'))
  })

  it('plays the chord by itself, without being asked', async () => {
    playStruck.mockClear()
    await start(
      ChordHearingExercise,
      '/train/chords/hearing',
      'chord-hearing',
      'major-minor',
      t('exercise:chord.prompt.hearing'),
    )
    await waitFor(() => expect(playStruck).toHaveBeenCalled())
  })
})

describe('writing chords', () => {
  it('names the chord in the prompt and gives the note keys', async () => {
    await start(
      ChordWritingExercise,
      '/train/chords/writing',
      'chord-writing',
      'major-minor',
      t('exercise:chord.prompt.writing').replace('{{chord}}', ''),
    )

    expect(
      screen.getByRole('group', { name: t('exercise:round.keyboardLabel.chord') }),
    ).toBeTruthy()
    // The accidental switches, including the second press that reaches a
    // double — a diminished seventh above C is B double flat.
    expect(
      screen.getByRole('button', { name: t('exercise:realizing.keyboard.sharp') }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: t('exercise:realizing.keyboard.flat') }),
    ).toBeTruthy()
  })
})

describe('every chord screen', () => {
  /**
   * **A string read by a shared screen may not name what only one exercise
   * asks about.** The scale exercises are held to the same rule against the
   * word "interval"; here the words that must not appear are the ones from the
   * exercise chords were built out of — a figure and a bass belong to
   * thoroughbass, and a chord exercise that mentioned them would be reusing a
   * string rather than having one.
   */
  const forbidden = /\bfigure|\bfigured bass|\bbezifferung/i

  it('never borrows a thoroughbass string', async () => {
    for (const [Exercise, path, group, prompt] of [
      [
        ChordReadingExercise,
        '/train/chords/reading',
        'chord-reading',
        t('exercise:chord.prompt.reading'),
      ],
      [
        ChordHearingExercise,
        '/train/chords/hearing',
        'chord-hearing',
        t('exercise:chord.prompt.hearing'),
      ],
    ] as const) {
      const { container, unmount } = await start(
        Exercise,
        path,
        group,
        'major-minor',
        prompt,
      )
      expect(container.textContent ?? '').not.toMatch(forbidden)
      expect(labels(container)).not.toMatch(forbidden)
      unmount()
    }
  })
})

/* --------------------------------------------------------------- summaries */

const C = parseTonicKey('C') as PitchClass

function missed(): ChordQuestion {
  return {
    chord: closeChord(C, 'half-diminished-seventh'),
    clef: 'treble',
    direction: 'harmonic',
    pitches: [],
    asks: { root: true, inversion: true, lage: false },
  }
}

describe('the chord summary', () => {
  it('groups a miss by quality and says what was said instead', () => {
    const chosen: ChordAnswer = {
      root: 'C',
      quality: 'diminished-seventh',
      inversion: 0,
      top: undefined,
    }
    const answers: Answered<ChordQuestion, ChordAnswer>[] = [
      { question: missed(), chosen, correct: false, ms: 900 },
    ]

    const { container } = render(
      <MemoryRouter>
        <ChordSummary
          answers={answers}
          onPlayAgain={() => undefined}
          onChangeSettings={() => undefined}
        />
      </MemoryRouter>,
    )

    // What was asked, and what was named instead — both in words, neither a
    // raw translation key.
    expect(container.textContent).toContain(
      t('music:chordQualities.half-diminished-seventh'),
    )
    expect(container.textContent).toContain(t('music:chordQualities.diminished-seventh'))
  })

  it('reads a written chord back as notes, because notes are what was written', () => {
    const answers: Answered<ChordQuestion, readonly PitchClass[]>[] = [
      {
        question: missed(),
        chosen: [C, parseTonicKey('E') as PitchClass, parseTonicKey('G') as PitchClass],
        correct: false,
        ms: 900,
      },
    ]

    const { container } = render(
      <MemoryRouter>
        <WritingSummary
          answers={answers}
          onPlayAgain={() => undefined}
          onChangeSettings={() => undefined}
        />
      </MemoryRouter>,
    )

    expect(container.textContent).toContain('C E G')
  })
})
