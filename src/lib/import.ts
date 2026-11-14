import type { Booking, BookingSegment, CapacityBlock, Channel, Dataset, RoomType, Tier, UpgradeRule } from './types';
import { isValidDateStr, isValidTimestamp } from './date';

export interface ImportMessage {
  row: number;
  level: 'error' | 'warning';
  message: string;
}

export interface ImportResult<T> {
  items: T[];
  messages: ImportMessage[];
}

export function parseCsv(text: string): { rows: string[][]; messages: ImportMessage[] } {
  const messages: ImportMessage[] = [];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
    row = [];
  };

  const normalized = text.replace(/^﻿/, '');
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      if (field.length > 0) messages.push({ row: line, level: 'warning', message: '引号前有未转义字符，已按普通文本处理' });
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      pushField();
      continue;
    }
    if (ch === '\r') continue;
    if (ch === '\n') {
      pushRow();
      line++;
      rowStartLine = line;
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }
  void rowStartLine;
  return { rows, messages };
}

function toMap(header: string[]): Map<string, number> {
  const map = new Map<string, number>();
  header.forEach((name, index) => map.set(name.trim(), index));
  return map;
}

function cell(row: string[], map: Map<string, number>, key: string): string {
  const index = map.get(key);
  if (index === undefined) return '';
  return (row[index] ?? '').trim();
}

function required(
  row: string[],
  map: Map<string, number>,
  key: string,
  rowNumber: number,
  messages: ImportMessage[],
): string | null {
  const value = cell(row, map, key);
  if (!value) {
    messages.push({ row: rowNumber, level: 'error', message: `缺少必填列 ${key}` });
    return null;
  }
  return value;
}

const CHANNELS: Channel[] = ['member', 'direct', 'corporate', 'ota', 'group'];
const TIERS: Tier[] = ['platinum', 'gold', 'silver', 'standard'];

function parseChannel(value: string): Channel | null {
  if (!value) return 'direct';
  const normalized = value.toLowerCase();
  if (CHANNELS.includes(normalized as Channel)) return normalized as Channel;
  const zh: Record<string, Channel> = {
    会员: 'member',
    会员直订: 'member',
    官网: 'direct',
    官网直订: 'direct',
    直订: 'direct',
    企业: 'corporate',
    企业协议: 'corporate',
    ota: 'ota',
    团队: 'group',
  };
  return zh[value] ?? null;
}

function parseTier(value: string): Tier | null {
  if (!value) return 'standard';
  const normalized = value.toLowerCase();
  if (TIERS.includes(normalized as Tier)) return normalized as Tier;
  const zh: Record<string, Tier> = {
    铂金: 'platinum',
    白金: 'platinum',
    金卡: 'gold',
    金: 'gold',
    银卡: 'silver',
    银: 'silver',
    标准: 'standard',
  };
  return zh[value] ?? null;
}

/**
 * Bookings CSV, one row per booking segment. Rows sharing `bookingCode` are one booking.
 * Actual-stay columns are optional and only applied when the segment id matches.
 */
