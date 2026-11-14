import type { DateStr } from './date';
import {
  addDays,
  compareTimestamp,
  datesInRange,
  diffDays,
  isValidDateStr,
  isValidTimestamp,
  shortDate,
  timestampDate,
} from './date';
import type {
  Booking,
  BookingSegment,
  Dataset,
  PageConfig,
  PriorityCriterion,
  RoomType,
  Tier,
  UpgradeRule,
} from './types';
import { BLOCK_REASON_LABEL, CHANNEL_LABEL, CHANNEL_RANK, TIER_LABEL, TIER_RANK } from './types';

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface DataIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
  refs?: string[];
}

export interface ActiveBooking {
  booking: Booking;
  duplicateIds: string[];
  groupKey: string | null;
}

export interface NightSlice {
  date: DateStr;
  roomTypeId: string;
  rooms: number;
}

export interface SegmentResolveResult {
  segment: BookingSegment;
  plannedTypeId: string;
  plannedStart: DateStr;
  plannedEnd: DateStr;
  effectiveStart: DateStr;
  effectiveEnd: DateStr;
  actualKnown: boolean;
  actualRecordedAt?: string;
  actualTypeId: string;
  actualNights: NightSlice[];
  plannedNights: NightSlice[];
  releasedNights: DateStr[];
  note: string;
}

export interface DemandNight extends NightSlice {
  actual: boolean;
  segmentId: string;
}

export interface BookingDemand {
  booking: Booking;
  active: ActiveBooking;
  segments: SegmentResolveResult[];
  /** One entry per (stay date, room type); overlapping same-type segments are deduped. */
  nights: Map<string, DemandNight>;
  actualNights: Map<string, DemandNight>;
  plannedNights: Map<string, DemandNight>;
  /** Dates fully released by a recorded early departure. */
  releasedNights: DateStr[];
  dates: DateStr[];
  stayStart: DateStr;
  stayEnd: DateStr;
  priorityRank: number;
  priorityKey: string;
  prioritySummary: string;
  hasActual: boolean;
  splitAcrossSegments: boolean;
}

export interface CapacityDay {
  date: DateStr;
  roomTypeId: string;
  total: number;
  blocked: number;
  capacity: number;
  blockIds: string[];
  /** Blocks recorded after the observation point; shown but not deducted in this replay. */
  lateBlockIds: string[];
}

export type AllocationAction = 'kept' | 'upgraded' | 'unplaced' | 'actual';

export interface TraceStep {
  kind: 'capacity' | 'block' | 'priority' | 'upgrade' | 'restriction' | 'actual' | 'unplaced' | 'split' | 'release';
  text: string;
}

export interface NightAllocation {
  date: DateStr;
  bookingId: string;
  code: string;
  homeTypeId: string;
  assignedTypeId: string | null;
  rooms: number;
  action: AllocationAction;
  actual: boolean;
  upgradeCostPerRoomNight: number;
  upgradeRuleIds: string[];
  trace: TraceStep[];
}

export interface BookingArrangement {
  bookingId: string;
  code: string;
  guestName: string;
  tier: Tier;
  channel: string;
  priorityRank: number;
  prioritySummary: string;
  homeTypeIds: string[];
  stayStart: DateStr;
  stayEnd: DateStr;
  dates: DateStr[];
  allocations: NightAllocation[];
  allocatedRooms: number;
  unplacedRooms: number;
  unplacedNights: number;
  upgradedRooms: number;
  split: boolean;
  upgradeCost: number;
  finalTypeIds: string[];
  hasActual: boolean;
  releasedNights: DateStr[];
}

export interface GridCell {
  date: DateStr;
  roomTypeId: string;
  total: number;
  blocked: number;
  capacity: number;
  blockIds: string[];
  lateBlockIds: string[];
  demandRooms: number;
  allocatedRooms: number;
  actualRooms: number;
  unplacedRooms: number;
  oversold: number;
  sellable: number;
  ratio: number;
  bookingCodes: string[];
}

export interface ModelSummary {
  totalCapacityNights: number;
  totalRooms: number;
  demandRoomNights: number;
  allocatedRoomNights: number;
  actualRoomNights: number;
  unplacedRooms: number;
  unplacedBookings: number;
  upgradedRooms: number;
  upgradeCost: number;
  oversoldRoomNights: number;
  activeBookingCount: number;
  canceledLaterCount: number;
  canceledBeforeAsOfCount: number;
  lateActualBookings: number;
  lateBlockCount: number;
  /** Unique guests across active bookings; merged/duplicate rows are counted once. */
  guestCount: number;
}

export interface Model {
  dataset: Dataset;
  config: PageConfig;
  asOf: string;
  cutoverDate: DateStr;
  windowDates: DateStr[];
  roomTypes: RoomType[];
  roomTypeById: Map<string, RoomType>;
  capacity: Map<string, Map<DateStr, CapacityDay>>;
  activeBookings: ActiveBooking[];
  demand: BookingDemand[];
  demandByBooking: Map<string, BookingDemand>;
  allocations: NightAllocation[];
  allocationByBooking: Map<string, NightAllocation[]>;
  arrangements: BookingArrangement[];
  arrangementByBooking: Map<string, BookingArrangement>;
  nightRecords: Map<DateStr, NightAllocation[]>;
  grid: Map<string, GridCell>;
  issues: DataIssue[];
  summary: ModelSummary;
}

export interface UpgradeEdgeInfo {
  rule: UpgradeRule;
  allowed: boolean;
  fromTypeId: string;
  toTypeId: string;
}

export interface UpgradePath {
  targetTypeId: string;
  costPerNight: number;
  steps: number;
  ruleIds: string[];
  edges: UpgradeEdgeInfo[];
}

export interface UpgradeAudit {
  /** All configured chains ignoring enablement and tier gates, cheapest first per target. */
  allPaths: (fromTypeId: string) => Map<string, UpgradePath[]>;
  /** Chains that are enabled and allowed for the given tier, cheapest first. */
  allowedPaths: (fromTypeId: string, tier: Tier) => UpgradePath[];
}

export interface AllocationContext {
  roomTypes: RoomType[];
  capacity: Map<string, Map<DateStr, CapacityDay>>;
  config: PageConfig;
  upgrade: UpgradeAudit;
  typeName: (id: string) => string;
  dataset: Dataset;
  asOf: string;
}

export function cellKey(typeId: string, date: DateStr): string {
  return `${typeId}|${date}`;
}

export function demandKey(date: DateStr, roomTypeId: string): string {
  return `${date}|${roomTypeId}`;
}

function inc(map: Map<string, number>, k: string, n = 1): void {
  map.set(k, (map.get(k) ?? 0) + n);
}

function get(map: Map<string, number>, k: string): number {
  return map.get(k) ?? 0;
}

function sum<T>(items: Iterable<T>, fn: (item: T) => number): number {
  let total = 0;
  for (const item of items) total += fn(item);
  return total;
}

