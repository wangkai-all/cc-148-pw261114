import type { GridCell } from './model';

export type CapacityMode = 'demand' | 'allocated';

export interface RampStep {
  min: number;
  color: string;
  onDark: boolean;
}

/** Sequential blue ramp for occupancy ratio. Dark mode flips the anchor through CSS vars. */
export const RAMP: RampStep[] = [
  { min: 0, color: 'var(--seq-1)', onDark: false },
  { min: 0.25, color: 'var(--seq-2)', onDark: false },
  { min: 0.5, color: 'var(--seq-3)', onDark: false },
  { min: 0.75, color: 'var(--seq-4)', onDark: true },
  { min: 0.95, color: 'var(--seq-5)', onDark: true },
];

export function occupancyColor(cell: GridCell): { color: string; onDark: boolean } {
  if (cell.oversold > 0) return { color: 'var(--series-2)', onDark: true };
  const ratio = cell.capacity === 0 ? 0 : cell.demandRooms / cell.capacity;
  let step = RAMP[0];
  for (const candidate of RAMP) {
    if (ratio >= candidate.min) step = candidate;
  }
  return { color: step.color, onDark: step.onDark };
}

export function modeValue(cell: GridCell, mode: CapacityMode): { booked: number; sellable: number } {
  const booked = mode === 'demand' ? cell.demandRooms : cell.allocatedRooms;
  return { booked, sellable: Math.max(0, cell.capacity - booked) };
}

export function heatLegendText(): string {
  return '入住率：浅 → 深；橙色为超售';
}

export const WEEKDAY_ORDER = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export function percentText(value: number): string {
  return `${Math.round(value * 100)}%`;
}
