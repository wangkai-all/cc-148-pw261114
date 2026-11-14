import { useEffect, useRef } from 'react';
import type { DateStr } from '../lib/date';
import { dateLabel, formatTimestamp, formatDateFull, weekdayShort } from '../lib/date';
import type { NightAllocation, Model } from '../lib/model';
import { cellKey } from '../lib/model';
import { TIER_LABEL } from '../lib/types';

interface Props {
  model: Model;
  date: DateStr;
  roomTypeId: string | null;
  onClose: () => void;
  onSelectBooking: (bookingId: string) => void;
}

function actionLabel(a: NightAllocation): string {
  switch (a.action) {
    case 'actual':
      return '实际入住';
    case 'kept':
      return '原房型';
    case 'upgraded':
      return '升级';
    case 'unplaced':
      return '未安置';
  }
}

function actionTone(a: NightAllocation): string {
  switch (a.action) {
    case 'actual':
      return 'good';
    case 'upgraded':
      return 'series';
    case 'unplaced':
      return 'critical';
    default:
      return '';
  }
}

export function NightDetail({ model, date, roomTypeId, onClose, onSelectBooking }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const records = (model.nightRecords.get(date) ?? []).filter(
    (a) => (roomTypeId ? a.homeTypeId === roomTypeId || a.assignedTypeId === roomTypeId : true),
  );
  const stays = [...new Set(records.map((a) => a.bookingId))].map((id) => ({
    bookingId: id,
    allocations: records.filter((a) => a.bookingId === id),
    arrangement: model.arrangementByBooking.get(id)!,
    demand: model.demandByBooking.get(id)!,
  }));

  const cells = roomTypeId
    ? [model.grid.get(cellKey(roomTypeId, date))!]
    : model.roomTypes.map((t) => model.grid.get(cellKey(t.id, date))!);

  const totals = cells.reduce(
    (sum, c) => ({
      capacity: sum.capacity + c.capacity,
      demand: sum.demand + c.demandRooms,
      allocated: sum.allocated + c.allocatedRooms,
      actual: sum.actual + c.actualRooms,
      unplaced: sum.unplaced + c.unplacedRooms,
      oversold: sum.oversold + c.oversold,
    }),
    { capacity: 0, demand: 0, allocated: 0, actual: 0, unplaced: 0, oversold: 0 },
  );

  const title = roomTypeId
    ? `${model.roomTypeById.get(roomTypeId)?.name ?? roomTypeId} · ${dateLabel(date)}`
    : `全酒店 · ${dateLabel(date)}`;
  const rooms = model.roomTypes;

  return (
    <dialog className="modal" ref={dialogRef} onClose={onClose} aria-label={`${title} 当晚占用明细`}>
      <div className="modal-head">
        <div>
          <h2>{title}</h2>
          <div className="sub">
            {formatDateFull(date)} · {weekdayShort(date)} 住宿夜 · 回放时点 {formatTimestamp(model.asOf)}
          </div>
        </div>
        <button className="close-btn" type="button" onClick={onClose} aria-label="关闭">
          关闭
        </button>
      </div>
      <div className="modal-body">
        <div className="breakdown">
          <div className="b">
            <div className="l">可售容量</div>
            <div className="v">{totals.capacity}</div>
          </div>
          <div className="b">
            <div className="l">已订（含后续取消）</div>
            <div className="v">{totals.demand}</div>
          </div>
          <div className="b">
            <div className="l">已安置</div>
            <div className="v">{totals.allocated}</div>
          </div>
          <div className="b">
            <div className="l">其中实际入住</div>
            <div className="v">{totals.actual}</div>
          </div>
          <div className="b">
            <div className="l">未安置</div>
            <div className="v">{totals.unplaced}</div>
          </div>
          <div className="b">
            <div className="l">超售</div>
            <div className="v" style={{ color: totals.oversold > 0 ? 'var(--critical)' : undefined }}>
              {totals.oversold}
            </div>
          </div>
        </div>

        {roomTypeId ? (
          <div className="filter-note">
            已按房型筛选：{model.roomTypeById.get(roomTypeId)?.name}。列表同时显示自该房型升级出去与升级进入的预订。
          </div>
        ) : null}

        <div className="table-wrap" style={{ marginBottom: 14 }}>
          <table className="data" aria-label="当晚各房型占用汇总">
            <thead>
              <tr>
                <th>房型</th>
                <th className="num">总房量</th>
                <th className="num">维修/锁房</th>
                <th className="num">可售</th>
                <th className="num">已订</th>
                <th className="num">已安置</th>
                <th className="num">实际</th>
                <th className="num">未安置</th>
              </tr>
            </thead>
            <tbody>
              {cells.map((c) => {
                const type = model.roomTypeById.get(c.roomTypeId)!;
                const releasedHere = stays.filter((s) =>
                  s.arrangement.releasedNights.includes(date) && s.arrangement.homeTypeIds.includes(c.roomTypeId),
                ).length;
                return (
                  <tr key={c.roomTypeId}>
                    <td>{type.name}</td>
                    <td className="num">{c.total}</td>
                    <td className="num">{c.blocked || '—'}</td>
                    <td className="num">{c.capacity}</td>
                    <td className="num">{c.demandRooms}</td>
                    <td className="num">{c.allocatedRooms}</td>
                    <td className="num">{c.actualRooms || '—'}</td>
                    <td className="num">{c.unplacedRooms || '—'}</td>
                    {releasedHere > 0 ? <td className="tiny">有 {releasedHere} 单提前退房释放</td> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h3 style={{ fontSize: 13, margin: '0 0 8px' }}>当晚在住 / 在订的预订（{stays.length} 单）</h3>
        {stays.length === 0 ? (
          <div className="empty">当晚没有预订占用。可用于确认封房后的空档。</div>
        ) : (
          stays.map(({ bookingId, allocations, arrangement, demand }) => (
            <div className="night-booking" key={bookingId}>
              <header>
                <div>
                  <span className="who">
                    {arrangement.guestName} <span className="dim">{arrangement.code}</span>
                  </span>
                  <div className="meta">
                    {TIER_LABEL[arrangement.tier]} · {arrangement.channel} · 优先级 #{arrangement.priorityRank} ·
                    住宿 {demand.stayStart} → {demand.stayEnd}（退房日不计）
                  </div>
                </div>
                <div className="chips">
                  {allocations.map((a, i) => (
                    <span
                      key={`${a.assignedTypeId}-${i}`}
                      className={`chip ${a.action === 'unplaced' ? 'released' : ''} ${a.action === 'actual' ? 'actual' : ''}`}
                      title={`${a.homeTypeId} → ${a.assignedTypeId ?? '未安置'} ${a.rooms} 间`}
                    >
                      {rooms.find((t) => t.id === a.assignedTypeId)?.shortName ?? '未安置'} {a.rooms} 间 · {actionLabel(a)}
                    </span>
                  ))}
                </div>
              </header>
              <div className="tiny" style={{ marginTop: 4 }}>
                计划 {arrangement.homeTypeIds.map((id) => rooms.find((r) => r.id === id)?.name ?? id).join(' + ')} ·
                该晚已{demand.releasedNights.includes(date) ? '释放（提前退房）' : '占用'} · 全程最终房型{' '}
                {arrangement.finalTypeIds.map((id) => rooms.find((r) => r.id === id)?.shortName ?? id).join('/') || '未安置'}
              </div>
              {allocations.map((a, i) => (
                <div key={`trace-${i}`}>
                  <div className="chips" style={{ marginTop: 6 }}>
                    <span className={`pill ${actionTone(a)}`}>{actionLabel(a)}</span>
                    <span className="pill">
                      {rooms.find((t) => t.id === a.homeTypeId)?.shortName} →{' '}
                      {a.assignedTypeId ? rooms.find((t) => t.id === a.assignedTypeId)?.shortName : '未安置'}
                    </span>
                    {a.upgradeCostPerRoomNight > 0 ? (
                      <span className="pill series">升级成本 ¥{a.upgradeCostPerRoomNight}/间/晚</span>
                    ) : null}
                    {a.upgradeRuleIds.length > 0 ? (
                      <span className="pill">规则 {a.upgradeRuleIds.join(' → ')}</span>
                    ) : null}
                  </div>
                  <details className="inspector">
                    <summary>查看约束追溯（{a.trace.length} 条）</summary>
                    <ul className="trace">
                      {a.trace.map((t, j) => (
                        <li key={j} className={`k-${t.kind}`}>
                          {t.text}
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              ))}
              <div style={{ marginTop: 6 }}>
                <button className="btn" type="button" onClick={() => onSelectBooking(bookingId)}>
                  打开整单
                </button>
              </div>
            </div>
          ))
        )}

        {roomTypeId ? (
          <div className="tiny" style={{ marginTop: 10 }}>
            该格：{model.grid.get(cellKey(roomTypeId, date))!.bookingCodes.length > 0
              ? `涉及 ${model.grid.get(cellKey(roomTypeId, date))!.bookingCodes.join('、')}`
              : '当日无预订需求'}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