export function describeBlocks(
  dataset: Dataset,
  typeId: string,
  date: DateStr,
  asOf: string,
): { applied: TraceStep[]; late: TraceStep[] } {
  const applied: TraceStep[] = [];
  const late: TraceStep[] = [];
  for (const block of dataset.blocks) {
    if (block.roomTypeId && block.roomTypeId !== typeId) continue;
    if (!(block.startDate <= date && date < block.endDate)) continue;
    const text = `${BLOCK_REASON_LABEL[block.reason] ?? '封房'} ${block.id} 在该日扣减 ${block.roomsBlocked} 间${
      block.note ? `（${block.note}）` : ''
    }`;
    const known = !block.recordedAt || compareTimestamp(block.recordedAt, asOf) <= 0;
    if (known) applied.push({ kind: 'block', text });
    else if (block.recordedAt)
      late.push({
        kind: 'block',
        text: `${BLOCK_REASON_LABEL[block.reason] ?? '封房'} ${block.id} 记录于 ${block.recordedAt}，晚于观察时点，本次回放不扣减`,
      });
  }
  return { applied, late };
}

export function validateDataset(dataset: Dataset): DataIssue[] {
  const issues: DataIssue[] = [];
  const typeIds = new Set(dataset.roomTypes.map((t) => t.id));
  const roomTypeById = new Map(dataset.roomTypes.map((t) => [t.id, t]));
  const bookingIds = new Set<string>();

  if (!isValidDateStr(dataset.hotel.windowStart) || !isValidDateStr(dataset.hotel.windowEnd)) {
    issues.push({
      id: 'window-invalid',
      severity: 'error',
      title: '营业窗口日期无效',
      detail: '窗口起止必须是 YYYY-MM-DD。',
    });
  } else if (dataset.hotel.windowEnd <= dataset.hotel.windowStart) {
    issues.push({
      id: 'window-order',
      severity: 'error',
      title: '营业窗口为空',
      detail: '窗口结束日必须晚于开始日（退房日不计入住宿夜）。',
    });
  }
  if (!isValidTimestamp(dataset.hotel.asOf)) {
    issues.push({
      id: 'asof-invalid',
      severity: 'error',
      title: '默认观察时点无效',
      detail: '观察时点必须是 YYYY-MM-DDTHH:mm。',
    });
  }

  for (const type of dataset.roomTypes) {
    if (!Number.isInteger(type.totalRooms) || type.totalRooms < 0) {
      issues.push({
        id: `type-capacity-${type.id}`,
        severity: 'error',
        title: `房型「${type.name}」房量无效`,
        detail: '房量必须是 0 或正整数。',
        refs: [type.id],
      });
    }
  }

  for (const block of dataset.blocks) {
    const type = block.roomTypeId ? roomTypeById.get(block.roomTypeId) : undefined;
    if (block.roomTypeId && !type) {
      issues.push({
        id: `block-type-${block.id}`,
        severity: 'error',
        title: `封房 ${block.id} 指向未知房型`,
        detail: `房型 ${block.roomTypeId} 不存在，该记录不参与容量计算。`,
        refs: [block.id],
      });
      continue;
    }
    if (!isValidDateStr(block.startDate) || !isValidDateStr(block.endDate) || block.endDate <= block.startDate) {
      issues.push({
        id: `block-date-${block.id}`,
        severity: 'error',
        title: `封房 ${block.id} 日期无效`,
        detail: '封房按半开区间扣减容量，结束日必须晚于开始日。',
        refs: [block.id],
      });
    }
    if (!Number.isInteger(block.roomsBlocked) || block.roomsBlocked <= 0) {
      issues.push({
        id: `block-rooms-${block.id}`,
        severity: 'warning',
        title: `封房 ${block.id} 未扣减房量`,
        detail: 'roomsBlocked 应为正整数。',
        refs: [block.id],
      });
    } else {
      for (const target of type ? [type] : dataset.roomTypes) {
        if (block.roomsBlocked > target.totalRooms) {
          issues.push({
            id: `block-over-${block.id}-${target.id}`,
            severity: 'warning',
            title: `封房 ${block.id} 扣减超过「${target.name}」总房量`,
            detail: `扣减 ${block.roomsBlocked} 间，总房量 ${target.totalRooms} 间；可售按 0 计，不产生负房量。`,
            refs: [block.id, target.id],
          });
        }
      }
    }
    if (block.recordedAt && !isValidTimestamp(block.recordedAt)) {
      issues.push({
        id: `block-recorded-${block.id}`,
        severity: 'warning',
        title: `封房 ${block.id} 记录时间格式不正确`,
        detail: '记录时间无法参与观察时点回放，将视为一直存在。',
        refs: [block.id],
      });
    }
  }

  const ruleIds = new Set<string>();
  for (const rule of dataset.upgradeRules) {
    if (ruleIds.has(rule.id)) {
      issues.push({
        id: `rule-duplicate-${rule.id}`,
        severity: 'error',
        title: `升级关系 ${rule.id} 重复`,
        detail: '重复的升级关系只保留第一条。',
        refs: [rule.id],
      });
    }
    ruleIds.add(rule.id);
    if (!typeIds.has(rule.fromTypeId) || !typeIds.has(rule.toTypeId)) {
      issues.push({
        id: `rule-type-${rule.id}`,
        severity: 'error',
        title: `升级关系 ${rule.id} 指向未知房型`,
        detail: `${rule.fromTypeId} → ${rule.toTypeId} 中有房型不存在，该关系不生效。`,
        refs: [rule.id],
      });
    }
    if (rule.fromTypeId === rule.toTypeId) {
      issues.push({
        id: `rule-self-${rule.id}`,
        severity: 'warning',
        title: `升级关系 ${rule.id} 指向自身`,
        detail: '同房型升级关系会被忽略。',
        refs: [rule.id],
      });
    }
    if (!Number.isFinite(rule.costPerNight) || rule.costPerNight < 0) {
      issues.push({
        id: `rule-cost-${rule.id}`,
        severity: 'error',
        title: `升级关系 ${rule.id} 成本无效`,
        detail: '成本必须是 0 或正数。',
        refs: [rule.id],
      });
    }
  }

  const seenCodes = new Map<string, number>();
  for (const booking of dataset.bookings) {
    if (bookingIds.has(booking.id)) {
      issues.push({
        id: `booking-duplicate-id-${booking.id}`,
        severity: 'error',
        title: `预订 ${booking.id} ID 重复`,
        detail: '重复 ID 的预订仅保留第一条。',
        refs: [booking.id],
      });
      continue;
    }
    bookingIds.add(booking.id);
    seenCodes.set(booking.code, (seenCodes.get(booking.code) ?? 0) + 1);
    if (!isValidTimestamp(booking.createdAt)) {
      issues.push({
        id: `booking-created-${booking.id}`,
        severity: 'warning',
        title: `预订 ${booking.code} 创建时间缺失或格式不正确`,
        detail: '创建时间用于优先级排序，缺失时按最早处理。',
        refs: [booking.id],
      });
    }
    if (booking.cancelledAt && !isValidTimestamp(booking.cancelledAt)) {
      issues.push({
        id: `booking-cancel-${booking.id}`,
        severity: 'warning',
        title: `预订 ${booking.code} 取消时间格式不正确`,
        detail: '取消时间无法参与观察时点回放，将按未取消处理。',
        refs: [booking.id],
      });
    }
    if (!Number.isInteger(booking.adults) || booking.adults < 1) {
      issues.push({
        id: `booking-adults-${booking.id}`,
        severity: 'warning',
        title: `预订 ${booking.code} 成人数无效`,
        detail: '人数只用于展示，不影响房量；按 1 位成人展示。',
        refs: [booking.id],
      });
    }
    if (booking.segments.length === 0) {
      issues.push({
        id: `booking-empty-${booking.id}`,
        severity: 'error',
        title: `预订 ${booking.code} 没有住宿段`,
        detail: '没有住宿段的预订无法计入容量。',
        refs: [booking.id],
      });
    }
    const seenSegmentIds = new Set<string>();
    for (const seg of booking.segments) {
      if (seenSegmentIds.has(seg.id)) {
        issues.push({
          id: `segment-duplicate-${booking.id}-${seg.id}`,
          severity: 'error',
          title: `预订 ${booking.code} 住宿段 ${seg.id} 重复`,
          detail: '重复住宿段仅保留第一条。',
          refs: [booking.id, seg.id],
        });
      }
      seenSegmentIds.add(seg.id);
      if (!typeIds.has(seg.roomTypeId)) {
        issues.push({
          id: `segment-type-${booking.id}-${seg.id}`,
          severity: 'error',
          title: `预订 ${booking.code} 指向未知房型`,
          detail: `房型 ${seg.roomTypeId} 不存在，该住宿段被忽略。`,
          refs: [booking.id, seg.id],
        });
      }
      if (
        !isValidDateStr(seg.arrival) ||
        !isValidDateStr(seg.departure) ||
        seg.departure <= seg.arrival
      ) {
        issues.push({
          id: `segment-date-${booking.id}-${seg.id}`,
          severity: 'error',
          title: `预订 ${booking.code} 住宿段日期无效`,
          detail: '退房日必须晚于入住日；入住日计入、退房日不计入。',
          refs: [booking.id, seg.id],
        });
      }
      if (!Number.isInteger(seg.rooms) || seg.rooms < 1) {
        issues.push({
          id: `segment-rooms-${booking.id}-${seg.id}`,
          severity: 'error',
          title: `预订 ${booking.code} 间数无效`,
          detail: '间数必须是正整数。',
          refs: [booking.id, seg.id],
        });
      }
      if (seg.actualRoomTypeId && !typeIds.has(seg.actualRoomTypeId)) {
        issues.push({
          id: `segment-actual-type-${booking.id}-${seg.id}`,
          severity: 'error',
          title: `预订 ${booking.code} 实际房型不存在`,
          detail: `房型 ${seg.actualRoomTypeId} 不存在，实际入住沿用计划房型。`,
          refs: [booking.id, seg.id],
        });
      }
      if (seg.actualArrival && !isValidDateStr(seg.actualArrival)) {
        issues.push({
          id: `segment-actual-arrival-${booking.id}-${seg.id}`,
          severity: 'warning',
          title: `预订 ${booking.code} 实际入住日期格式不正确`,
          detail: '实际日期被忽略，回放沿用计划日期。',
          refs: [booking.id, seg.id],
        });
      }
      if (seg.actualDeparture && !isValidDateStr(seg.actualDeparture)) {
        issues.push({
          id: `segment-actual-departure-${booking.id}-${seg.id}`,
          severity: 'warning',
          title: `预订 ${booking.code} 实际离店日期格式不正确`,
          detail: '实际日期被忽略，回放沿用计划日期。',
          refs: [booking.id, seg.id],
        });
      }
      if (
        seg.actualArrival &&
        seg.actualDeparture &&
        isValidDateStr(seg.actualArrival) &&
        isValidDateStr(seg.actualDeparture) &&
        seg.actualDeparture < seg.actualArrival
      ) {
        issues.push({
          id: `segment-actual-order-${booking.id}-${seg.id}`,
          severity: 'error',
          title: `预订 ${booking.code} 实际离店早于实际入住`,
          detail: '该实际变更被忽略，回放使用计划日期。',
          refs: [booking.id, seg.id],
        });
      }
      if ((seg.actualArrival || seg.actualDeparture || seg.actualRoomTypeId) && !seg.actualRecordedAt) {
        issues.push({
          id: `segment-actual-recorded-${booking.id}-${seg.id}`,
          severity: 'warning',
          title: `预订 ${booking.code} 实际变更缺少记录时间`,
          detail: '无法判断在观察时点是否已知，回放沿用计划日期。',
          refs: [booking.id, seg.id],
        });
      }
    }

    const validSegments = booking.segments.filter(
      (s) =>
        typeIds.has(s.roomTypeId) &&
        isValidDateStr(s.arrival) &&
        isValidDateStr(s.departure) &&
        s.departure > s.arrival,
    );
    for (let i = 0; i < validSegments.length; i++) {
      for (let j = i + 1; j < validSegments.length; j++) {
        const a = validSegments[i];
        const b = validSegments[j];
        if (a.arrival < b.departure && b.arrival < a.departure) {
          const sameType = a.roomTypeId === b.roomTypeId;
          issues.push({
            id: `segment-overlap-${booking.id}-${a.id}-${b.id}`,
            severity: 'info',
            title: `预订 ${booking.code} 的住宿段日期重叠`,
            detail: sameType
              ? `住宿段 ${a.id} 与 ${b.id} 房型相同且日期重叠；同一晚按两者较大间数计入，避免重复间夜。`
              : `住宿段 ${a.id}（${a.roomTypeId}）与 ${b.id}（${b.roomTypeId}）日期重叠但房型不同；按分别占用计入，人数不重复统计。`,
            refs: [booking.id, a.id, b.id],
          });
        }
      }
    }
  }

  for (const [code, count] of seenCodes) {
    if (count > 1) {
      issues.push({
        id: `booking-duplicate-code-${code}`,
        severity: 'warning',
        title: `预订编号 ${code} 出现 ${count} 次`,
        detail: '同一编号的拆房/合并记录请使用 mergeGroupId 与 mergePrimary 标记，否则会重复计入容量。',
        refs: [code],
      });
    }
  }

  const groups = new Map<string, Booking[]>();
  for (const booking of dataset.bookings) {
    if (!booking.mergeGroupId) continue;
    const list = groups.get(booking.mergeGroupId) ?? [];
    list.push(booking);
    groups.set(booking.mergeGroupId, list);
  }
  for (const [groupId, list] of groups) {
    if (list.length > 1) {
      const primaries = list.filter((b) => b.mergePrimary);
      issues.push({
        id: `merge-${groupId}`,
        severity: primaries.length === 1 ? 'info' : 'warning',
        title: `合并组 ${groupId} 含 ${list.length} 条记录`,
        detail:
          primaries.length === 1
            ? `仅主记录 ${primaries[0].code} 计入容量，其余 ${list.length - 1} 条不重复计人数与间夜。`
            : `主记录数为 ${primaries.length}，按创建时间最早的一条作为主记录计入。`,
        refs: list.map((b) => b.code),
      });
    }
  }

  return issues;
}

