import { useEffect, useRef } from 'react';
import { formatTimestamp } from '../lib/date';
import type { Model } from '../lib/model';
import { TIER_LABEL } from '../lib/types';

interface Props {
  model: Model;
  bookingId: string;
  onClose: () => void;
}

export function BookingInspector({ model, bookingId, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [bookingId]);

  const demand = model.demandByBooking.get(bookingId);
  const arrangement = model.arrangementByBooking.get(bookingId);
  if (!demand || !arrangement) {
    return (
      <dialog className="modal" ref={ref} onClose={onClose} aria-label="预订不存在">
        <div className="modal-head">
          <h2>该预订不在当前回放中</h2>
          <button className="close-btn" type="button" onClick={onClose} aria-label="关闭">
            关闭
          </button>
        </div>
      </dialog>
    );
  }

  const typeName = (id: string | null | undefined) =>
    id ? model.roomTypeById.get(id)?.name ?? id : '未安置';

  const perDate = new Map<string, typeof arrangement.allocations>();
  for (const a of arrangement.allocations) {
    const list = perDate.get(a.date) ?? [];
    list.push(a);
    perDate.set(a.date, list);
  }

  return (
    <dialog className="modal" ref={ref} onClose={onClose} aria-label={`预订 ${arrangement.code} 明细`}>
      <div className="modal-head">
        <div>
          <h2>
            {arrangement.guestName} · <span className="mono">{arrangement.code}</span>
          </h2>
          <div className="sub">
            {TIER_LABEL[arrangement.tier]} · {arrangement.channel} · 创建 {formatTimestamp(demand.booking.createdAt)} ·
            优先级 #{arrangement.priorityRank}（{arrangement.prioritySummary}）
          </div>
        </div>
        <button className="close-btn" type="button" onClick={onClose} aria-label="关闭">
          关闭
        </button>
      </div>
      <div className="modal-body">
        <div className="breakdown">
          <div className="b">
            <div className="l">住宿区间</div>
            <div className="v" style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
              {demand.stayStart.slice(5)} → {demand.stayEnd.slice(5)}
              <span className="tiny" style={{ display: 'block', fontWeight: 400 }}>
                {demand.stayStart.slice(0, 4)} 年 · 退房日不占用
              </span>
            </div>
          </div>
          <div className="b">
            <div className="l">已安置 / 未安置</div>
            <div className="v">
              {arrangement.allocatedRooms} / {arrangement.unplacedRooms}
            </div>
          </div>
          <div className="b">
            <div className="l">升级成本</div>
            <div className="v">¥{arrangement.upgradeCost}</div>
          </div>
          <div className="b">
            <div className="l">人数</div>
            <div className="v" style={{ fontSize: 16 }}>
              {demand.booking.adults} 成人{demand.booking.children ? ` · ${demand.booking.children} 儿童` : ''}
            </div>
          </div>
        </div>

        <h3 style={{ fontSize: 13 }}>住宿段（导入原始记录）</h3>
        <div className="table-wrap" style={{ marginBottom: 12 }}>
          <table className="data">
            <thead>
              <tr>
                <th>段</th>
                <th>房型</th>
                <th>计划日期</th>
                <th>间数</th>
                <th>实际 / 说明</th>
              </tr>
            </thead>
            <tbody>
              {demand.segments.map((s) => (
                <tr key={s.segment.id}>
                  <td>{s.segment.id}</td>
                  <td>{typeName(s.plannedTypeId)}</td>
                  <td className="mono">
                    {s.plannedStart} → {s.plannedEnd}
                  </td>
                  <td className="num">{s.segment.rooms}</td>
                  <td>
                    <span className={s.actualKnown ? '' : 'dim'}>{s.note}</span>
                    {s.releasedNights.length > 0 ? (
                      <div className="chips" style={{ marginTop: 3 }}>
                        {s.releasedNights.map((d) => (
                          <span className="chip released" key={d}>
                            {d}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ fontSize: 13 }}>逐晚安置与约束</h3>
        {[...perDate.entries()].map(([date, allocations]) => (
          <div className="night-booking" key={date}>
            <header>
              <div className="who">{date}</div>
              <div className="chips">
                {allocations.map((a, i) => (
                  <span key={i} className={`chip ${a.action === 'unplaced' ? 'released' : ''} ${a.action === 'actual' ? 'actual' : ''}`}>
                    {typeName(a.homeTypeId)} → {typeName(a.assignedTypeId)} · {a.rooms} 间
                  </span>
                ))}
              </div>
            </header>
            {allocations.map((a, i) => (
              <details className="inspector" key={i} open={allocations.length === 1}>
                <summary>
                  {a.action === 'actual'
                    ? '实际入住锁定'
                    : a.action === 'unplaced'
                      ? '未安置原因'
                      : a.action === 'upgraded'
                        ? '升级理由与成本'
                        : '房量判定'}{' '}
                  · {a.trace.length} 条
                </summary>
                <ul className="trace">
                  {a.trace.map((t, j) => (
                    <li key={j} className={`k-${t.kind}`}>
                      {t.text}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        ))}
        {arrangement.releasedNights.length > 0 ? (
          <p className="tiny">
            提前退房释放的夜晚：{arrangement.releasedNights.join('、')}（已从后续容量中释放，可被其他预订使用）
          </p>
        ) : null}
        {demand.booking.notes ? <p className="tiny">备注：{demand.booking.notes}</p> : null}
      </div>
    </dialog>
  );
}
