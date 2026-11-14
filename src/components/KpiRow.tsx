import type { Model } from '../lib/model';

function Tile({
  label,
  value,
  unit,
  sub,
  alert,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div className={alert ? 'tile alert' : 'tile'}>
      <div className="tile-label">{label}</div>
      <div className="tile-value">
        {value}
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
      {sub ? <div className="tile-sub">{sub}</div> : null}
    </div>
  );
}

export function KpiRow({ model }: { model: Model }) {
  const s = model.summary;
  const occupancy =
    s.demandRoomNights === 0 ? '0%' : `${Math.round((s.demandRoomNights / Math.max(1, s.totalCapacityNights)) * 100)}%`;
  return (
    <div className="kpi-row">
      <Tile
        label="窗口可售间夜"
        value={s.totalCapacityNights.toLocaleString('zh-CN')}
        unit="间夜"
        sub={`${model.roomTypes.reduce((sum, t) => sum + t.totalRooms, 0)} 间房 × ${model.windowDates.length} 晚，已扣维修/锁房`}
      />
      <Tile
        label="已订间夜"
        value={s.demandRoomNights.toLocaleString('zh-CN')}
        unit="间夜"
        sub={`观察时点 ${model.asOf.replace('T', ' ')} · ${s.activeBookingCount} 单在住/在订`}
      />
      <Tile
        label="窗口入住率"
        value={occupancy}
        sub={`实际已入住 ${s.actualRoomNights} 间夜`}
      />
      <Tile
        label="超售间夜"
        value={s.oversoldRoomNights}
        unit="间夜"
        sub={`${s.unplacedBookings} 单共 ${s.unplacedRooms} 间无法安置`}
        alert={s.oversoldRoomNights > 0}
      />
      <Tile
        label="升级间夜"
        value={s.upgradedRooms}
        unit="间"
        sub={`成本 ¥${s.upgradeCost.toLocaleString('zh-CN')}，可逐条追溯`}
      />
      <Tile
        label="取消（观察时点后）"
        value={s.canceledLaterCount}
        unit="单"
        sub={`按时点前已取消 ${s.canceledBeforeAsOfCount} 单，不参与回放`}
      />
    </div>
  );
}