export function isBookingActiveAt(booking: Booking, asOf: string): boolean {
  if (booking.createdAt && isValidTimestamp(booking.createdAt) && compareTimestamp(booking.createdAt, asOf) > 0) {
    return false;
  }
  if (booking.cancelledAt && isValidTimestamp(booking.cancelledAt) && compareTimestamp(booking.cancelledAt, asOf) <= 0) {
    return false;
  }
  return true;
}

export function resolveActiveBookings(dataset: Dataset, asOf: string): ActiveBooking[] {
  const byGroup = new Map<string, Booking[]>();
  const ungrouped: Booking[] = [];
  for (const booking of dataset.bookings) {
    if (booking.mergeGroupId) {
      const list = byGroup.get(booking.mergeGroupId) ?? [];
      list.push(booking);
      byGroup.set(booking.mergeGroupId, list);
    } else {
      ungrouped.push(booking);
    }
  }
  const out: ActiveBooking[] = [];
  for (const booking of ungrouped) {
    if (isBookingActiveAt(booking, asOf)) {
      out.push({ booking, duplicateIds: [], groupKey: null });
    }
  }
  for (const [groupKey, list] of byGroup) {
    const sorted = [...list].sort((a, b) => {
      if (a.mergePrimary !== b.mergePrimary) return a.mergePrimary ? -1 : 1;
      return compareTimestamp(a.createdAt, b.createdAt);
    });
    const primary = sorted[0];
    if (primary && isBookingActiveAt(primary, asOf)) {
      out.push({ booking: primary, duplicateIds: sorted.slice(1).map((b) => b.id), groupKey });
    }
  }
  return out;
}

