import { useMemo, useState } from 'react';
import type { DateStr } from '../lib/date';
import { dateLabel, weekdayShort } from '../lib/date';
import type { GridCell, Model } from '../lib/model';
import { cellKey } from '../lib/model';
import { heatLegendText, occupancyColor, type CapacityMode } from '../lib/ui';
import { percentText } from '../lib/ui';

interface Props {
  model: Model;
  mode: CapacityMode;
  onPick: (date: DateStr, roomTypeId: string | null) => void;
}

function flagsFor(cell: GridCell, mode: CapacityMode): { text: string; tone: string }[] {
  const flags: { text: string; tone: string }[] = [];
  if (cell.oversold > 0) flags.push({ text: `超售 ${cell.oversold}`, tone: 'critical' });
  if (cell.blocked > 0) flags.push({ text: `封房 ${cell.blocked}`, tone: 'plain' });
  if (cell.lateBlockIds.length > 0) flags.push({ text: `后录封房 ${cell.lateBlockIds.length}`, tone: 'plain' });
  if (mode === 'allocated' && cell.unplacedRooms > 0) flags.push({ text: `未安置 ${cell.unplacedRooms}`, tone: 'warning' });
  if (cell.actualRooms > 0) flags.push({ text: `实际 ${cell.actualRooms}`, tone: 'good' });
  return flags;
}

