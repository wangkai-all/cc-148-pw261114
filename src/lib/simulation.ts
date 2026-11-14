import type { Dataset } from './types';
import { buildModel, type Model } from './model';
import { mulberry32, percentile } from './rng';
import type { PageConfig } from './types';

export interface TrialResult {
  index: number;
  canceledBookingIds: string[];
  unplacedRooms: number;
  unplacedBookings: number;
  oversoldRoomNights: number;
  upgradeCost: number;
  allocatedRoomNights: number;
}

export interface MetricBand {
  mean: number;
  p10: number;
  p50: number;
  p90: number;
  min: number;
  max: number;
}

export interface SimulationResult {
  seed: number;
  cancelRate: number;
  trials: TrialResult[];
  bands: {
    unplacedRooms: MetricBand;
    unplacedBookings: MetricBand;
    oversoldRoomNights: MetricBand;
    upgradeCost: MetricBand;
  };
  /** Bookings eligible for sampling: no actual occupancy, not already cancelled at the observation point. */
  eligibleBookings: number;
  ineligibleBookings: number;
  histogram: { bucket: number; count: number; from: number; to: number }[];
  deterministic: {
    unplacedRooms: number;
    unplacedBookings: number;
    oversoldRoomNights: number;
    upgradeCost: number;
  };
  /** Trial index whose outcome is closest to the deterministic result (for tracing a realistic path). */
  representativeTrial: number | null;
}

function band(values: number[]): MetricBand {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    mean: sorted.reduce((s, v) => s + v, 0) / (sorted.length || 1),
    p10: percentile(sorted, 10),
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
  };
}

export function isCancelable(bookingDataset: Dataset, index: number, asOf: string): boolean {
  const booking = bookingDataset.bookings[index];
  if (!booking) return false;
  if (booking.cancelledAt) return false;
  if (booking.createdAt > asOf) return false;
  const hasActual = booking.segments.some(
    (s) =>
      (s.actualArrival || s.actualDeparture || s.actualRoomTypeId) &&
      s.actualRecordedAt &&
      s.actualRecordedAt <= asOf,
  );
  return !hasActual;
}

export function runSimulation(
  dataset: Dataset,
  config: PageConfig,
  asOf: string,
  deterministic: Model,
): SimulationResult {
  const { cancelRate, seed, trials } = config.simulation;
  const trialCount = Math.max(0, Math.min(2000, Math.round(trials)));
  const rate = Math.max(0, Math.min(1, cancelRate));
  const eligible: number[] = [];
  dataset.bookings.forEach((_, index) => {
    if (isCancelable(dataset, index, asOf)) eligible.push(index);
  });

  // Sampling order is fixed so the same seed and inputs reproduce the same stream.
  eligible.sort((a, b) => dataset.bookings[a].code.localeCompare(dataset.bookings[b].code));

  const results: TrialResult[] = [];
  let representative: { index: number; distance: number } | null = null;

  for (let trial = 0; trial < trialCount; trial++) {
    const rng = mulberry32((seed >>> 0) + trial * 0x9e3779b1);
    const canceled: number[] = [];
    for (const bookingIndex of eligible) {
      if (rng() < rate) canceled.push(bookingIndex);
    }
    const canceledSet = new Set(canceled);
    const sampled: Dataset = {
      ...dataset,
      bookings: dataset.bookings.filter((_, index) => !canceledSet.has(index)),
    };
    const model = buildModel(sampled, config, asOf, { validate: false });
    const result: TrialResult = {
      index: trial,
      canceledBookingIds: canceled.map((i) => dataset.bookings[i].id),
      unplacedRooms: model.summary.unplacedRooms,
      unplacedBookings: model.summary.unplacedBookings,
      oversoldRoomNights: model.summary.oversoldRoomNights,
      upgradeCost: model.summary.upgradeCost,
      allocatedRoomNights: model.summary.allocatedRoomNights,
    };
    results.push(result);
    const distance =
      Math.abs(result.unplacedRooms - deterministic.summary.unplacedRooms) +
      Math.abs(result.oversoldRoomNights - deterministic.summary.oversoldRoomNights) +
      Math.abs(result.upgradeCost - deterministic.summary.upgradeCost) / 100;
    if (!representative || distance < representative.distance) {
      representative = { index: trial, distance };
    }
  }

  const bands: SimulationResult['bands'] = {
    unplacedRooms: band(results.map((r) => r.unplacedRooms)),
    unplacedBookings: band(results.map((r) => r.unplacedBookings)),
    oversoldRoomNights: band(results.map((r) => r.oversoldRoomNights)),
    upgradeCost: band(results.map((r) => r.upgradeCost)),
  };

  const maxValue = Math.max(0, ...results.map((r) => r.unplacedRooms));
  // 小样本区间按每 1 间一档展示，避免出现只含单个取值的 "0–1" 桶。
  const bucketCount = Math.min(10, maxValue + 1);
  const bucketWidth = Math.max(1, Math.ceil(maxValue / bucketCount));
  const histogram: SimulationResult['histogram'] = [];
  for (let b = 0; b < bucketCount; b++) {
    histogram.push({ bucket: b, from: b * bucketWidth, to: (b + 1) * bucketWidth, count: 0 });
  }
  for (const r of results) {
    const b = Math.min(bucketCount - 1, Math.floor(r.unplacedRooms / bucketWidth));
    histogram[b].count++;
  }

  return {
    seed,
    cancelRate: rate,
    trials: results,
    bands,
    eligibleBookings: eligible.length,
    ineligibleBookings: dataset.bookings.length - eligible.length,
    histogram,
    deterministic: {
      unplacedRooms: deterministic.summary.unplacedRooms,
      unplacedBookings: deterministic.summary.unplacedBookings,
      oversoldRoomNights: deterministic.summary.oversoldRoomNights,
      upgradeCost: deterministic.summary.upgradeCost,
    },
    representativeTrial: representative?.index ?? null,
  };
}