export function resolveSegment(
  segment: BookingSegment,
  cutoverDate: DateStr,
  asOf: string,
  windowStart: DateStr,
  windowEnd: DateStr,
  roomTypeIds: Set<string>,
): SegmentResolveResult | null {
  void cutoverDate;
  if (
    !isValidDateStr(segment.arrival) ||
    !isValidDateStr(segment.departure) ||
    segment.departure <= segment.arrival ||
    !roomTypeIds.has(segment.roomTypeId) ||
    !Number.isInteger(segment.rooms) ||
    segment.rooms < 1
  ) {
    return null;
  }

  const actualTypesValid = !!segment.actualRoomTypeId && roomTypeIds.has(segment.actualRoomTypeId);
  const actualDatesValid =
    (!segment.actualArrival || isValidDateStr(segment.actualArrival)) &&
    (!segment.actualDeparture || isValidDateStr(segment.actualDeparture)) &&
    (!(segment.actualArrival && segment.actualDeparture) ||
      segment.actualDeparture >= segment.actualArrival);
  const actualKnown =
    !!segment.actualRecordedAt &&
    isValidTimestamp(segment.actualRecordedAt) &&
    compareTimestamp(segment.actualRecordedAt, asOf) <= 0 &&
    actualDatesValid;

  const actualTypeId = actualKnown && actualTypesValid ? segment.actualRoomTypeId! : segment.roomTypeId;
  const effectiveStart = actualKnown && segment.actualArrival ? segment.actualArrival : segment.arrival;
  const effectiveEnd = actualKnown && segment.actualDeparture ? segment.actualDeparture : segment.departure;

  const actualNights: NightSlice[] = [];
  const plannedNights: NightSlice[] = [];
  const releasedNights: DateStr[] = [];
  const inWindow = (date: DateStr) => date >= windowStart && date < windowEnd;

  if (actualKnown) {
    // A checked-in guest is committed occupancy for the entire (possibly changed) stay.
    for (const date of datesInRange(effectiveStart, effectiveEnd)) {
      if (inWindow(date)) actualNights.push({ date, roomTypeId: actualTypeId, rooms: segment.rooms });
    }
    if (effectiveEnd < segment.departure) {
      for (const date of datesInRange(effectiveEnd, segment.departure)) {
        if (inWindow(date)) releasedNights.push(date);
      }
    }
  } else {
    for (const date of datesInRange(segment.arrival, segment.departure)) {
      if (inWindow(date)) plannedNights.push({ date, roomTypeId: segment.roomTypeId, rooms: segment.rooms });
    }
  }

  let note = '按计划住宿日期回放';
  if (actualKnown) {
    if (effectiveEnd > segment.departure) {
      note = `实际延住：计划 ${segment.arrival}→${segment.departure}，实际 ${effectiveStart}→${effectiveEnd}（记录于 ${segment.actualRecordedAt}）`;
    } else if (effectiveEnd < segment.departure) {
      note = `实际提前退房：计划 ${segment.arrival}→${segment.departure}，实际 ${effectiveStart}→${effectiveEnd}（记录于 ${segment.actualRecordedAt}）`;
    } else if (effectiveStart !== segment.arrival) {
      note = `实际入住日期变更：${segment.arrival}→${effectiveStart}（记录于 ${segment.actualRecordedAt}）`;
    } else if (actualTypeId !== segment.roomTypeId) {
      note = `实际换房至「${actualTypeId}」（记录于 ${segment.actualRecordedAt}）`;
    } else {
      note = `实际入住，按计划日期占用（记录于 ${segment.actualRecordedAt}）`;
    }
  } else if (
    (segment.actualArrival || segment.actualDeparture || segment.actualRoomTypeId) &&
    segment.actualRecordedAt
  ) {
    note = `实际变更记录于 ${segment.actualRecordedAt}，晚于观察时点，本次回放按计划日期占用`;
  }

  if (actualNights.length === 0 && plannedNights.length === 0 && releasedNights.length === 0) return null;

  return {
    segment,
    plannedTypeId: segment.roomTypeId,
    plannedStart: segment.arrival,
    plannedEnd: segment.departure,
    effectiveStart,
    effectiveEnd,
    actualKnown,
    actualRecordedAt: segment.actualRecordedAt,
    actualTypeId,
    actualNights,
    plannedNights,
    releasedNights,
    note,
  };
}

export function priorityComparator(priority: PriorityCriterion[]) {
  return (a: BookingDemand, b: BookingDemand): number => {
    for (const criterion of priority) {
      let diff = 0;
      switch (criterion) {
        case 'tier':
          diff = TIER_RANK[b.booking.tier] - TIER_RANK[a.booking.tier];
          break;
        case 'channel':
          diff = CHANNEL_RANK[b.booking.channel] - CHANNEL_RANK[a.booking.channel];
          break;
        case 'createdAt':
          diff = compareTimestamp(a.booking.createdAt, b.booking.createdAt);
          break;
        case 'stayLength':
          diff = b.dates.length - a.dates.length;
          break;
      }
      if (diff !== 0) return diff;
    }
    return a.booking.code.localeCompare(b.booking.code);
  };
}

export function priorityText(booking: Booking, priority: PriorityCriterion[]): string {
  const parts: string[] = [];
  for (const criterion of priority) {
    switch (criterion) {
      case 'tier':
        parts.push(TIER_LABEL[booking.tier]);
        break;
      case 'channel':
        parts.push(CHANNEL_LABEL[booking.channel]);
        break;
      case 'createdAt':
        parts.push(`创建${shortDate(timestampDate(booking.createdAt))}`);
        break;
      case 'stayLength':
        parts.push('按晚数');
        break;
    }
  }
  return parts.join(' · ');
}

