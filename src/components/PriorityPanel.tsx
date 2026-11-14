import type { PriorityCriterion } from '../lib/types';
import { PRIORITY_DETAIL, PRIORITY_LABEL } from '../lib/types';

interface Props {
  priority: PriorityCriterion[];
  onChange: (priority: PriorityCriterion[]) => void;
}

export function PriorityPanel({ priority, onChange }: Props) {
  const move = (index: number, delta: number) => {
    const next = [...priority];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <section className="card" aria-labelledby="priority-title">
      <div className="card-head">
        <div>
          <h2 id="priority-title">超售安置优先级</h2>
          <div className="hint">从上到下依次比较；同序按预订编号稳定排序。改动即刻重放全窗口。</div>
        </div>
      </div>
      <ol className="priority-list">
        {priority.map((criterion, index) => (
          <li key={criterion}>
            <span className="rank" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <div className="name">{PRIORITY_LABEL[criterion]}</div>
              <div className="detail">{PRIORITY_DETAIL[criterion]}</div>
            </div>
            <span className="spacer" />
            <button
              className="icon-btn"
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label={`上移 ${PRIORITY_LABEL[criterion]}`}
            >
              ↑
            </button>
            <button
              className="icon-btn"
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === priority.length - 1}
              aria-label={`下移 ${PRIORITY_LABEL[criterion]}`}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <p className="tiny" style={{ marginBottom: 0 }}>
        实际入住的夜晚不参与重新安置：已发生的事实先锁房，剩余房量才按上面的顺序分配。
      </p>
    </section>
  );
}
