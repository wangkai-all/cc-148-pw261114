import { useMemo, useState } from 'react';
import type { BookingArrangement, Model } from '../lib/model';
import { TIER_LABEL } from '../lib/types';

type View = 'all' | 'unplaced' | 'upgraded' | 'split' | 'actual' | 'released';

const VIEWS: { id: View; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'unplaced', label: '未安置' },
  { id: 'upgraded', label: '升级' },
  { id: 'split', label: '拆房/拆晚' },
  { id: 'actual', label: '实际入住' },
  { id: 'released', label: '提前退房释放' },
];

interface Props {
  model: Model;
  selectedId: string | null;
  onSelect: (bookingId: string) => void;
}

export function ArrangementTable({ model, selectedId, onSelect }: Props) {
  const [view, setView] = useState<View>('all');

  const rows = useMemo(() => {
    return model.arrangements
      .filter((a) => {
        switch (view) {
          case 'unplaced':
            return a.unplacedRooms > 0;
          case 'upgraded':
            return a.upgradedRooms > 0;
          case 'split':
            return a.split;
          case 'actual':
            return a.hasActual;
          case 'released':
            return a.releasedNights.length > 0;
          default:
            return true;
        }
      })
      .sort((a, b) => a.priorityRank - b.priorityRank);
  }, [model, view]);

  return (
    <section className="card" aria-labelledby="arrangement-title">
      <div className="card-head">
        <div>
          <h2 id="arrangement-title">按优先级回放的安置结果</h2>
          <div className="hint">每一行都能追溯到房量、封房、优先级与升级约束；未安置不会用不存在的房量补齐。</div>
        </div>
        <div className="segmented" role="group" aria-label="筛选安置结果">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty">该筛选下没有预订。</div>
      ) : (
        <div className="table-wrap">
          <table className="data" aria-label="预订安置结果">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>预订</th>
                <th>客人 / 等级</th>
                <th>住宿</th>
                <th>计划房型</th>
                <th>最终房型</th>
                <th className="num">已安置</th>
                <th className="num">未安置</th>
                <th className="num">升级成本</th>
                <th>标记</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr
                  key={a.bookingId}
                  className={selectedId === a.bookingId ? 'selected' : undefined}
                  onClick={() => onSelect(a.bookingId)}
                >
                  <td className="num">{a.priorityRank}</td>
                  <td>
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: '2px 8px', minHeight: 26 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(a.bookingId);
                      }}
                      aria-label={`打开预订 ${a.code}`}
                    >
                      {a.code}
                    </button>
                  </td>
                  <td>
                    {a.guestName}
                    <div className="tiny">{TIER_LABEL[a.tier]} · {a.channel}</div>
                  </td>
                  <td className="mono">
                    {a.stayStart.slice(5)} → {a.stayEnd.slice(5)}
                    <div className="tiny">{a.dates.length} 晚</div>
                  </td>
                  <td>{a.homeTypeIds.map((id) => model.roomTypeById.get(id)?.shortName ?? id).join('/')}</td>
                  <td>
                    {a.finalTypeIds.length === 0
                      ? '未安置'
                      : a.finalTypeIds.map((id) => model.roomTypeById.get(id)?.shortName ?? id).join('/')}
                  </td>
                  <td className="num">{a.allocatedRooms}</td>
                  <td className="num" style={{ color: a.unplacedRooms > 0 ? 'var(--critical)' : undefined }}>
                    {a.unplacedRooms || '—'}
                  </td>
                  <td className="num">{a.upgradeCost > 0 ? `¥${a.upgradeCost}` : '—'}</td>
                  <td>
                    <div className="chips">
                      {a.unplacedRooms > 0 ? <span className="pill critical">未安置 {a.unplacedNights} 晚</span> : null}
                      {a.upgradedRooms > 0 ? <span className="pill series">升级 {a.upgradedRooms} 间</span> : null}
                      {a.split ? <span className="pill warning">拆房/拆晚</span> : null}
                      {a.hasActual ? <span className="pill good">实际入住</span> : null}
                      {a.releasedNights.length > 0 ? (
                        <span className="pill" title={a.releasedNights.join('、')}>
                          释放 {a.releasedNights.length} 晚
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export type { BookingArrangement };
