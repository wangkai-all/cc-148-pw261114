import { describe, expect, it } from 'vitest';
import { sampleDataset } from '../data/sample';
import { buildModel, computeCapacity, resolveSegment } from '../lib/model';
import { DEFAULT_PRIORITY, type Dataset, type PageConfig } from '../lib/types';
import { addDays, datesInRange, stayDates } from '../lib/date';
import { runSimulation } from '../lib/simulation';

const config: PageConfig = {
  priority: DEFAULT_PRIORITY,
  maxUpgradeCostPerNight: null,
  simulation: { cancelRate: 0.15, seed: 42, trials: 40 },
};

function clone(): Dataset {
  return JSON.parse(JSON.stringify(sampleDataset)) as Dataset;
}

describe('住宿日边界', () => {
  it('入住日计入、退房日不计入', () => {
    expect(stayDates('2026-11-14', '2026-11-16')).toEqual(['2026-11-14', '2026-11-15']);
    expect(datesInRange('2026-11-14', '2026-11-14')).toEqual([]);
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });

  it('容量窗口是半开区间', () => {
    const days = datesInRange('2026-11-12', '2026-11-26');
    expect(days[0]).toBe('2026-11-12');
    expect(days[days.length - 1]).toBe('2026-11-25');
    expect(days).toHaveLength(14);
  });
});

describe('取消时间回放', () => {
  it('观察时点之后取消的预订仍计为已订', () => {
    const model = buildModel(clone(), config, '2026-11-14T08:00');
    expect(model.demandByBooking.has('BK-006')).toBe(true);
    expect(model.summary.canceledLaterCount).toBe(1);
    expect(model.summary.canceledBeforeAsOfCount).toBe(1);
  });

  it('把观察时点移到取消之后, 该预订不再占用容量', () => {
    const early = buildModel(clone(), config, '2026-11-14T08:00');
    const late = buildModel(clone(), config, '2026-11-16T08:00');
    expect(early.demandByBooking.has('BK-006')).toBe(true);
    expect(late.demandByBooking.has('BK-006')).toBe(false);
    expect(late.grid.get('DLX|2026-11-14')!.demandRooms).toBe(0);
    expect(early.grid.get('DLX|2026-11-14')!.demandRooms).toBe(1);
  });

  it('创建时间晚于观察时点的预订不参与回放', () => {
    const model = buildModel(clone(), config, '2026-11-13T12:00');
    expect(model.demandByBooking.has('BK-019')).toBe(false);
  });
});

describe('维修与锁房', () => {
  it('按日期扣减对应房型容量, 结束日不扣减', () => {
    const capacity = computeCapacity(clone(), datesInRange('2026-11-15', '2026-11-20'), '2026-11-14T08:00');
    const std = capacity.get('STD')!;
    expect(std.get('2026-11-15')!.blocked).toBe(0);
    expect(std.get('2026-11-16')!.blocked).toBe(4);
    expect(std.get('2026-11-18')!.blocked).toBe(4);
    expect(std.get('2026-11-19')!.blocked).toBe(0);
    expect(std.get('2026-11-16')!.capacity).toBe(8);
  });

  it('晚于观察时点记录的封房不扣减回放容量', () => {
    const early = computeCapacity(clone(), ['2026-11-24'], '2026-11-14T08:00');
    const late = computeCapacity(clone(), ['2026-11-24'], '2026-11-15T08:00');
    expect(early.get('STD')!.get('2026-11-24')!.blocked).toBe(0);
    expect(early.get('STD')!.get('2026-11-24')!.lateBlockIds).toContain('BLK-3');
    expect(late.get('STD')!.get('2026-11-24')!.blocked).toBe(1);
  });

  it('全房型封房会扣减每个房型', () => {
    const capacity = computeCapacity(clone(), ['2026-11-24'], '2026-11-15T08:00');
    for (const typeId of ['STD', 'DLX', 'SUP', 'FAM']) {
      expect(capacity.get(typeId)!.get('2026-11-24')!.blocked).toBe(1);
    }
  });
});

