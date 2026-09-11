import { useTranslation } from 'react-i18next'

import { useMusicNames } from '@/hooks/useMusicNames'
import { CHORD_QUALITIES } from '@/lib/music/chord'

import { chordSummaries } from './chordSeries'
import { degreeShorthand } from './modeSeries'

/**
 * The nine qualities side by side.
 *
 * **Computed from `chord.ts`** — see `chordSeries.ts`. The thirds a chord is
 * stacked from are measured off its own spelled notes rather than tabulated,
 * so the table and the chord can never come to disagree; and the members
 * against the major scale use the modes guide's own shorthand, because it is
 * the same fact said the same way.
 *
 * The thirds are listed as **interval names rather than as a sentence**, for
 * the reason `ModeTable` gives: "a major third with a minor third on top"
 * inflects in German and would need grammar this file has no business knowing,
 * and `locales.test.ts` can hold two languages to the same placeholders but
 * cannot tell that a translator broke a sentence assembled from parts.
 */
export function ChordTable() {
  const { t } = useTranslation('guide')
  const names = useMusicNames()

  const rows = chordSummaries()

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-rule text-ink-faint">
            <th scope="col" className="py-2 pr-3 font-medium">
              {t('chords.table.chord')}
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              {t('chords.table.members')}
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              {t('chords.table.thirds')}
            </th>
            <th scope="col" className="py-2 font-medium">
              {t('chords.table.inversions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-rule/60 align-baseline">
              <th scope="row" className="py-2.5 pr-3 font-semibold text-ink">
                {names.chordQuality(row.id)}
              </th>
              <td className="tabular py-2.5 pr-3 whitespace-nowrap text-ink-muted">
                {row.degrees.map(degreeShorthand).join(' ')}
              </td>
              <td className="py-2.5 pr-3 text-ink-muted">
                {row.thirds.map((third) => names.interval(third)).join(t('chords.plus'))}
              </td>
              <td className="py-2.5 text-ink-muted">
                {/* A symmetric chord has inversions on the page and none an ear
                    can find, so what this column says is what it is honest to
                    ask for — which is the rule `hearableInversions` enforces. */}
                {row.symmetric
                  ? t('chords.table.symmetric')
                  : t('chords.table.count', { count: row.size })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sr-only">
        {t('chords.table.summary', { count: CHORD_QUALITIES.length })}
      </p>
    </div>
  )
}