export function buildDemand(
  active: ActiveBooking[],
  cutoverDate: DateStr,
  asOf: string,
  windowStart: DateStr,
  windowEnd: DateStr,
  priority: PriorityCriterion[],
  roomTypeIds: Set<string>,
): BookingDemand[] {
  const list: BookingDemand[] = [];
  for (const entry of active) {
    const booking = entry.booking;
    const segments = booking.segments
      .map((s) => resolveSegment(s, cutoverDate, asOf, windowStart, windowEnd, roomTypeIds))
      .filter((s): s is SegmentResolveResult => s !== null);
    if (segments.length === 0) continue;

    const ordered = [...segments].sort((a, b) => {
      const aActual = a.actualNights.length > 0 ? 0 : 1;
      const bActual = b.actualNights.length > 0 ? 0 : 1;
      if (aActual !== bActual) return aActual - bActual;
      return a.effectiveStart.localeCompare(b.effectiveStart) || a.segment.id.localeCompare(b.segment.id);
    });

    const actualNights = new Map<string, DemandNight>();
    const plannedNights = new Map<string, DemandNight>();
    const released: DateStr[] = [];

    for (const seg of ordered) {
      for (const slice of seg.actualNights) {
        const k = demandKey(slice.date, slice.roomTypeId);
        const prev = actualNights.get(k);
        if (!prev || slice.rooms > prev.rooms) {
          actualNights.set(k, { ...slice, actual: true, segmentId: seg.segment.id });
        }
      }
      for (const slice of seg.plannedNights) {
        const k = demandKey(slice.date, slice.roomTypeId);
        const prev = plannedNights.get(k);
        if (!prev || slice.rooms > prev.rooms) {
          plannedNights.set(k, { ...slice, actual: false, segmentId: seg.segment.id });
        }
      }
      released.push(...seg.releasedNights);
    }

    // Actual occupancy wins over planned on the same date+type so the night is never double counted.
    for (const k of actualNights.keys()) plannedNights.delete(k);

    const nights = new Map<string, DemandNight>();
    for (const [k, v] of actualNights) nights.set(k, v);
    for (const [k, v] of plannedNights) nights.set(k, v);
    if (nights.size === 0 && released.length === 0) continue;

    const dates = [...new Set([...nights.values()].map((n) => n.date))].sort();
    if (dates.length === 0) continue;
    const types = new Set([...nights.values()].map((n) => n.roomTypeId));
    const demand: BookingDemand = {
      booking,
      active: entry,
      segments,
      nights,
      actualNights,
      plannedNights,
      releasedNights: [...new Set(released)].sort(),
      dates,
      stayStart: dates[0],
      stayEnd: addDays(dates[dates.length - 1], 1),
      priorityRank: 0,
      priorityKey: '',
      prioritySummary: priorityText(booking, priority),
      hasActual: actualNights.size > 0,
      splitAcrossSegments: types.size > 1,
    };
    list.push(demand);
  }

  list.sort(priorityComparator(priority));
  list.forEach((d, idx) => {
    d.priorityRank = idx + 1;
    d.priorityKey = priority.map((c) => priorityValue(d, c)).join('|');
  });
  return list;
}

function priorityValue(d: BookingDemand, c: PriorityCriterion): string {
  switch (c) {
    case 'tier':
      return String(TIER_RANK[d.booking.tier]);
    case 'channel':
      return String(CHANNEL_RANK[d.booking.channel]);
    case 'createdAt':
      return d.booking.createdAt;
    case 'stayLength':
      return String(d.dates.length).padStart(3, '0');
  }
}

export function computeCapacity(
  dataset: Dataset,
  windowDates: DateStr[],
  asOf: string,
): Map<string, Map<DateStr, CapacityDay>> {
  const map = new Map<string, Map<DateStr, CapacityDay>>();
  for (const type of dataset.roomTypes) {
    const inner = new Map<DateStr, CapacityDay>();
    for (const date of windowDates) {
      let blocked = 0;
      const blockIds: string[] = [];
      const lateBlockIds: string[] = [];
      for (const block of dataset.blocks) {
        if (block.roomTypeId && block.roomTypeId !== type.id) continue;
        if (!(block.startDate <= date && date < block.endDate)) continue;
        if (!Number.isFinite(block.roomsBlocked) || block.roomsBlocked <= 0) continue;
        const known = !block.recordedAt || compareTimestamp(block.recordedAt, asOf) <= 0;
        if (known) {
          blocked += block.roomsBlocked;
          blockIds.push(block.id);
        } else {
          lateBlockIds.push(block.id);
        }
      }
      const capacity = Math.max(0, type.totalRooms - blocked);
      inner.set(date, {
        date,
        roomTypeId: type.id,
        total: type.totalRooms,
        blocked: Math.min(blocked, type.totalRooms),
        capacity,
        blockIds,
        lateBlockIds,
      });
    }
    map.set(type.id, inner);
  }
  return map;
}

export function buildUpgradeAudit(rules: UpgradeRule[], typeOrder: Map<string, number>): UpgradeAudit {
  const allCache = new Map<string, Map<string, UpgradePath[]>>();
  const allowedCache = new Map<string, UpgradePath[]>();

  const edgesFrom = (fromTypeId: string): UpgradeEdgeInfo[] =>
    rules
      .filter((r) => r.fromTypeId === fromTypeId && r.fromTypeId !== r.toTypeId)
      .map((rule) => ({
        rule,
        allowed: rule.allowed,
        fromTypeId: rule.fromTypeId,
        toTypeId: rule.toTypeId,
      }));

  const allPaths = (fromTypeId: string): Map<string, UpgradePath[]> => {
    const cached = allCache.get(fromTypeId);
    if (cached) return cached;
    const out = new Map<string, UpgradePath[]>();
    const visited = new Set<string>([fromTypeId]);
    const walk = (current: string, cost: number, edges: UpgradeEdgeInfo[]): void => {
      for (const edge of edgesFrom(current)) {
        if (visited.has(edge.toTypeId)) continue;
        visited.add(edge.toTypeId);
        const path: UpgradePath = {
          targetTypeId: edge.toTypeId,
          costPerNight: cost + Math.max(0, edge.rule.costPerNight),
          steps: edges.length + 1,
          ruleIds: [...edges.map((e) => e.rule.id), edge.rule.id],
          edges: [...edges, edge],
        };
        const list = out.get(edge.toTypeId) ?? [];
        list.push(path);
        out.set(edge.toTypeId, list);
        walk(edge.toTypeId, path.costPerNight, path.edges);
        visited.delete(edge.toTypeId);
      }
    };
    walk(fromTypeId, 0, []);
    for (const [, list] of out) {
      list.sort(
        (a, b) =>
          a.costPerNight - b.costPerNight ||
          a.steps - b.steps ||
          (typeOrder.get(a.targetTypeId) ?? 0) - (typeOrder.get(b.targetTypeId) ?? 0),
      );
    }
    allCache.set(fromTypeId, out);
    return out;
  };

  const allowedPaths = (fromTypeId: string, tier: Tier): UpgradePath[] => {
    const cacheKey = `${fromTypeId}|${tier}`;
    const cached = allowedCache.get(cacheKey);
    if (cached) return cached;
    const candidates = allPaths(fromTypeId);
    const result: UpgradePath[] = [];
    for (const [, list] of candidates) {
      const valid = list.find(
        (path) =>
          path.edges.every((e) => e.allowed) &&
          path.edges.every((e) => !e.rule.minTier || TIER_RANK[tier] >= TIER_RANK[e.rule.minTier]),
      );
      if (valid) result.push(valid);
    }
    result.sort(
      (a, b) =>
        a.costPerNight - b.costPerNight ||
        a.steps - b.steps ||
        (typeOrder.get(a.targetTypeId) ?? 0) - (typeOrder.get(b.targetTypeId) ?? 0),
    );
    allowedCache.set(cacheKey, result);
    return result;
  };

  return { allPaths, allowedPaths };
}

