import type { DateStr } from './date';

export type Tier = 'platinum' | 'gold' | 'silver' | 'standard';
export type Channel = 'member' | 'direct' | 'corporate' | 'ota' | 'group';
export type BlockReason = 'maintenance' | 'lock';
export type PriorityCriterion = 'tier' | 'channel' | 'createdAt' | 'stayLength';

export interface RoomType {
  id: string;
  name: string;
  shortName: string;
  totalRooms: number;
  maxOccupancy: number;
  sortOrder: number;
}

export interface BookingSegment {
  id: string;
  roomTypeId: string;
  arrival: DateStr;
  departure: DateStr;
  /** Physical rooms in this segment. A booking can hold several rooms across one or more segments. */
  rooms: number;
  /** Imported actual check-in date, when different from plan. */
  actualArrival?: DateStr;
  /** Imported actual check-out date, when different from plan. */
  actualDeparture?: DateStr;
  /** Room type actually occupied after a move or upgrade. */
  actualRoomTypeId?: string;
  /** When the actual-stay change was recorded. Replays never use changes recorded after the observation point. */
  actualRecordedAt?: string;
}

export interface Booking {
  id: string;
  code: string;
  guestName: string;
  channel: Channel;
  tier: Tier;
  createdAt: string;
  adults: number;
  children: number;
  segments: BookingSegment[];
  cancelledAt?: string;
  /** Records sharing a group represent the same stay; only the primary record is counted. */
  mergeGroupId?: string;
  mergePrimary?: boolean;
  notes?: string;
}

export interface CapacityBlock {
  id: string;
  reason: BlockReason;
  /** null applies the reduction to every room type. */
  roomTypeId: string | null;
  startDate: DateStr;
  /** Exclusive; a block ending on the 18th does not reduce the night of the 18th. */
  endDate: DateStr;
  roomsBlocked: number;
  note?: string;
  /** When the block was created. Blocks recorded after the observation point are not replayed. */
  recordedAt?: string;
}

export interface UpgradeRule {
  id: string;
  fromTypeId: string;
  toTypeId: string;
  allowed: boolean;
  costPerNight: number;
  minTier?: Tier;
}

export interface HotelInfo {
  name: string;
  /** First stay date in the window; the date itself is included. */
  windowStart: DateStr;
  /** Exclusive end: stays departing on this date are outside the window. */
  windowEnd: DateStr;
  /** Default observation point for replaying the window. */
  asOf: string;
}

export interface Dataset {
  hotel: HotelInfo;
  roomTypes: RoomType[];
  blocks: CapacityBlock[];
  upgradeRules: UpgradeRule[];
  bookings: Booking[];
}

export interface SimulationConfig {
  cancelRate: number;
  seed: number;
  trials: number;
}

export interface PageConfig {
  priority: PriorityCriterion[];
  maxUpgradeCostPerNight: number | null;
  simulation: SimulationConfig;
}

export const TIER_RANK: Record<Tier, number> = {
  platinum: 4,
  gold: 3,
  silver: 2,
  standard: 1,
};

export const TIER_LABEL: Record<Tier, string> = {
  platinum: '铂金',
  gold: '金卡',
  silver: '银卡',
  standard: '标准',
};

export const CHANNEL_RANK: Record<Channel, number> = {
  member: 5,
  direct: 4,
  corporate: 3,
  ota: 2,
  group: 1,
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  member: '会员直订',
  direct: '官网直订',
  corporate: '企业协议',
  ota: 'OTA',
  group: '团队',
};

export const BLOCK_REASON_LABEL: Record<BlockReason, string> = {
  maintenance: '维修封房',
  lock: '临时锁房',
};

export const DEFAULT_PRIORITY: PriorityCriterion[] = ['tier', 'channel', 'createdAt', 'stayLength'];

export const PRIORITY_LABEL: Record<PriorityCriterion, string> = {
  tier: '会员等级',
  channel: '预订渠道',
  createdAt: '创建时间',
  stayLength: '入住时长',
};

export const PRIORITY_DETAIL: Record<PriorityCriterion, string> = {
  tier: '铂金 > 金卡 > 银卡 > 标准',
  channel: '会员直订 > 官网直订 > 企业协议 > OTA > 团队',
  createdAt: '早创建先安置',
  stayLength: '住宿晚数多先安置',
};

export const TIER_OPTIONS: Tier[] = ['standard', 'silver', 'gold', 'platinum'];