describe('拆房与合并去重', () => {
  it('合并组只计主记录', () => {
    const model = buildModel(clone(), config, '2026-11-14T08:00');
    const ids = model.demand.map((d) => d.booking.id);
    expect(ids).toContain('BK-008');
    expect(ids).not.toContain('BK-009');
    const sup = model.grid.get('SUP|2026-11-13')!;
    expect(sup.demandRooms).toBe(1);
  });

  it('同一预订同房型相邻两段不会重复计间夜', () => {
    const model = buildModel(clone(), config, '2026-11-14T08:00');
    const demand = model.demandByBooking.get('BK-015')!;
    expect(demand.dates).toEqual([
      '2026-11-21',
      '2026-11-22',
      '2026-11-23',
      '2026-11-24',
    ]);
    const total = [...demand.nights.values()].reduce((s, n) => s + n.rooms, 0);
    expect(total).toBe(8);
  });

  it('拆房预订在夜间记录里保留每段房型', () => {
    const model = buildModel(clone(), config, '2026-11-14T08:00');
    const demand = model.demandByBooking.get('BK-005')!;
    expect(demand.nights.get('2026-11-17|STD')?.rooms).toBe(1);
    expect(demand.nights.get('2026-11-19|DLX')?.rooms).toBe(1);
    expect(demand.dates).toEqual([
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
    ]);
  });
});

describe('实际入住变更', () => {
  it('已知的提前退房释放后续夜晚', () => {
    const model = buildModel(clone(), config, '2026-11-14T08:00');
    const demand = model.demandByBooking.get('BK-011')!;
    expect(demand.actualNights.size).toBe(2);
    expect(demand.plannedNights.size).toBe(0);
    expect(demand.releasedNights).toEqual(['2026-11-18', '2026-11-19']);
    expect(demand.nights.has('2026-11-18|DLX')).toBe(false);
    expect(demand.nights.has('2026-11-19|DLX')).toBe(false);
  });

  it('晚于观察时点记录的实际变更不美化回放', () => {
    const model = buildModel(clone(), config, '2026-11-14T08:00');
    const demand = model.demandByBooking.get('BK-012')!;
    expect(demand.actualNights.size).toBe(0);
    // Planned stay 11/13-11/16 still occupies 11/15
    expect(demand.nights.has('2026-11-15|FAM')).toBe(true);
    expect(demand.releasedNights).toEqual([]);
    const later = buildModel(clone(), config, '2026-11-14T11:00');
    const laterDemand = later.demandByBooking.get('BK-012')!;
    expect([...laterDemand.actualNights.values()].some((n) => n.date === '2026-11-17')).toBe(true);
    expect(laterDemand.releasedNights).toEqual([]);
  });

  it('实际入住按变更后的日期占用, 并记录释放的夜晚', () => {
    const segment = {
      id: 'S1',
      roomTypeId: 'DLX',
      arrival: '2026-11-16',
      departure: '2026-11-20',
      rooms: 1,
      actualArrival: '2026-11-16',
      actualDeparture: '2026-11-18',
      actualRecordedAt: '2026-11-13T21:30',
    };
    const resolved = resolveSegment(
      segment,
      '2026-11-14',
      '2026-11-14T08:00',
      '2026-11-12',
      '2026-11-26',
      new Set(['DLX']),
    )!;
    expect(resolved.actualNights.map((n) => n.date)).toEqual(['2026-11-16', '2026-11-17']);
    expect(resolved.releasedNights).toEqual(['2026-11-18', '2026-11-19']);
    expect(resolved.note).toContain('提前退房');
  });
});

