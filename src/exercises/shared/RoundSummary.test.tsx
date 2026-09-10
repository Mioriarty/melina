import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { RoundSummary } from './RoundSummary'
import type { Answered } from './round'

/**
 * What just happened, and what to do about it.
 *
 * The summary is generic over what the exercise asks about, so this uses a
 * made-up subject: what is under test is the grouping and the ranking, which
 * is the only real logic on the screen and the part that decides what a
 * player is told to practise next.
 */

interface Question {
  subject: string
  clef: string
}

function answered(
  subject: string,
  chosen: string,
  clef = 'treble',
): Answered<Question, string> {
  return {
    question: { subject, clef },
    chosen,
    correct: subject === chosen,
    ms: 1000,
  }
}

function summary(answers: readonly Answered<Question, string>[], onPlayAgain = vi.fn()) {
  render(
    <MemoryRouter>
      <RoundSummary
        answers={answers}
        subjectKey={({ question }) => question.subject}
        subjectName={({ question }) => `the ${question.subject}`}
        answerName={({ chosen }) => `the ${chosen}`}
        chipTitle={({ question }) => `${question.subject} · ${question.clef}`}
        allCorrect="Nothing left to fix here."
        onPlayAgain={onPlayAgain}
        onChangeSettings={vi.fn()}
      />
    </MemoryRouter>,
  )
  return { onPlayAgain }
}

const workOn = () => within(screen.getByRole('list', { name: 'What to work on' }))

describe('RoundSummary', () => {
  it('states the score once', () => {
    summary([answered('a', 'a'), answered('b', 'b'), answered('c', 'x')])

    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('/ 3', { exact: false })).toBeTruthy()
    expect(screen.getByText('67%', { exact: false })).toBeTruthy()
  })

  it('groups the misses by what was asked, not by question', () => {
    // "You missed the diminished fifth three times" is a practice
    // instruction; three separate rows saying it once each are not.
    summary([answered('a', 'x'), answered('a', 'y'), answered('b', 'z')])

    expect(workOn().getByText('2×')).toBeTruthy()
    expect(workOn().getByText('1×')).toBeTruthy()
    expect(workOn().getByText('the a')).toBeTruthy()
  })

  it('lists what was answered instead, without repeating itself', () => {
    summary([answered('a', 'x'), answered('a', 'x'), answered('a', 'y')])

    // Twice the same wrong answer is one thing to learn, not two.
    expect(workOn().getByText('You answered the x, the y')).toBeTruthy()
  })

  it('ranks the worst first, since that is what to practise', () => {
    summary([
      answered('a', 'x'),
      answered('b', 'x'),
      answered('b', 'x'),
      answered('b', 'x'),
    ])

    const rows = workOn().getAllByRole('listitem')
    expect(within(rows[0] as HTMLElement).getByText('the b')).toBeTruthy()
    expect(within(rows[1] as HTMLElement).getByText('the a')).toBeTruthy()
  })

  it('says nothing about weaknesses when there were none', () => {
    summary([answered('a', 'a'), answered('b', 'b')])

    expect(screen.getByText('Nothing left to fix here.')).toBeTruthy()
    expect(screen.queryByText('What to work on')).toBeNull()
  })

  it('shows every question of the round, right or wrong', () => {
    summary([answered('a', 'a'), answered('b', 'x'), answered('c', 'c')])

    const chips = within(screen.getByRole('list', { name: 'This round' }))
    expect(chips.getAllByRole('listitem')).toHaveLength(3)
    // One chip per question, labelled by what was asked and titled with the
    // context it was asked in.
    expect(chips.getByText('a').getAttribute('title')).toBe('a · treble')
  })

  it('offers another round', () => {
    const { onPlayAgain } = summary([answered('a', 'a')])
    fireEvent.click(screen.getByRole('button', { name: /practise again/i }))
    expect(onPlayAgain).toHaveBeenCalledTimes(1)
  })

  it('survives a round that was quit before anything was answered', () => {
    summary([])
    expect(screen.getByText('0%', { exact: false })).toBeTruthy()
  })
})
