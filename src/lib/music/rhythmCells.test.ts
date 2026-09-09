import { describe, expect, it } from 'vitest'

import { TICKS_PER_BEAT } from './meter'
import { onsetsKey } from './rhythm'
import {
  CELL_GROUP_IDS,
  RHYTHM_CELLS,
  cellTicks,
  cellsInGroup,
  isTupletCell,
  startsSilent,
} from './rhythmCells'

describe('the cell vocabulary', () => {
  it('has a unique id for every cell', () => {
    const ids = RHYTHM_CELLS.map((cell) => cell.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('splits the beat into whole ticks', () => {
    // The reason TICKS_PER_BEAT is 60. A division that did not divide it would
    // put impacts on fractions and lose exact comparison.
    for (const cell of RHYTHM_CELLS) {
      expect(TICKS_PER_BEAT % cell.division, cell.id).toBe(0)
    }
  })

  it('keeps every attack in range and ascending', () => {
    for (const cell of RHYTHM_CELLS) {
      for (const [index, slot] of cell.attacks.entries()) {
        expect(Number.isInteger(slot), cell.id).toBe(true)
        expect(slot, cell.id).toBeGreaterThanOrEqual(0)
        expect(slot, cell.id).toBeLessThan(cell.division)
        if (index > 0)
          expect(slot, cell.id).toBeGreaterThan(cell.attacks[index - 1] as number)
      }
    }
  })

  it('never says the same thing twice', () => {
    // A duplicate would make one group quietly heavier than its weight claims.
    // `4/[0,2]` *is* `2/[0,1]`, so only one of them may be listed.
    const shapes = RHYTHM_CELLS.map((cell) => onsetsKey(cellTicks(cell, 0)))
    expect(new Set(shapes).size).toBe(shapes.length)
  })

  it('puts every cell in a group, and leaves no group empty', () => {
    for (const group of CELL_GROUP_IDS) {
      expect(cellsInGroup(group).length, group).toBeGreaterThan(0)
    }
  })
})

describe('cellTicks', () => {
  it('places a cell in whichever beat it is used in', () => {
    const triplet = RHYTHM_CELLS.find((cell) => cell.id === 'triplet')
    expect(cellTicks(triplet as never, 0)).toEqual([0, 20, 40])
    expect(cellTicks(triplet as never, 2)).toEqual([120, 140, 160])
  })
})

describe('isTupletCell', () => {
  it('is about the impacts, not the division they came from', () => {
    for (const cell of RHYTHM_CELLS) {
      const offGrid = cellTicks(cell, 0).some((tick) => tick % (TICKS_PER_BEAT / 4) !== 0)
      expect(isTupletCell(cell), cell.id).toBe(offGrid)
    }

    // The corollary worth stating: only these groups ever need a bracket.
    for (const cell of RHYTHM_CELLS) {
      if (isTupletCell(cell)) {
        expect(['triplet', 'quintuplet'], cell.id).toContain(cell.group)
      }
    }
  })
})

describe('startsSilent', () => {
  it('marks the cells that need something already sounding', () => {
    for (const cell of RHYTHM_CELLS) {
      expect(startsSilent(cell), cell.id).toBe(cell.attacks[0] !== 0)
    }
  })
})