export function CapacityGrid({ model, mode, onPick }: Props) {
  const [tableView, setTableView] = useState(false);
  const [hideZero, setHideZero] = useState(false);

  const dates = useMemo(
    () => (hideZero ? model.windowDates.filter((d) => model.roomTypes.some((t) => {
      const cell = model.grid.get(cellKey(t.id, d));
      return cell && (cell.demandRooms > 0 || cell.blocked > 0);
    })) : model.windowDates),
    [model, hideZero],
  );

  const totals = useMemo(
    () =>
      dates.map((date) => {
        let capacity = 0;
        let booked = 0;
        let blocked = 0;
        let actual = 0;
        let oversold = 0;
        for (const type of model.roomTypes) {
          const cell = model.grid.get(cellKey(type.id, date))!;
          capacity += cell.capacity;
          blocked += cell.blocked;
          booked += mode === 'demand' ? cell.demandRooms : cell.allocatedRooms;
          actual += cell.actualRooms;
          oversold += cell.oversold;
        }
        return { date, capacity, booked, sellable: Math.max(0, capacity - booked), blocked, actual, oversold };
      }),
    [dates, model, mode],
  );

  return (
    <section className="card" aria-labelledby="grid-title">
      <div className="card-head">
        <div>
          <h2 id="grid-title">可售日历</h2>
          <div className="hint">
            入住日计入、退房日不计入；单位为间。点任一格查看当晚跨夜占用明细与逐条追溯。
          </div>
        </div>
        <div className="header-actions">
          <label className="switch">
            <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
            隐藏空闲日
          </label>
          <button className="btn" type="button" onClick={() => setTableView((v) => !v)} aria-pressed={tableView}>
            {tableView ? '看日历' : '看表格'}
          </button>
        </div>
      </div>

      <div className="legend" aria-label="图例">
        <span className="ramp" aria-hidden="true">
          <span style={{ background: 'var(--seq-1)' }} />
          <span style={{ background: 'var(--seq-2)' }} />
          <span style={{ background: 'var(--seq-3)' }} />
          <span style={{ background: 'var(--seq-4)' }} />
          <span style={{ background: 'var(--seq-5)' }} />
          <span style={{ background: 'var(--seq-6)' }} />
        </span>
        <span>{heatLegendText()}</span>
        <span>
          <span className="swatch" style={{ background: 'var(--series-2)' }} />
          超售（已订超过可售）
        </span>
        <span>
          <span className="swatch" style={{ background: 'var(--badge-bg)' }} />
          维修/锁房扣减
        </span>
        <span className="dim">大字为{mode === 'demand' ? '可售' : '剩余可售'}，小字为已{mode === 'demand' ? '订' : '安置'}/可售</span>
      </div>

      {!tableView ? (
        <div className="grid-scroll">
          <table className="capacity-grid" role="table" aria-label="按住宿日与房型的可售日历">
            <thead>
              <tr>
                <th scope="col" className="row-head">
                  房型 / 住宿日
                </th>
                {dates.map((date) => (
                  <th key={date} scope="col">
                    <span className="day">{dateLabel(date)}</span>
                    <span className="wd">{weekdayShort(date)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.roomTypes.map((type) => (
                <tr key={type.id}>
                  <th scope="row" className="row-head">
                    <div className="row-head-cell">
                      <div className="rn">{type.name}</div>
                      <div className="rm">
                        {type.totalRooms} 间 · 至多 {type.maxOccupancy} 人
                      </div>
                    </div>
                  </th>
                  {dates.map((date) => {
                    const cell = model.grid.get(cellKey(type.id, date))!;
                    const { color, onDark } = occupancyColor(cell);
                    const booked = mode === 'demand' ? cell.demandRooms : cell.allocatedRooms;
                    const sellable = Math.max(0, cell.capacity - booked);
                    const flags = flagsFor(cell, mode);
                    return (
                      <td key={date}>
                        <button
                          type="button"
                          className={`cell${onDark ? ' on-dark' : ''}`}
                          style={{ background: color }}
                          aria-label={`${type.name} ${dateLabel(date)} 可售${sellable}间 已${
                            mode === 'demand' ? '订' : '安置'
                          }${booked}间 可售容量${cell.capacity}间${cell.oversold ? ` 超售${cell.oversold}间` : ''}`}
                          onClick={() => onPick(date, type.id)}
                        >
                          <span className="cell-top">
                            <span className="big">{sellable}</span>
                            <span className="small">
                              {booked}/{cell.capacity}
                            </span>
                          </span>
                          <span className="cell-bottom">
                            {flags.map((f) => (
                              <span key={f.text} className={`flag ${f.tone}`}>
                                {f.text}
                              </span>
                            ))}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <th scope="row" className="row-head">
                  <div className="row-head-cell">
                    <div className="rn">全酒店</div>
                    <div className="rm">汇总可售 / 已{mode === 'demand' ? '订' : '安置'}</div>
                  </div>
                </th>
                {totals.map((t) => (
                  <td key={t.date}>
                    <button
                      type="button"
                      className={`cell${t.oversold > 0 ? ' on-dark' : ''}`}
                      style={{ background: t.oversold > 0 ? 'var(--series-2)' : 'var(--surface-1)', border: '1px solid var(--border)' }}
                      aria-label={`全酒店 ${dateLabel(t.date)} 可售${t.sellable}间 已${mode === 'demand' ? '订' : '安置'}${t.booked}间`}
                      onClick={() => onPick(t.date, null)}
                    >
                      <span className="cell-top">
                        <span className="big">{t.sellable}</span>
                        <span className="small">
                          {t.booked}/{t.capacity}
                        </span>
                      </span>
                      <span className="cell-bottom">
                        {t.oversold > 0 ? <span className="flag">超售 {t.oversold}</span> : null}
                        {t.blocked > 0 ? <span className="flag">封房 {t.blocked}</span> : null}
                        {t.actual > 0 ? <span className="flag">实际 {t.actual}</span> : null}
                      </span>
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data" aria-label="可售日历表格视图">
            <thead>
              <tr>
                <th>住宿日</th>
                <th>房型</th>
                <th className="num">总房量</th>
                <th className="num">维修/锁房</th>
                <th className="num">可售</th>
                <th className="num">已订</th>
                <th className="num">已安置</th>
                <th className="num">实际占用</th>
                <th className="num">未安置</th>
                <th className="num">超售</th>
                <th className="num">入住率</th>
              </tr>
            </thead>
            <tbody>
              {dates.flatMap((date) =>
                model.roomTypes.map((type) => {
                  const cell = model.grid.get(cellKey(type.id, date))!;
                  return (
                    <tr key={`${type.id}-${date}`}>
                      <td>{dateLabel(date)}</td>
                      <td>{type.name}</td>
                      <td className="num">{cell.total}</td>
                      <td className="num">{cell.blocked || '—'}</td>
                      <td className="num">{cell.capacity}</td>
                      <td className="num">{cell.demandRooms}</td>
                      <td className="num">{cell.allocatedRooms}</td>
                      <td className="num">{cell.actualRooms || '—'}</td>
                      <td className="num">{cell.unplacedRooms || '—'}</td>
                      <td className="num">{cell.oversold || '—'}</td>
                      <td className="num">{percentText(cell.ratio)}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
