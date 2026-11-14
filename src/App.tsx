import { useEffect, useMemo, useState } from 'react';
import { sampleDataset } from './data/sample';
import type { DateStr } from './lib/date';
import { formatTimestamp } from './lib/date';
import { buildModel } from './lib/model';
import { runSimulation } from './lib/simulation';
import { DEFAULT_PRIORITY, type Dataset, type PageConfig, type PriorityCriterion, type UpgradeRule } from './lib/types';
import { ArrangementTable } from './components/ArrangementTable';
import { BookingInspector } from './components/BookingInspector';
import { CapacityGrid } from './components/CapacityGrid';
import { ImportPanel } from './components/ImportPanel';
import { IssuesPanel } from './components/IssuesPanel';
import { KpiRow } from './components/KpiRow';
import { NightDetail } from './components/NightDetail';
import { PriorityPanel } from './components/PriorityPanel';
import { SimulationPanel } from './components/SimulationPanel';
import { UpgradeRulesPanel } from './components/UpgradeRulesPanel';
import type { CapacityMode } from './lib/ui';

export interface AppState {
  dataset: Dataset;
  config: PageConfig;
  asOf: string;
  mode: CapacityMode;
}

function cloneDataset(dataset: Dataset): Dataset {
  return JSON.parse(JSON.stringify(dataset)) as Dataset;
}

const INITIAL_STATE: AppState = {
  dataset: cloneDataset(sampleDataset),
  config: {
    priority: DEFAULT_PRIORITY,
    maxUpgradeCostPerNight: null,
    simulation: { cancelRate: 0.18, seed: 20261114, trials: 120 },
  },
  asOf: sampleDataset.hotel.asOf,
  mode: 'demand',
};