export function allocationOrder(roomTypes: RoomType[]): RoomType[] {
  return [...roomTypes].sort((a, b) => a.sortOrder - b.sortOrder);
}

function capacityAt(ctx: AllocationContext, typeId: string, date: DateStr): number {
  return ctx.capacity.get(typeId)?.get(date)?.capacity ?? 0;
}

function freeAt(ctx: AllocationContext, used: Map<string, number>, typeId: string, date: DateStr): number {
  return Math.max(0, capacityAt(ctx, typeId, date) - get(used, cellKey(typeId, date)));
}

function restrictionReasons(
  ctx: AllocationContext,
  fromTypeId: string,
  targetTypeId: string,
  tier: Tier,
  cap: number | null,
): string[] {
  const reasons: string[] = [];
  const all = ctx.upgrade.allPaths(fromTypeId).get(targetTypeId) ?? [];
  if (all.length === 0) {
    reasons.push(`「${ctx.typeName(fromTypeId)}」没有通往「${ctx.typeName(targetTypeId)}」的升级关系`);
    return reasons;
  }
  const path = all[0];
  const disabled = path.edges.find((e) => !e.allowed);
  if (disabled) {
    reasons.push(
      `升级链路「${ctx.typeName(disabled.fromTypeId)} → ${ctx.typeName(disabled.toTypeId)}」未启用`,
    );
  }
  const tierBlocked = path.edges.find((e) => e.rule.minTier && TIER_RANK[tier] < TIER_RANK[e.rule.minTier]);
  if (tierBlocked?.rule.minTier) {
    reasons.push(
      `升级链路「${ctx.typeName(tierBlocked.fromTypeId)} → ${ctx.typeName(
        tierBlocked.toTypeId,
      )}」要求 ${TIER_LABEL[tierBlocked.rule.minTier]} 及以上，本单为 ${TIER_LABEL[tier]}`,
    );
  }
  if (cap !== null && path.costPerNight > cap) {
    reasons.push(`升级成本 ${path.costPerNight}/间/晚，超过页面设置上限 ${cap}/间/晚`);
  }
  if (reasons.length === 0) {
    reasons.push('链路存在，但当日剩余房量不足或已被更高优先级预订占用');
  }
  return reasons;
}

interface SliceTask {
  demand: BookingDemand;
  slice: DemandNight;
}

export function allocate(
  ctx: AllocationContext,
  demandList: BookingDemand[],
): { allocations: NightAllocation[]; used: Map<string, number> } {
  const allocations: NightAllocation[] = [];
  const used = new Map<string, number>();
  const cap = ctx.config.maxUpgradeCostPerNight;

  // Actual in-house rooms are facts. Lock them before any planned placement.
  for (const demand of demandList) {
    for (const night of demand.actualNights.values()) {
      const trace: TraceStep[] = [
        {
          kind: 'actual',
          text: `实际占用锁定「${ctx.typeName(night.roomTypeId)}」${night.rooms} 间；实际入住不参与重新安置`,
        },
      ];
      const seg = demand.segments.find((s) => s.segment.id === night.segmentId);
      if (seg && seg.actualKnown) trace.push({ kind: 'actual', text: seg.note });
      for (const date of seg?.releasedNights ?? []) {
        void date;
      }
      if (seg && seg.releasedNights.length > 0) {
        trace.push({
          kind: 'release',
          text: `提前退房释放 ${seg.releasedNights.map(shortDate).join('、')} 的房量`,
        });
      }
      allocations.push({
        date: night.date,
        bookingId: demand.booking.id,
        code: demand.booking.code,
        homeTypeId: night.roomTypeId,
        assignedTypeId: night.roomTypeId,
        rooms: night.rooms,
        action: 'actual',
        actual: true,
        upgradeCostPerRoomNight: 0,
        upgradeRuleIds: [],
        trace,
      });
      inc(used, cellKey(night.roomTypeId, night.date), night.rooms);
    }
  }

  // Planned slices are allocated by booking priority, then by date, then room-type order.
  const typeIndex = new Map(ctx.roomTypes.map((t, i) => [t.id, i]));
  const tasks: SliceTask[] = [];
  for (const demand of demandList) {
    for (const slice of demand.plannedNights.values()) tasks.push({ demand, slice });
  }
  tasks.sort(
    (a, b) =>
      a.demand.priorityRank - b.demand.priorityRank ||
      a.slice.date.localeCompare(b.slice.date) ||
      (typeIndex.get(a.slice.roomTypeId) ?? 0) - (typeIndex.get(b.slice.roomTypeId) ?? 0),
  );

  for (const { demand, slice } of tasks) {
    const booking = demand.booking;
    const home = slice.roomTypeId;
    const paths = ctx.upgrade.allowedPaths(home, booking.tier);
    const candidates: { typeId: string; path: UpgradePath | null }[] = [
      { typeId: home, path: null },
      ...paths
        .filter((p) => cap === null || p.costPerNight <= cap)
        .map((p) => ({ typeId: p.targetTypeId, path: p })),
    ];

    let remaining = slice.rooms;
    const placed: NightAllocation[] = [];
    for (const candidate of candidates) {
      if (remaining <= 0) break;
      const free = freeAt(ctx, used, candidate.typeId, slice.date);
      if (free <= 0) continue;
      const take = Math.min(remaining, free);
      const isUpgrade = candidate.typeId !== home;
      const cost = candidate.path?.costPerNight ?? 0;
      const trace: TraceStep[] = [];
      const day = ctx.capacity.get(candidate.typeId)?.get(slice.date);
      const usedBefore = get(used, cellKey(candidate.typeId, slice.date));
      if (isUpgrade) {
        trace.push({
          kind: 'upgrade',
          text: `「${ctx.typeName(home)}」剩余 ${freeAt(ctx, used, home, slice.date)} 间，不足 ${slice.rooms} 间；按成本与跳级顺序改用「${ctx.typeName(
            candidate.typeId,
          )}」，链路 ${candidate.path?.edges
            .map((e) => `${ctx.typeName(e.fromTypeId)}→${ctx.typeName(e.toTypeId)}`)
            .join('，')}，成本 ${cost}/间/晚`,
        });
        for (const edge of candidate.path?.edges ?? []) {
          if (edge.rule.minTier) {
            trace.push({
              kind: 'restriction',
              text: `升级关系 ${edge.rule.id} 要求 ${TIER_LABEL[edge.rule.minTier]} 及以上；本单为 ${TIER_LABEL[booking.tier]}，满足`,
            });
          }
        }
      } else {
        trace.push({
          kind: 'capacity',
          text: `「${ctx.typeName(candidate.typeId)}」当日容量 ${day?.capacity ?? 0} 间（冻结 ${day?.blocked ?? 0} 间），已占用 ${usedBefore} 间，本单需要 ${slice.rooms} 间`,
        });
      }
      const blocks = describeBlocks(ctx.dataset, candidate.typeId, slice.date, ctx.asOf);
      trace.push(...blocks.applied, ...blocks.late);
      const prior = allocations.filter(
        (a) =>
          a.date === slice.date &&
          a.bookingId !== demand.booking.id &&
          (a.action === 'actual' || a.action === 'kept' || a.action === 'upgraded'),
      );
      if (prior.length > 0) {
        const codes = [...new Set(prior.map((a) => `${a.code}#${a.assignedTypeId ? ctx.typeName(a.assignedTypeId) : ''}`))];
        trace.push({
          kind: 'priority',
          text: `本单优先级 #${demand.priorityRank}（${demand.prioritySummary}）；该日先安置：${codes
            .slice(0, 8)
            .join('、')}${codes.length > 8 ? ' 等' : ''}`,
        });
      }
      allocations.push({
        date: slice.date,
        bookingId: booking.id,
        code: booking.code,
        homeTypeId: home,
        assignedTypeId: candidate.typeId,
        rooms: take,
        action: isUpgrade ? 'upgraded' : 'kept',
        actual: false,
        upgradeCostPerRoomNight: isUpgrade ? cost : 0,
        upgradeRuleIds: candidate.path?.ruleIds ?? [],
        trace,
      });
      placed.push(allocations[allocations.length - 1]);
      inc(used, cellKey(candidate.typeId, slice.date), take);
      remaining -= take;
    }

    if (remaining > 0) {
      const trace: TraceStep[] = [];
      trace.push({
        kind: 'unplaced',
        text: `仍有 ${remaining} 间无法安置：「${ctx.typeName(home)}」当日可售 ${freeAt(
          ctx,
          used,
          home,
          slice.date,
        )} 间，本单需要 ${slice.rooms} 间`,
      });
      for (const candidate of candidates) {
        if (candidate.typeId === home) continue;
        const free = freeAt(ctx, used, candidate.typeId, slice.date);
        if (free > 0) {
          trace.push({
            kind: 'restriction',
            text: `「${ctx.typeName(candidate.typeId)}」仍有 ${free} 间可售，但不足以容纳剩余的 ${remaining} 间`,
          });
        }
      }
      for (const type of ctx.roomTypes) {
        if (type.id === home || candidates.some((c) => c.typeId === type.id)) continue;
        const free = freeAt(ctx, used, type.id, slice.date);
        if (free <= 0) continue;
        for (const reason of restrictionReasons(ctx, home, type.id, booking.tier, cap)) {
          trace.push({
            kind: 'restriction',
            text: `「${type.name}」仍有 ${free} 间可售，但${reason}；无法用不存在的房量补齐，保留为未安置`,
          });
        }
      }
      const blocks = describeBlocks(ctx.dataset, home, slice.date, ctx.asOf);
      trace.push(...blocks.applied, ...blocks.late);
      trace.push({
        kind: 'priority',
        text: `本单优先级 #${demand.priorityRank}（${demand.prioritySummary}）；未安置房量不写入任何房型容量`,
      });
      allocations.push({
        date: slice.date,
        bookingId: booking.id,
        code: booking.code,
        homeTypeId: home,
        assignedTypeId: null,
        rooms: remaining,
        action: 'unplaced',
        actual: false,
        upgradeCostPerRoomNight: 0,
        upgradeRuleIds: [],
        trace,
      });
      placed.push(allocations[allocations.length - 1]);
    }

    if (placed.length > 1) {
      const summaryText = placed
        .map((p) => (p.assignedTypeId ? `${ctx.typeName(p.assignedTypeId)} ${p.rooms} 间` : `未安置 ${p.rooms} 间`))
        .join(' + ');
      for (const p of placed) {
        p.trace.push({
          kind: 'split',
          text: `本晚拆分为 ${summaryText}；同一晚每间房只计一次`,
        });
      }
    }
  }

  return { allocations, used };
}