export function importBookingsCsv(text: string): ImportResult<Booking> {
  const { rows, messages } = parseCsv(text);
  if (rows.length < 2) {
    return { items: [], messages: [...messages, { row: 1, level: 'error', message: 'CSV 至少需要表头和一行数据' }] };
  }
  const map = toMap(rows[0]);
  const bookings = new Map<string, Booking>();
  const segmentIds = new Map<string, Set<string>>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rowNumber = r + 1;
    const code = required(row, map, 'bookingCode', rowNumber, messages);
    const roomTypeId = required(row, map, 'roomTypeId', rowNumber, messages);
    const arrival = required(row, map, 'arrival', rowNumber, messages);
    const departure = required(row, map, 'departure', rowNumber, messages);
    if (!code || !roomTypeId || !arrival || !departure) continue;
    if (!isValidDateStr(arrival) || !isValidDateStr(departure)) {
      messages.push({ row: rowNumber, level: 'error', message: `日期格式应为 YYYY-MM-DD（${arrival} / ${departure}）` });
      continue;
    }
    if (departure <= arrival) {
      messages.push({ row: rowNumber, level: 'error', message: 'departure 必须晚于 arrival（退房日不计入住宿夜）' });
      continue;
    }
    const rooms = Number(cell(row, map, 'rooms') || '1');
    if (!Number.isInteger(rooms) || rooms < 1) {
      messages.push({ row: rowNumber, level: 'error', message: `rooms 必须是正整数（${cell(row, map, 'rooms')}）` });
      continue;
    }
    const channel = parseChannel(cell(row, map, 'channel'));
    if (!channel) {
      messages.push({ row: rowNumber, level: 'warning', message: `未知渠道 ${cell(row, map, 'channel')}，按官网直订处理` });
    }
    const tier = parseTier(cell(row, map, 'tier'));
    if (!tier) {
      messages.push({ row: rowNumber, level: 'warning', message: `未知会员等级 ${cell(row, map, 'tier')}，按标准处理` });
    }
    const adults = Number(cell(row, map, 'adults') || '1');
    const children = Number(cell(row, map, 'children') || '0');

    const segmentId = cell(row, map, 'segmentId') || 'S1';
    const existingSet = segmentIds.get(code) ?? new Set<string>();
    let uniqueSegmentId = segmentId;
    let suffix = 2;
    while (existingSet.has(uniqueSegmentId)) {
      uniqueSegmentId = `${segmentId}-${suffix}`;
      suffix++;
      messages.push({
        row: rowNumber,
        level: 'warning',
        message: `同一预订的住宿段 ${segmentId} 重复，已重命名为 ${uniqueSegmentId}`,
      });
    }
    existingSet.add(uniqueSegmentId);
    segmentIds.set(code, existingSet);

    const segment: BookingSegment = {
      id: uniqueSegmentId,
      roomTypeId,
      arrival,
      departure,
      rooms,
    };
    const actualArrival = cell(row, map, 'actualArrival');
    const actualDeparture = cell(row, map, 'actualDeparture');
    const actualRoomTypeId = cell(row, map, 'actualRoomTypeId');
    const actualRecordedAt = cell(row, map, 'actualRecordedAt');
    if (actualArrival) segment.actualArrival = actualArrival;
    if (actualDeparture) segment.actualDeparture = actualDeparture;
    if (actualRoomTypeId) segment.actualRoomTypeId = actualRoomTypeId;
    if (actualRecordedAt) segment.actualRecordedAt = actualRecordedAt;
    if ((actualArrival || actualDeparture || actualRoomTypeId) && !actualRecordedAt) {
      messages.push({
        row: rowNumber,
        level: 'warning',
        message: '有实际入住数据但缺少 actualRecordedAt，回放将忽略该实际变更',
      });
    }
    if (actualRecordedAt && !isValidTimestamp(actualRecordedAt)) {
      messages.push({ row: rowNumber, level: 'warning', message: 'actualRecordedAt 格式应为 YYYY-MM-DDTHH:mm' });
    }

    const createdAt = cell(row, map, 'createdAt') || '2026-01-01T00:00';
    if (!isValidTimestamp(createdAt)) {
      messages.push({ row: rowNumber, level: 'warning', message: 'createdAt 格式应为 YYYY-MM-DDTHH:mm' });
    }
    const cancelledAt = cell(row, map, 'cancelledAt');
    const mergeGroupId = cell(row, map, 'mergeGroupId');
    const mergePrimaryRaw = cell(row, map, 'mergePrimary');

    const existing = bookings.get(code);
    if (existing) {
      existing.segments.push(segment);
      if (cancelledAt && !existing.cancelledAt) existing.cancelledAt = cancelledAt;
      if (mergeGroupId && !existing.mergeGroupId) existing.mergeGroupId = mergeGroupId;
    } else {
      bookings.set(code, {
        id: `import-${code}`,
        code,
        guestName: cell(row, map, 'guestName') || code,
        channel: channel ?? 'direct',
        tier: tier ?? 'standard',
        createdAt,
        adults: Number.isFinite(adults) && adults >= 1 ? adults : 1,
        children: Number.isFinite(children) && children >= 0 ? children : 0,
        segments: [segment],
        cancelledAt: cancelledAt || undefined,
        mergeGroupId: mergeGroupId || undefined,
        mergePrimary: mergePrimaryRaw ? /^(1|true|yes|是)$/i.test(mergePrimaryRaw) : undefined,
        notes: cell(row, map, 'notes') || undefined,
      });
    }
  }

  return { items: [...bookings.values()], messages };
}

