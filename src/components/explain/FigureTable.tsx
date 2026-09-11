import { useTranslation } from 'react-i18next'

import { useMusicNames } from '@/hooks/useMusicNames'
import { expandFigure, figurePitches, parseFigureKey } from '@/lib/music/figuredBass'
import { alterationInKey } from '@/lib/music/keySignature'
import type { KeySignatureId } from '@/lib/music/keySignature'
import { pitch, type Letter } from '@/lib/music/pitch'
import { tonicKey } from '@/lib/music/scale'
import { figureText, signText } from '@/lib/notation/figureNotation'

/**
 * Every figure the app teaches, and what each one resolves to.
 *
 * **Computed from `figuredBass.ts`, never authored.** A page describing a model
 * can go stale; this one cannot, because the intervals and the notes in it are
 * the model evaluated — the same reason `contourSeries.ts` exists for the
 * melodic shape guide. If the rules of omission change, the table changes with
 * them, and it can never come to describe something the app no longer grades.
 *
 * The only thing written by hand is which bass each figure is *shown* over, and
 * that is an illustration rather than a rule: a 6 is a 6 wherever it stands, but
 * shown over E in C major it is the chord a reader actually meets.
 */

/**
 * Figure, and the bass and key it reads most naturally over.
 *
 * **The key belongs to the row, not to the table.** A flattened third only says
 * anything where the key gives a sharp one — `♭` over A in C major is a C flat,
 * which is correct arithmetic and a chord nobody has ever written — so it is
 * shown in G major, where it turns D major into D minor and is the reason the
 * sign exists.
 */
const EXAMPLES: readonly { figure: string; bass: Letter; key: KeySignatureId }[] = [
  { figure: '', bass: 'C', key: '0' },
  { figure: '6', bass: 'E', key: '0' },
  { figure: '6/4', bass: 'G', key: '0' },
  { figure: '#3', bass: 'E', key: '0' },
  { figure: 'b3', bass: 'D', key: '1s' },
  { figure: '7', bass: 'G', key: '0' },
  { figure: '6/5', bass: 'B', key: '0' },
  { figure: '4/3', bass: 'D', key: '0' },
  { figure: '2', bass: 'F', key: '0' },
]

export function FigureTable() {
  const { t } = useTranslation('guide')
  const names = useMusicNames()

  const rows = EXAMPLES.flatMap(({ figure: written, bass: letter, key }) => {
    const figure = parseFigureKey(written)
    if (figure === undefined) return []

    const bass = pitch(letter, alterationInKey(letter, key), 3)
    const full = expandFigure(figure)
    const notes = figurePitches(bass, key, figure)
    if (full === undefined || notes === undefined) return []

    return [
      {
        id: written === '' ? 'plain' : written,
        // A plain triad is written by writing nothing, so its cell needs words.
        written: figureText(figure) === '' ? t('figures.none') : figureText(figure),
        means: full.signs.map(signText).join(' · '),
        over: t('figures.over', {
          bass: names.tonic(tonicKey(bass)),
          key: names.keyMajor(key),
        }),
        notes: notes.map((note) => names.tonic(tonicKey(note))).join(' '),
      },
    ]
  })

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[26rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-rule text-ink-faint">
            <th scope="col" className="py-2 pr-3 font-medium">
              {t('figures.columnWritten')}
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              {t('figures.columnMeans')}
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              {t('figures.columnOver')}
            </th>
            <th scope="col" className="py-2 font-medium">
              {t('figures.columnNotes')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-rule">
              <td className="py-2.5 pr-3 font-semibold text-ink">{row.written}</td>
              <td className="tabular py-2.5 pr-3 text-ink-muted">{row.means}</td>
              <td className="py-2.5 pr-3 whitespace-nowrap text-ink-muted">{row.over}</td>
              <td className="py-2.5 font-medium text-ink">{row.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