export function buildGrid(
  roomTypes: RoomType[],
  windowDates: DateStr[],
  capacity: Map<string, Map<DateStr, CapacityDay>>,
  demand: BookingDemand[],
  allocations: NightAllocation[],
): Map<string, GridCell> {
  const grid = new Map<string, GridCell>();
  const byDate = new Map<DateStr, NightAllocation[]>();
  for (const a of allocations) {
    const list = byDate.get(a.date) ?? [];
    list.push(a);
    byDate.set(a.date, list);
  }
  for (const type of roomTypes) {
    for (const date of windowDates) {
      const day = capacity.get(type.id)?.get(date);
      const capacityValue = day?.capacity ?? 0;
      let demandRooms = 0;
      const codes: string[] = [];
      for (const d of demand) {
        const n = d.nights.get(demandKey(date, type.id));
        if (n) {
          demandRooms += n.rooms;
          codes.push(d.booking.code);
        }
      }
      let allocatedRooms = 0;
      let actualRooms = 0;
      let unplacedRooms = 0;
      for (const a of byDate.get(date) ?? []) {
        if (a.action === 'unplaced') {
          if (a.homeTypeId === type.id) unplacedRooms += a.rooms;
          continue;
        }
        if (a.assignedTypeId === type.id) {
          allocatedRooms += a.rooms;
          if (a.actual) actualRooms += a.rooms;
        }
      }
      grid.set(cellKey(type.id, date), {
        date,
        roomTypeId: type.id,
        total: type.totalRooms,
        blocked: day?.blocked ?? 0,
        capacity: capacityValue,
        blockIds: day?.blockIds ?? [],
        lateBlockIds: day?.lateBlockIds ?? [],
        demandRooms,
        allocatedRooms,
        actualRooms,
        unplacedRooms,
        oversold: Math.max(0, demandRooms - capacityValue),
        sellable: Math.max(0, capacityValue - demandRooms),
        ratio: capacityValue === 0 ? (demandRooms > 0 ? 1 : 0) : demandRooms / capacityValue,
        bookingCodes: [...new Set(codes)].sort(),
      });
    }
  }
  return grid;
}

export interface BuildModelOptions {
  validate?: boolean;
}

