import { useMemo } from 'react';
import type { SimulationConfig } from '../lib/types';
import { mulberry32 } from '../lib/rng';
import type { SimulationResult } from '../lib/simulation';

interface Props {
  simulation: SimulationResult;
  config: SimulationConfig;
  onChange: (config: SimulationConfig) => void;
  onRun: () => void;
}

function BandChart({
  title,
  unit,
  band,
  deterministic,
  max,
  format,
}: {
  title: string;
  unit: string;
  band: SimulationResult['bands']['unplacedRooms'];
  deterministic: number;
  max: number;
  format: (v: number) => string;
}) {
  const scale = (value: number) => `${Math.min(100, Math.max(0, (value / Math.max(1, max)) * 100))}%`;
  return (
    <div className="sim-card">
      <h3>{title}</h3>
      <div className="headline">
        {format(band.p50)} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{unit}</span>
      </div>
      <div className="range">
        区间 P10–P90：{format(band.p10)} – {format(band.p90)} · 最坏 {format(band.max)}
      </div>
      <div className="band-bar" aria-hidden="true">
        <div
          style={{
            position: 'absolute',
            left: scale(band.p10),
            width: `calc(${scale(band.p90)} - ${scale(band.p10)})`,
            top: 0,
            height: '100%',
            background: 'var(--seq-3)',
            borderRadius: 4,
          }}
        />
        <div className="p50" style={{ left: scale(band.p50) }} />
        <div className="det" style={{ left: scale(deterministic) }} title={`实际回放 ${format(deterministic)}`} />
      </div>
      <div className="tiny">实际回放 {format(deterministic)}（橙色标记）· 模拟中位数（蓝色竖线）</div>
    </div>
  );
}

