import Dexie from 'dexie'

import type { ClefId } from '@/lib/music/clef'
import type { PlayDirection } from '@/lib/music/direction'
import type { KeySignatureId } from '@/lib/music/keySignature'
import type { ModeId } from '@/lib/music/scale'

import { attemptFacets, type AttemptKind, type FacetValue } from './attemptQuestion'
import { db, type AttemptRow } from './schema'

/**
 * Reading the attempt log.
 *
 * One question is asked of it — *how accurate has practice been, on this sort
 * of question* — and everything here exists to let "this sort" be said
 * loosely. A filter names any subset of the dimensions an answered question
 * has; the ones it leaves out are unconstrained. `{}` is therefore every
 * answer ever given, `{ format: 'hearing' }` is everything heard rather than
 * read, `{ root: 'C' }` is every question built on a C, and a level's
 * settings turn into a filter that names all of them at once.
 *
 * This module knows nothing about intervals or scales. It matches against the
 * flat facets `attemptFacets` derives, so a third pair of exercises adds its
 * dimensions there and every query here keeps working.
 */

/** A filter value is one allowed value, or any of several. */
export type OneOrMany<T> = T | readonly T[]

/**
 * Which answers to count.
 *
 * Every field is optional and every field means *any of these*. A field the
 * filter does not mention is not constrained; a field an attempt does not
 * have — asking about `mode` while looking at an interval — excludes it,
 * which is what makes a filter naturally scope itself to one kind.
 */
export interface AttemptFilter {
  /** `intervals/hearing`. */
  exerciseId?: OneOrMany<string>
  /** The half of `exerciseId` before the slash: `intervals`, `scales`. */
  category?: OneOrMany<string>
  /** The half after it: `reading`, `hearing`. */
  format?: OneOrMany<string>
  kind?: OneOrMany<AttemptKind>
  correct?: boolean

  clef?: OneOrMany<ClefId>
  direction?: OneOrMany<PlayDirection>
  /**
   * The note the question was built on, without its octave: an interval's
   * lower note or a scale's tonic. The one dimension both kinds share, so
   * `{ root: 'Eb' }` spans every exercise.
   */
  root?: OneOrMany<string>
  /** True to count only questions whose notes need no ledger lines. */
  staffOnly?: boolean

  /** Interval questions only. */
  interval?: OneOrMany<string>
  keySignature?: OneOrMany<KeySignatureId>
  /** The lower note with its octave, e.g. `F#3`. */
  lower?: OneOrMany<string>
  /** The upper note with its octave. Derived, not stored. */
  upper?: OneOrMany<string>

  /** Scale questions only. */
  mode?: OneOrMany<ModeId>
  /** The tonic with its octave, e.g. `Bb3`. Use `root` to ignore the octave. */
  tonic?: OneOrMany<string>
}

/** How many recent matching answers an accuracy is measured over. */
export const ACCURACY_WINDOW = 100

export interface Accuracy {
  /** How many of the counted answers were right. */
  correct: number
  /** How many answers were counted; never more than the window. */
  total: number
  /**
   * `correct / total`, or `undefined` when nothing matched. Not practised is
   * not the same as nothing right, and a caller that renders 0% for a level
   * never attempted is telling the player something false.
   */
  rate: number | undefined
}

/**
 * How many matching answers there must be before an accuracy is worth
 * showing.
 *
 * Below this it is noise dressed as a measurement: four answers make 75% and
 * 100% one question apart, and a player reading that off a level would be
 * told something the log does not know. A level with too little history shows
 * nothing at all rather than a number with a caveat attached.
 */
export const ACCURACY_MINIMUM = 15

/** Whether there is enough history behind an accuracy to put it on screen. */
export function isReportable(value: Accuracy | undefined): boolean {
  return value !== undefined && value.total > ACCURACY_MINIMUM
}

const EMPTY: Accuracy = { correct: 0, total: 0, rate: undefined }

/**
 * The dimensions that come from the row rather than from the question.
 *
 * `category` and `format` are split out of the exercise id instead of being
 * stored, so they cannot disagree with it and a new exercise needs nothing
 * added here.
 */
function rowFacets(row: AttemptRow): Record<string, FacetValue> {
  const slash = row.exerciseId.indexOf('/')
  const [category, format] =
    slash === -1
      ? [row.exerciseId, '']
      : [row.exerciseId.slice(0, slash), row.exerciseId.slice(slash + 1)]

  return { exerciseId: row.exerciseId, category, format, correct: row.correct }
}

function allows(allowed: unknown, actual: FacetValue | undefined): boolean {
  if (actual === undefined) return false
  return Array.isArray(allowed)
    ? (allowed as readonly FacetValue[]).includes(actual)
    : allowed === actual
}

export function matchesFilter(row: AttemptRow, filter: AttemptFilter): boolean {
  const facets = { ...rowFacets(row), ...attemptFacets(row.question) }

  return Object.entries(filter).every(([dimension, allowed]) =>
    allowed === undefined ? true : allows(allowed, facets[dimension]),
  )
}

/**
 * A single value a filter pins a dimension to, if it pins it to exactly one.
 * Lets a query on one exercise walk that exercise's index instead of the log.
 */
function only(allowed: OneOrMany<string> | undefined): string | undefined {
  if (typeof allowed === 'string') return allowed
  return Array.isArray(allowed) && allowed.length === 1 ? allowed[0] : undefined
}

/**
 * Newest matching answers first, at most `limit` of them.
 *
 * Walks backwards through the log and stops as soon as the limit is reached,
 * so the usual case — the last hundred answers of one exercise — reads a
 * hundred rows however long the log has grown. A filter that pins the
 * exercise walks `[exerciseId+ts]`; anything broader walks `ts`.
 */
export async function matchingAttempts(
  filter: AttemptFilter = {},
  limit = ACCURACY_WINDOW,
): Promise<AttemptRow[]> {
  if (limit <= 0) return []

  const exerciseId = only(filter.exerciseId)
  const collection =
    exerciseId === undefined
      ? db.attempts.orderBy('ts')
      : db.attempts
          .where('[exerciseId+ts]')
          .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])

  const found: AttemptRow[] = []
  await collection
    .reverse()
    .until(() => found.length >= limit)
    .each((row) => {
      if (found.length < limit && matchesFilter(row, filter)) found.push(row)
    })

  return found
}

/**
 * How accurate the last `window` matching answers were.
 *
 * Bounded rather than lifetime, so the number reflects where the player is
 * now: a hundred answers ago is recent enough to be about them and long
 * enough not to swing on one unlucky round.
 */
export async function accuracy(
  filter: AttemptFilter = {},
  window = ACCURACY_WINDOW,
): Promise<Accuracy> {
  const attempts = await matchingAttempts(filter, window)
  if (attempts.length === 0) return EMPTY

  const correct = attempts.filter((row) => row.correct).length
  return { correct, total: attempts.length, rate: correct / attempts.length }
}
