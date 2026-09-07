/**
 * The instruments melina can play notes with.
 *
 * Sampled, not synthesised: ear training is about timbre as much as pitch,
 * and a sine wave teaches you to recognise a sine wave. Both of these are
 * real recordings — a Steinway with four velocity layers, and an orchestral
 * harp from the MusyngKite soundfont, which is the better sounding of the two
 * General MIDI kits smplr offers.
 */

export type InstrumentId = 'piano' | 'harp'

export interface InstrumentDef {
  id: InstrumentId
  label: string
  hint: string
  /** Trimmed so no instrument is conspicuously louder than another. */
  gain: number
  /** Seconds a single note sounds for. */
  duration: number
}

export const INSTRUMENTS: readonly InstrumentDef[] = [
  {
    id: 'piano',
    label: 'Piano',
    hint: 'Steinway grand, four velocity layers.',
    gain: 1,
    duration: 1.9,
  },
  {
    id: 'harp',
    label: 'Harp',
    hint: 'Orchestral harp. Clearer attack, longer decay.',
    gain: 1.15,
    duration: 2.4,
  },
]

export const DEFAULT_INSTRUMENT: InstrumentId = 'piano'

export function getInstrument(id: InstrumentId): InstrumentDef {
  const instrument = INSTRUMENTS.find((entry) => entry.id === id)
  if (instrument === undefined) throw new Error(`unknown instrument: ${id}`)
  return instrument
}

export function isInstrumentId(value: string): value is InstrumentId {
  return INSTRUMENTS.some((instrument) => instrument.id === value)
}