export function buildModel(
  dataset: Dataset,
  config: PageConfig,
  asOf: string,
  options: BuildModelOptions = {},
): Model {
  const issues = options.validate === false ? [] : validateDataset(dataset);
  const cutoverDate = timestampDate(asOf);
  const windowDates = datesInRange(dataset.hotel.windowStart, dataset.hotel.windowEnd);
  const roomTypes = allocationOrder(dataset.roomTypes);
  const roomTypeById = new Map(roomTypes.map((t) => [t.id, t]));
  const typeOrder = new Map(roomTypes.map((t, i) => [t.id, i]));
  const capacity = computeCapacity(dataset, windowDates, asOf);
  const active = resolveActiveBookings(dataset, asOf);
  const roomTypeIds = new Set(roomTypes.map((t) => t.id));
  const demand = buildDemand(
    active,
    cutoverDate,
    asOf,
    dataset.hotel.windowStart,
    dataset.hotel.windowEnd,
    config.priority,
    roomTypeIds,
  );
  const upgrade = buildUpgradeAudit(dataset.upgradeRules, typeOrder);
  const ctx: AllocationContext = {
    roomTypes,
    capacity,
    config,
    upgrade,
    typeName: (id) => roomTypeById.get(id)?.name ?? id,
    dataset,
    asOf,
  };
  const { allocations } = allocate(ctx, demand);
  const grid = buildGrid(roomTypes, windowDates, capacity, demand, allocations);

  const nightRecords = new Map<DateStr, NightAllocation[]>();
  for (const date of windowDates) nightRecords.set(date, []);
  for (const a of allocations) nightRecords.get(a.date)?.push(a);
  for (const [, list] of nightRecords) list.sort((a, b) => a.code.localeCompare(b.code) || a.action.localeCompare(b.action));

  const allocationByBooking = new Map<string, NightAllocation[]>();
  for (const a of allocations) {
    const list = allocationByBooking.get(a.bookingId) ?? [];
    list.push(a);
    allocationByBooking.set(a.bookingId, list);
  }

  const arrangements: BookingArrangement[] = [];
  for (const d of demand) {
    const allocs = (allocationByBooking.get(d.booking.id) ?? []).sort(
      (a, b) => a.date.localeCompare(b.date) || (a.assignedTypeId ?? '').localeCompare(b.assignedTypeId ?? ''),
    );
    const unplacedRooms = sum(
      allocs.filter((a) => a.action === 'unplaced'),
      (a) => a.rooms,
    );
    const unplacedNights = new Set(allocs.filter((a) => a.action === 'unplaced').map((a) => a.date)).size;
    const upgradedRooms = sum(
      allocs.filter((a) => a.action === 'upgraded'),
      (a) => a.rooms,
    );
    const assignedTypes = new Set(allocs.filter((a) => a.assignedTypeId).map((a) => a.assignedTypeId!));
    const perDate = new Map<DateStr, number>();
    for (const a of allocs) {
      if (a.action === 'unplaced') continue;
      perDate.set(a.date, (perDate.get(a.date) ?? 0) + 1);
    }
    arrangements.push({
      bookingId: d.booking.id,
      code: d.booking.code,
      guestName: d.booking.guestName,
      tier: d.booking.tier,
      channel: CHANNEL_LABEL[d.booking.channel],
      priorityRank: d.priorityRank,
      prioritySummary: d.prioritySummary,
      homeTypeIds: [...new Set(d.segments.map((s) => s.plannedTypeId))],
      stayStart: d.stayStart,
      stayEnd: d.stayEnd,
      dates: d.dates,
      allocations: allocs,
      allocatedRooms: sum(
        allocs.filter((a) => a.action !== 'unplaced'),
        (a) => a.rooms,
      ),
      unplacedRooms,
      unplacedNights,
      upgradedRooms,
      split: assignedTypes.size > 1 || d.splitAcrossSegments || [...perDate.values()].some((n) => n > 1),
      upgradeCost: sum(
        allocs.filter((a) => a.action === 'upgraded'),
        (a) => a.rooms * a.upgradeCostPerRoomNight,
      ),
      finalTypeIds: [...assignedTypes],
      hasActual: d.hasActual,
      releasedNights: d.releasedNights,
    });
  }

  const arrangementByBooking = new Map(arrangements.map((a) => [a.bookingId, a]));
  const demandByBooking = new Map(demand.map((d) => [d.booking.id, d]));

  const lateBlockCount = dataset.blocks.filter(
    (b) => b.recordedAt && isValidTimestamp(b.recordedAt) && compareTimestamp(b.recordedAt, asOf) > 0,
  ).length;

  const summary: ModelSummary = {
    totalCapacityNights: sum(roomTypes, (t) =>
      sum(windowDates, (date) => capacity.get(t.id)?.get(date)?.capacity ?? 0),
    ),
    totalRooms: sum(roomTypes, (t) => t.totalRooms),
    demandRoomNights: sum(demand, (d) => sum(d.nights.values(), (n) => n.rooms)),
    allocatedRoomNights: sum(
      allocations.filter((a) => a.action !== 'unplaced'),
      (a) => a.rooms,
    ),
    actualRoomNights: sum(
      allocations.filter((a) => a.actual),
      (a) => a.rooms,
    ),
    unplacedRooms: sum(
      allocations.filter((a) => a.action === 'unplaced'),
      (a) => a.rooms,
    ),
    unplacedBookings: new Set(allocations.filter((a) => a.action === 'unplaced').map((a) => a.bookingId)).size,
    upgradedRooms: sum(
      allocations.filter((a) => a.action === 'upgraded'),
      (a) => a.rooms,
    ),
    upgradeCost: sum(
      allocations.filter((a) => a.action === 'upgraded'),
      (a) => a.rooms * a.upgradeCostPerRoomNight,
    ),
    oversoldRoomNights: sum([...grid.values()], (cell) => cell.oversold),
    activeBookingCount: demand.length,
    canceledLaterCount: dataset.bookings.filter(
      (b) => b.cancelledAt && isValidTimestamp(b.cancelledAt) && compareTimestamp(b.cancelledAt, asOf) > 0,
    ).length,
    canceledBeforeAsOfCount: dataset.bookings.filter(
      (b) => b.cancelledAt && isValidTimestamp(b.cancelledAt) && compareTimestamp(b.cancelledAt, asOf) <= 0,
    ).length,
    lateActualBookings: demand.filter((d) =>
      d.segments.some(
        (s) =>
          (s.segment.actualArrival || s.segment.actualDeparture || s.segment.actualRoomTypeId) &&
          !s.actualKnown,
      ),
    ).length,
    lateBlockCount,
    guestCount: sum(demand, (d) => Math.max(1, d.booking.adults) + Math.max(0, d.booking.children)),
  };

  return {
    dataset,
    config,
    asOf,
    cutoverDate,
    windowDates,
    roomTypes,
    roomTypeById,
    capacity,
    activeBookings: active,
    demand,
    demandByBooking,
    allocations,
    allocationByBooking,
    arrangements,
    arrangementByBooking,
    nightRecords,
    grid,
    issues,
    summary,
  };
}

export function sellableAt(cell: GridCell): number {
  return Math.max(0, cell.capacity - cell.demandRooms);
}

export function nightsOfBooking(demand: BookingDemand | undefined): DateStr[] {
  if (!demand) return [];
  return demand.dates;
}

export function releasedNightsForBooking(model: Model, bookingId: string): DateStr[] {
  return model.demandByBooking.get(bookingId)?.releasedNights ?? [];
}

export function nightsBetweenFormatted(start: DateStr, end: DateStr): string {
  const n = diffDays(start, end);
  return `${shortDate(start)} → ${shortDate(end)} · ${n} 晚`;
}

export function stayOverlap(start: DateStr, endExclusive: DateStr, date: DateStr): boolean {
  return start <= date && date < endExclusive;
}

export function arrangementForNight(
  model: Model,
  bookingId: string,
  date: DateStr,
): { allocations: NightAllocation[]; demandNight?: DemandNight } {
  const allocations = (model.allocationByBooking.get(bookingId) ?? []).filter((a) => a.date === date);
  const demandNight = model.demandByBooking.get(bookingId)?.nights.get(demandKey(date, allocations[0]?.homeTypeId ?? ''));
  return { allocations, demandNight };
}