/** Blocks CSV, one row per maintenance/lock period. */
export function importBlocksCsv(text: string): ImportResult<CapacityBlock> {
  const { rows, messages } = parseCsv(text);
  if (rows.length < 2) {
    return { items: [], messages: [...messages, { row: 1, level: 'error', message: 'CSV 至少需要表头和一行数据' }] };
  }
  const map = toMap(rows[0]);
  const items: CapacityBlock[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rowNumber = r + 1;
    const id = required(row, map, 'blockId', rowNumber, messages);
    const startDate = required(row, map, 'startDate', rowNumber, messages);
    const endDate = required(row, map, 'endDate', rowNumber, messages);
    if (!id || !startDate || !endDate) continue;
    if (!isValidDateStr(startDate) || !isValidDateStr(endDate)) {
      messages.push({ row: rowNumber, level: 'error', message: '日期格式应为 YYYY-MM-DD' });
      continue;
    }
    if (endDate <= startDate) {
      messages.push({ row: rowNumber, level: 'error', message: 'endDate 必须晚于 startDate（结束日不扣减）' });
      continue;
    }
    const roomsBlocked = Number(cell(row, map, 'roomsBlocked') || '0');
    if (!Number.isInteger(roomsBlocked) || roomsBlocked < 1) {
      messages.push({ row: rowNumber, level: 'error', message: 'roomsBlocked 必须是正整数' });
      continue;
    }
    const reasonRaw = (cell(row, map, 'reason') || 'maintenance').toLowerCase();
    const reason: CapacityBlock['reason'] =
      reasonRaw === 'lock' || reasonRaw === '锁房' ? 'lock' : 'maintenance';
    const roomTypeId = cell(row, map, 'roomTypeId') || null;
    const recordedAt = cell(row, map, 'recordedAt');
    items.push({
      id,
      reason,
      roomTypeId,
      startDate,
      endDate,
      roomsBlocked,
      note: cell(row, map, 'note') || undefined,
      recordedAt: recordedAt || undefined,
    });
    if (recordedAt && !isValidTimestamp(recordedAt)) {
      messages.push({ row: rowNumber, level: 'warning', message: 'recordedAt 格式应为 YYYY-MM-DDTHH:mm' });
    }
  }
  return { items, messages };
}

/** Upgrade rules CSV or JSON editing helper. */
export function importUpgradeRulesCsv(text: string): ImportResult<UpgradeRule> {
  const { rows, messages } = parseCsv(text);
  if (rows.length < 2) {
    return { items: [], messages: [...messages, { row: 1, level: 'error', message: 'CSV 至少需要表头和一行数据' }] };
  }
  const map = toMap(rows[0]);
  const items: UpgradeRule[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rowNumber = r + 1;
    const fromTypeId = required(row, map, 'fromTypeId', rowNumber, messages);
    const toTypeId = required(row, map, 'toTypeId', rowNumber, messages);
    if (!fromTypeId || !toTypeId) continue;
    const cost = Number(cell(row, map, 'costPerNight') || '0');
    if (!Number.isFinite(cost) || cost < 0) {
      messages.push({ row: rowNumber, level: 'error', message: 'costPerNight 必须是 0 或正数' });
      continue;
    }
    const allowedRaw = (cell(row, map, 'allowed') || 'true').toLowerCase();
    const minTierRaw = cell(row, map, 'minTier');
    const minTier = minTierRaw ? parseTier(minTierRaw) : null;
    if (minTierRaw && !minTier) {
      messages.push({ row: rowNumber, level: 'warning', message: `未知 minTier ${minTierRaw}，将不设等级门槛` });
    }
    items.push({
      id: cell(row, map, 'ruleId') || `${fromTypeId}-${toTypeId}`,
      fromTypeId,
      toTypeId,
      allowed: /^(1|true|yes|是)$/i.test(allowedRaw),
      costPerNight: cost,
      minTier: minTier ?? undefined,
    });
  }
  return { items, messages };
}

export function exportDatasetJson(dataset: Dataset): string {
  return JSON.stringify(dataset, null, 2);
}