export default function App({ initial = INITIAL_STATE }: { initial?: AppState }) {
  const [dataset, setDataset] = useState<Dataset>(initial.dataset);
  const [config, setConfig] = useState<PageConfig>(initial.config);
  const [asOf, setAsOf] = useState<string>(initial.asOf);
  const [mode, setMode] = useState<CapacityMode>(initial.mode);
  const [nightPick, setNightPick] = useState<{ date: DateStr; roomTypeId: string | null } | null>(null);
  const [bookingPick, setBookingPick] = useState<string | null>(null);
  const [simKey, setSimKey] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const model = useMemo(() => buildModel(dataset, config, asOf), [dataset, config, asOf]);
  const simulation = useMemo(
    // simKey lets the explicit "按种子重跑" button force a recomputation.
    () => runSimulation(dataset, config, asOf, model),
    [dataset, config, asOf, model, simKey],
  );

  const setPriority = (priority: PriorityCriterion[]) => setConfig((c) => ({ ...c, priority }));
  const setRule = (updated: UpgradeRule) =>
    setDataset((d) => ({
      ...d,
      upgradeRules: d.upgradeRules.map((r) => (r.id === updated.id ? updated : r)),
    }));

  const openBooking = (id: string) => {
    setNightPick(null);
    setBookingPick(id);
  };

  const adjustAsOf = (deltaHours: number) => {
    const date = new Date(`${asOf}:00`);
    date.setHours(date.getHours() + deltaHours);
    const pad = (n: number) => String(n).padStart(2, '0');
    const next = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
    setAsOf(next);
  };

  const warnings = model.issues.filter((i) => i.severity !== 'info');

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <h1>酒店容量 · 可售与超售处置</h1>
          <p className="sub" style={{ margin: 0 }}>
            {dataset.hotel.name} · 窗口 {dataset.hotel.windowStart} → {dataset.hotel.windowEnd}（退房日不占容量）· 回放时点{' '}
            {formatTimestamp(asOf)}
          </p>
        </div>
        <div className="header-actions" role="group" aria-label="观察时点与主题">
          <div className="field">
            <label htmlFor="asof">观察时点</label>
            <input
              id="asof"
              type="datetime-local"
              value={asOf}
              min={`${dataset.hotel.windowStart}T00:00`}
              max={`${dataset.hotel.windowEnd}T23:59`}
              onChange={(e) => e.target.value && setAsOf(e.target.value)}
            />
          </div>
          <button className="btn" type="button" onClick={() => adjustAsOf(-24)} aria-label="观察时点回退一天">
            −1 天
          </button>
          <button className="btn" type="button" onClick={() => adjustAsOf(24)} aria-label="观察时点前进一天">
            +1 天
          </button>
          <button className="btn" type="button" onClick={() => setAsOf(dataset.hotel.asOf)}>
            回到默认时点
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            aria-label="切换深色/浅色"
          >
            {theme === 'light' ? '深色' : '浅色'}
          </button>
        </div>
      </header>

      <KpiRow model={model} />

      <section className="card" aria-labelledby="controls-title">
        <div className="card-head">
          <div>
            <h2 id="controls-title">视图</h2>
            <div className="hint">
              已订口径按观察时点回放，包含之后才取消的预订；已安置口径是按下述优先级与升级规则实际安排后的占用。
            </div>
          </div>
        </div>
        <div className="toolbar">
          <div className="left">
            <div className="segmented" role="group" aria-label="容量口径">
              <button type="button" aria-pressed={mode === 'demand'} onClick={() => setMode('demand')}>
                可售 / 已订
              </button>
              <button type="button" aria-pressed={mode === 'allocated'} onClick={() => setMode('allocated')}>
                可售 / 已安置
              </button>
            </div>
            <span className="filter-note">
              {mode === 'demand'
                ? '已订为回放口径：观察时点之后的取消仍算已订。'
                : '已安置口径：含升级后实际占用，未安置房间不写入任何房型。'}
            </span>
          </div>
          <div className="right">
            <span className="pill">回放时点后取消 {model.summary.canceledLaterCount} 单</span>
            <span className="pill">后录实际变更 {model.summary.lateActualBookings} 单</span>
            <span className="pill">后录封房 {model.summary.lateBlockCount} 条</span>
          </div>
        </div>
      </section>

      <CapacityGrid model={model} mode={mode} onPick={(date, roomTypeId) => setNightPick({ date, roomTypeId })} />

      <div className="two-col">
        <PriorityPanel priority={config.priority} onChange={setPriority} />
        <UpgradeRulesPanel
          model={model}
          rules={dataset.upgradeRules}
          costCap={config.maxUpgradeCostPerNight}
          onChangeRule={setRule}
          onChangeCap={(value) => setConfig((c) => ({ ...c, maxUpgradeCostPerNight: value }))}
        />
      </div>

      <ArrangementTable model={model} selectedId={bookingPick} onSelect={openBooking} />

      <SimulationPanel
        simulation={simulation}
        config={config.simulation}
        onChange={(next) => setConfig((c) => ({ ...c, simulation: next }))}
        onRun={() => setSimKey((k) => k + 1)}
      />

      <ImportPanel
        dataset={dataset}
        asOf={asOf}
        onMerge={(next) => setDataset(next)}
        onReset={() => {
          setDataset(cloneDataset(sampleDataset));
          setConfig(INITIAL_STATE.config);
          setAsOf(sampleDataset.hotel.asOf);
        }}
      />

      {warnings.length > 0 ? (
        <IssuesPanel
          issues={model.issues}
          onInspect={(ref) => {
            const booking = model.demand.find((d) => d.booking.code === ref || d.booking.id === ref);
            if (booking) setBookingPick(booking.booking.id);
            else {
              const byCode = dataset.bookings.find((b) => b.code === ref || b.id === ref);
              const inModel = byCode && model.demandByBooking.get(byCode.id);
              if (inModel) setBookingPick(byCode!.id);
            }
          }}
        />
      ) : (
        <section className="card">
          <div className="card-head">
            <h2>数据体检</h2>
          </div>
          <div className="empty">没有发现数据问题。</div>
        </section>
      )}

      <footer className="tiny" style={{ marginTop: 12 }}>
        样本包含：跨夜预订、同单拆房、重复合并行、观察时点后取消、提前退房与晚记录延住、按日期维修/锁房、未启用升级链路。
        所有数字都能从当晚明细追溯到容量、封房、优先级和升级规则。
      </footer>

      {nightPick ? (
        <NightDetail
          model={model}
          date={nightPick.date}
          roomTypeId={nightPick.roomTypeId}
          onClose={() => setNightPick(null)}
          onSelectBooking={openBooking}
        />
      ) : null}
      {bookingPick ? (
        <BookingInspector model={model} bookingId={bookingPick} onClose={() => setBookingPick(null)} />
      ) : null}
    </main>
  );
}
