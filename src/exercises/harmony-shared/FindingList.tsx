import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'
import { useMusicNames } from '@/hooks/useMusicNames'
import type { ChordMember } from '@/lib/music/chord'
import type { Finding } from '@/lib/music/voiceLeading'

import { findingLine, orderFindings } from './findingText'

/**
 * What went wrong, in words.
 *
 * **Text rather than marks on the staff**, and that is a choice worth stating.
 * A parallel fifth is a relation between two voices across two chords, which is
 * four noteheads and a claim about them; a bracket drawn round the four says
 * where to look and not what is wrong, and the name of the fault is the thing
 * the player has to learn. So each finding is a sentence naming the rule, the
 * voices and the chords, and the guide at `/guide/voice-leading` is where the
 * rule itself is explained.
 *
 * **Errors first, then warnings, and the difference is real.** Only an error
 * cost the answer; a warning is a place a line may well want to go, and a
 * marker weighs those rather than counting them. The glyph carries that as well
 * as the colour does, because a state a colour-blind player cannot see is not a
 * state.
 *
 * The list is capped. A setting that broke nine rules does not need nine lines
 * to say so — the first few are where the player should look, and a screen
 * given over to a wall of text is one where the staff has no room left.
 */

/**
 * How many lines are worth reading before the rest is just a count.
 *
 * Three, and the number is a layout fact as much as an editorial one: the space
 * this list takes is **reserved whether or not there is anything in it**, so
 * every line of it is a line the notation does not get. A setting that broke
 * nine rules does not need nine lines to say so.
 */
const SHOWN = 3

/**
 * The room kept for the list, full or empty.
 *
 * The rule the play caption under a staff already follows: its height is
 * reserved either way, so revealing an answer does not move the staff. Without
 * it the notation is `flex-1` and the findings take their height straight out
 * of it — the staff shrinks at the exact moment the player looks at it, which
 * is the failure the fixed page exists to prevent, arriving by another door.
 */
const RESERVED = 'min-h-[5.5rem]'

export interface FindingListProps {
  findings: readonly Finding[]
  /** The Lage the prompt named, given only when the setting did not open in it. */
  missedLage?: ChordMember | undefined
}

export function FindingList({ findings, missedLage }: FindingListProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const ordered = orderFindings(findings)
  const shown = ordered.slice(0, missedLage === undefined ? SHOWN : SHOWN - 1)
  const rest = ordered.length - shown.length

  return (
    <ul className={cn('flex w-full shrink-0 flex-col gap-1 text-left text-sm', RESERVED)}>
      {missedLage !== undefined && (
        <Line severity="error">
          {t('satb.findings.wrongLage', { lage: names.lage(missedLage) })}
        </Line>
      )}

      {shown.map((finding, index) => (
        <Line key={`${finding.id}-${finding.at}-${index}`} severity={finding.severity}>
          {findingLine(finding, (key, values) => t(key, values), names)}
        </Line>
      ))}

      {rest > 0 && (
        <li className="pl-6 text-ink-faint">
          {t('satb.findings.more', { count: rest })}
        </li>
      )}
    </ul>
  )
}

function Line({
  severity,
  children,
}: {
  severity: 'error' | 'warning'
  children: ReactNode
}) {
  return (
    <li
      className={
        severity === 'error'
          ? 'flex items-start gap-1.5 text-wrong'
          : 'flex items-start gap-1.5 text-ink-muted'
      }
    >
      <Icon
        name={severity === 'error' ? 'wrong' : 'alert'}
        size={16}
        className="mt-0.5 shrink-0"
      />
      <span>{children}</span>
    </li>
  )
}