export function importDatasetJson(text: string): { dataset: Dataset | null; messages: ImportMessage[] } {
  const messages: ImportMessage[] = [];
  try {
    const parsed = JSON.parse(text) as Partial<Dataset>;
    if (!parsed || typeof parsed !== 'object') {
      return { dataset: null, messages: [{ row: 0, level: 'error', message: 'JSON 根节点必须是对象' }] };
    }
    const hotel = parsed.hotel;
    if (!hotel || !hotel.windowStart || !hotel.windowEnd || !hotel.asOf) {
      messages.push({ row: 0, level: 'error', message: '缺少 hotel.windowStart / windowEnd / asOf' });
      return { dataset: null, messages };
    }
    if (!Array.isArray(parsed.roomTypes) || parsed.roomTypes.length === 0) {
      messages.push({ row: 0, level: 'error', message: '缺少 roomTypes 数组' });
    }
    if (!Array.isArray(parsed.bookings)) {
      messages.push({ row: 0, level: 'error', message: '缺少 bookings 数组' });
    }
    if (messages.some((m) => m.level === 'error')) return { dataset: null, messages };
    const dataset: Dataset = {
      hotel: {
        name: hotel.name || '未命名酒店',
        windowStart: hotel.windowStart,
        windowEnd: hotel.windowEnd,
        asOf: hotel.asOf,
      },
      roomTypes: (parsed.roomTypes as RoomType[]).map((t, i) => ({
        id: String(t.id),
        name: String(t.name ?? t.id),
        shortName: String(t.shortName ?? t.name ?? t.id),
        totalRooms: Number(t.totalRooms ?? 0),
        maxOccupancy: Number(t.maxOccupancy ?? 2),
        sortOrder: Number(t.sortOrder ?? i + 1),
      })),
      blocks: Array.isArray(parsed.blocks)
        ? (parsed.blocks as CapacityBlock[]).map((b) => ({
            id: String(b.id),
            reason: b.reason === 'lock' ? 'lock' : 'maintenance',
            roomTypeId: b.roomTypeId ? String(b.roomTypeId) : null,
            startDate: String(b.startDate),
            endDate: String(b.endDate),
            roomsBlocked: Number(b.roomsBlocked ?? 0),
            note: b.note,
            recordedAt: b.recordedAt,
          }))
        : [],
      upgradeRules: Array.isArray(parsed.upgradeRules)
        ? (parsed.upgradeRules as UpgradeRule[]).map((u) => ({
            id: String(u.id ?? `${u.fromTypeId}-${u.toTypeId}`),
            fromTypeId: String(u.fromTypeId),
            toTypeId: String(u.toTypeId),
            allowed: u.allowed !== false,
            costPerNight: Number(u.costPerNight ?? 0),
            minTier: u.minTier,
          }))
        : [],
      bookings: (parsed.bookings as Booking[]).map((b, i) => ({
        id: String(b.id ?? `import-${b.code ?? i}`),
        code: String(b.code ?? `R-${i + 1}`),
        guestName: String(b.guestName ?? ''),
        channel: (CHANNELS.includes(b.channel as Channel) ? b.channel : 'direct') as Channel,
        tier: (TIERS.includes(b.tier as Tier) ? b.tier : 'standard') as Tier,
        createdAt: String(b.createdAt ?? '2026-01-01T00:00'),
        adults: Number(b.adults ?? 1),
        children: Number(b.children ?? 0),
        segments: Array.isArray(b.segments)
          ? b.segments.map((s2, j) => ({
              id: String(s2.id ?? `S${j + 1}`),
              roomTypeId: String(s2.roomTypeId),
              arrival: String(s2.arrival),
              departure: String(s2.departure),
              rooms: Number(s2.rooms ?? 1),
              actualArrival: s2.actualArrival,
              actualDeparture: s2.actualDeparture,
              actualRoomTypeId: s2.actualRoomTypeId,
              actualRecordedAt: s2.actualRecordedAt,
            }))
          : [],
        cancelledAt: b.cancelledAt,
        mergeGroupId: b.mergeGroupId,
        mergePrimary: b.mergePrimary,
        notes: b.notes,
      })),
    };
    return { dataset, messages };
  } catch (error) {
    return {
      dataset: null,
      messages: [{ row: 0, level: 'error', message: `JSON 解析失败：${(error as Error).message}` }],
    };
  }
}

export const BOOKINGS_CSV_TEMPLATE = `bookingCode,segmentId,guestName,channel,tier,createdAt,roomTypeId,arrival,departure,rooms,adults,children,cancelledAt,mergeGroupId,mergePrimary,actualArrival,actualDeparture,actualRoomTypeId,actualRecordedAt,notes
R-2001,S1,示例客人,member,gold,2026-10-01T09:00,STD,2026-11-15,2026-11-18,1,2,0,,,true,,,,,跨 3 晚
R-2002,S1,重复行示例,member,gold,2026-10-01T09:02,STD,2026-11-15,2026-11-18,1,2,0,,G-2001,false,,,,,同组非主记录不计容量`;

export const BLOCKS_CSV_TEMPLATE = `blockId,reason,roomTypeId,startDate,endDate,roomsBlocked,note,recordedAt
BLK-101,maintenance,STD,2026-11-18,2026-11-20,2,管道检修,2026-11-10T10:00
BLK-102,lock,,2026-11-22,2026-11-23,1,全房型锁房,2026-11-12T15:00`;
