import { useTranslation } from 'react-i18next'

import { useMusicNames } from '@/hooks/useMusicNames'
import { MODE_IDS } from '@/lib/music/scale'

import { degreeShorthand, modeSummaries } from './modeSeries'

/**
 * The shortcut: every mode as a small change to major or minor.
 *
 * **Computed from `scale.ts`** — see `modeSeries.ts`. "Lydian is major with an
 * augmented fourth" is not a mnemonic anyone wrote down here, it is the
 * difference between two rows of the model, and which of major and minor a
 * mode is read against is whichever is fewer changes away.
 *
 * The changed degrees are listed as **interval names rather than as a
 * sentence**. A sentence would have to be assembled from translated parts —
 * "minor with a raised sixth" inflects in German and would need grammar this
 * file has no business knowing — and `locales.test.ts` cannot catch a sentence
 * a translator broke. A list of names is the same fact with nothing to break.
 */
export function ModeTable() {
  const { t } = useTranslation('guide')
  const names = useMusicNames()

  const rows = modeSummaries()

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-rule text-ink-faint">
            <th scope="col" className="py-2 pr-3 font-medium">
              {t('modes.table.mode')}
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              {t('modes.table.degrees')}
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              {t('modes.table.sameAs')}
            </th>
            <th scope="col" className="py-2 font-medium">
              {t('modes.table.except')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-rule/60 align-baseline">
              <th scope="row" className="py-2.5 pr-3 font-semibold text-ink">
                {names.mode(row.id)}
              </th>
              <td className="tabular py-2.5 pr-3 whitespace-nowrap text-ink-muted">
                {row.degrees.map(degreeShorthand).join(' ')}
              </td>
              <td className="py-2.5 pr-3 text-ink-muted">
                {names.modeAlias(row.reference)}
              </td>
              <td className="py-2.5 text-ink-muted">
                {row.changes.length === 0
                  ? // Major and minor are the two everything else is read
                    // against, so there is nothing for them to differ from.
                    t('modes.table.itself')
                  : row.changes
                      .map((change) => names.interval(change.interval))
                      .join(t('modes.table.join'))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sr-only">{t('modes.table.summary', { count: MODE_IDS.length })}</p>
    </div>
  )
}