describe('超售与升级', () => {
  it('升级数量与成本可追溯到规则', () => {
    const model = buildModel(clone(), config, '2026-11-14T08:00');
    const upgraded = model.allocations.filter((a) => a.action === 'upgraded');
    expect(upgraded.length).toBeGreaterThan(0);
    for (const a of upgraded) {
      expect(a.assignedTypeId).not.toBe(a.homeTypeId);
      expect(a.upgradeRuleIds.length).toBeGreaterThan(0);
      expect(a.trace.some((t) => t.kind === 'upgrade')).toBe(true);
    }
  });

  it('未安置房量不写入任何房型占用', () => {
    const model = buildModel(clone(), config, '2026-11-14T08:00');
    const unplaced = model.allocations.filter((a) => a.action === 'unplaced');
    for (const a of unplaced) {
      expect(a.assignedTypeId).toBeNull();
      const cellCount = [...model.grid.values()]
        .filter((c) => c.date === a.date)
        .reduce((s, c) => s + c.allocatedRooms, 0);
      expect(cellCount).toBeLessThanOrEqual(
        [...model.grid.values()]
          .filter((c) => c.date === a.date)
          .reduce((s, c) => s + c.capacity, 0),
      );
    }
  });

  it('任何房型任何一天已安置不超过可售', () => {
    const model = buildModel(clone(), config, '2026-11-14T08:00');
    for (const cell of model.grid.values()) {
      expect(cell.allocatedRooms).toBeLessThanOrEqual(cell.capacity);
    }
  });

  it('未启用的升级链路不会被使用', () => {
    const model = buildModel(clone(), config, '2026-11-14T08:00');
    const famToSup = model.allocations.filter(
      (a) => a.homeTypeId === 'FAM' && a.assignedTypeId === 'SUP',
    );
    expect(famToSup).toHaveLength(0);
  });

  it('会员等级限制会阻止铂金以下的链路上的升房', () => {
    const dataset = clone();
    const gold = dataset.bookings.find((b) => b.id === 'BK-002')!;
    expect(gold.tier).toBe('gold');
    const model = buildModel(dataset, config, '2026-11-14T08:00');
    for (const a of model.allocations) {
      if (a.action !== 'upgraded') continue;
      const booking = dataset.bookings.find((b) => b.id === a.bookingId)!;
      if (a.homeTypeId === 'STD' && a.assignedTypeId === 'SUP') {
        expect(['gold', 'platinum']).toContain(booking.tier);
      }
    }
  });

  it('成本上限被严格执行', () => {
    const capped: PageConfig = { ...config, maxUpgradeCostPerNight: 150 };
    const model = buildModel(clone(), capped, '2026-11-14T08:00');
    expect(model.summary.upgradeCost).toBeGreaterThanOrEqual(0);
    for (const a of model.allocations) {
      if (a.action !== 'upgraded') continue;
      expect(a.upgradeCostPerRoomNight).toBeLessThanOrEqual(150);
    }
  });
});

describe('模拟', () => {
  it('同一随机种子结果可复现', () => {
    const model = buildModel(clone(), config, '2026-11-14T08:00');
    const a = runSimulation(clone(), config, '2026-11-14T08:00', model);
    const b = runSimulation(clone(), config, '2026-11-14T08:00', model);
    expect(a.trials.map((t) => t.unplacedRooms)).toEqual(b.trials.map((t) => t.unplacedRooms));
    expect(a.seed).toBe(config.simulation.seed);
  });

  it('不同种子产生不同抽样', () => {
    const model = buildModel(clone(), config, '2026-11-14T08:00');
    const a = runSimulation(clone(), config, '2026-11-14T08:00', model);
    const other = { ...config, simulation: { ...config.simulation, seed: 7 } };
    const b = runSimulation(clone(), other, '2026-11-14T08:00', model);
    expect(a.trials.map((t) => t.canceledBookingIds.join(','))).not.toEqual(
      b.trials.map((t) => t.canceledBookingIds.join(',')),
    );
  });

  it('实际发生与模拟结果分开呈现, 实际值来自确定性回放', () => {
    const model = buildModel(clone(), config, '2026-11-14T08:00');
    const sim = runSimulation(clone(), config, '2026-11-14T08:00', model);
    expect(sim.deterministic.unplacedRooms).toBe(model.summary.unplacedRooms);
    expect(sim.bands.unplacedRooms.p10).toBeLessThanOrEqual(sim.bands.unplacedRooms.p90);
  });

  it('已取消与有实际入住的预订不进入抽样池', () => {
    const model = buildModel(clone(), config, '2026-11-14T08:00');
    const sim = runSimulation(clone(), config, '2026-11-14T08:00', model);
    const allCanceled = new Set(sim.trials.flatMap((t) => t.canceledBookingIds));
    expect(allCanceled.has('BK-006')).toBe(false);
    expect(allCanceled.has('BK-007')).toBe(false);
    expect(allCanceled.has('BK-011')).toBe(false);
  });

  it('直方图覆盖每个取整区间且计数之和等于抽样次数', () => {
    const model = buildModel(clone(), config, '2026-11-14T08:00');
    const sim = runSimulation(clone(), config, '2026-11-14T08:00', model);
    const max = sim.bands.unplacedRooms.max;
    expect(sim.histogram.length).toBe(max + 1);
    sim.histogram.forEach((h) => expect(h.to - h.from).toBe(1));
    expect(sim.histogram.reduce((s, h) => s + h.count, 0)).toBe(sim.trials.length);
    const p50Bucket = sim.histogram[sim.bands.unplacedRooms.p50];
    expect(p50Bucket.count).toBeGreaterThan(0);
  });
});