export function SimulationPanel({ simulation, config, onChange, onRun }: Props) {
  const maxUnplaced = Math.max(
    simulation.bands.unplacedRooms.max,
    simulation.deterministic.unplacedRooms,
    1,
  );
  const samples = useMemo(() => {
    const rng = mulberry32((config.seed >>> 0) ^ 0x5f3759df);
    return Array.from({ length: 12 }, () => Math.round(rng() * 100) / 100);
  }, [config.seed]);

  const maxCount = Math.max(1, ...simulation.histogram.map((h) => h.count));

  return (
    <section className="card" aria-labelledby="sim-title">
      <div className="card-head">
        <div>
          <h2 id="sim-title">取消率情景抽样</h2>
          <div className="hint">
            固定随机种子、重复抽样同一批可取消预订；实际回放与模拟分布分开展示，不把模拟当成已发生。
          </div>
        </div>
      </div>

      <div className="sim-controls">
        <label className="field">
          <span className="label">取消率 {Math.round(config.cancelRate * 100)}%</span>
          <input
            type="range"
            min={0}
            max={0.6}
            step={0.01}
            value={config.cancelRate}
            aria-label="取消率"
            onChange={(e) => onChange({ ...config, cancelRate: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span className="label">随机种子</span>
          <input
            type="number"
            value={config.seed}
            aria-label="随机种子"
            onChange={(e) => onChange({ ...config, seed: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            style={{ width: 110 }}
          />
        </label>
        <label className="field">
          <span className="label">抽样次数</span>
          <input
            type="number"
            min={1}
            max={2000}
            value={config.trials}
            aria-label="抽样次数"
            onChange={(e) =>
              onChange({ ...config, trials: Math.min(2000, Math.max(1, Math.floor(Number(e.target.value) || 1))) })
            }
            style={{ width: 90 }}
          />
        </label>
        <button className="btn primary" type="button" onClick={onRun}>
          按种子重跑
        </button>
        <div className="filter-note">
          抽样池 {simulation.eligibleBookings} 单；排除已取消、已实际入住及观察时点后才创建的 {simulation.ineligibleBookings} 单
        </div>
      </div>

      <div className="sim-grid">
        <BandChart
          title="未安置房间数"
          unit="间"
          band={simulation.bands.unplacedRooms}
          deterministic={simulation.deterministic.unplacedRooms}
          max={maxUnplaced}
          format={(v) => `${Math.round(v * 10) / 10}`}
        />
        <BandChart
          title="涉及未安置的预订"
          unit="单"
          band={simulation.bands.unplacedBookings}
          deterministic={simulation.deterministic.unplacedBookings}
          max={Math.max(simulation.bands.unplacedBookings.max, 1)}
          format={(v) => `${Math.round(v * 10) / 10}`}
        />
        <BandChart
          title="超售间夜"
          unit="间夜"
          band={simulation.bands.oversoldRoomNights}
          deterministic={simulation.deterministic.oversoldRoomNights}
          max={Math.max(simulation.bands.oversoldRoomNights.max, 1)}
          format={(v) => `${Math.round(v * 10) / 10}`}
        />
        <BandChart
          title="升级成本"
          unit="元"
          band={simulation.bands.upgradeCost}
          deterministic={simulation.deterministic.upgradeCost}
          max={Math.max(simulation.bands.upgradeCost.max, 1)}
          format={(v) => `¥${Math.round(v)}`}
        />
      </div>

      <div className="hist">
        <div className="toolbar">
          <div className="left">
            <strong style={{ fontSize: 13 }}>未安置房间数分布</strong>
            <span className="tiny">共 {simulation.trials.length} 次抽样，种子 {simulation.seed}</span>
          </div>
          <div className="right tiny" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="legend-item">
              <i className="line-swatch det" aria-hidden="true" />
              实际回放 {Math.round(simulation.deterministic.unplacedRooms)} 间
            </span>
            <span className="legend-item">
              <i className="line-swatch median" aria-hidden="true" />
              模拟中位数 {simulation.bands.unplacedRooms.p50} 间
            </span>
          </div>
        </div>
        <svg viewBox="0 0 640 190" role="img" aria-label="模拟未安置房间数直方图">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={44} x2={620} y1={150 - t * 120} y2={150 - t * 120} className="axis-line" />
              <text x={38} y={154 - t * 120} textAnchor="end" className="axis-text">
                {Math.round(maxCount * t)}
              </text>
            </g>
          ))}
          {simulation.histogram.map((h, index) => {
            const bandwidth = 576 / simulation.histogram.length;
            const width = Math.max(2, bandwidth - 2);
            const height = (h.count / maxCount) * 120;
            const x = 44 + index * bandwidth + 1;
            const single = h.to - h.from === 1;
            const label = single ? `${h.from}` : `${h.from}–${h.to}`;
            return (
              <g key={h.bucket}>
                <rect
                  className="bar"
                  x={x}
                  y={150 - height}
                  width={width}
                  height={height}
                  rx={3}
                >
                  <title>
                    {single ? `${h.from} 间` : `${h.from}–${h.to} 间`}：{h.count} 次
                  </title>
                </rect>
                <text x={x + width / 2} y={166} textAnchor="middle" className="axis-text">
                  {label}
                </text>
                {h.count > 0 ? (
                  <text x={x + width / 2} y={150 - height - 4} textAnchor="middle" className="axis-text">
                    {h.count}
                  </text>
                ) : null}
              </g>
            );
          })}
          <line x1={44} x2={620} y1={150} y2={150} className="axis-line" />
          {(() => {
            const bucketWidth = simulation.histogram[0] ? simulation.histogram[0].to - simulation.histogram[0].from : 1;
            const bandwidth = 576 / Math.max(1, simulation.histogram.length);
            // 标记对齐到所在柱的中心，而不是柱的边界。
            const xAt = (v: number) => {
              const idx = Math.max(0, Math.min(simulation.histogram.length - 1, Math.floor(v / Math.max(1, bucketWidth))));
              return 44 + (idx + 0.5) * bandwidth;
            };
            const detX = xAt(simulation.deterministic.unplacedRooms);
            const p50X = xAt(simulation.bands.unplacedRooms.p50);
            // 中位数线先画，实际回放线后画：两者落在同一柱时仍能看出虚线在上。
            return (
              <>
                <line x1={p50X} x2={p50X} y1={40} y2={150} className="median-line" />
                <line x1={detX} x2={detX} y1={22} y2={150} className="det-line" />
                <text x={detX} y={14} textAnchor="middle" className="axis-text">
                  实际 {Math.round(simulation.deterministic.unplacedRooms)}
                </text>
              </>
            );
          })()}
        </svg>
      </div>

      <div className="sim-note">
        抽样示例（前 12 次随机数，种子 {config.seed}）：{samples.join('、')}。同一配置重跑得到相同区间；改变种子可检查区间稳健性。
      </div>
    </section>
  );
}
