import type { DataIssue } from '../lib/model';

const ORDER = { error: 0, warning: 1, info: 2 } as const;

export function IssuesPanel({ issues, onInspect }: { issues: DataIssue[]; onInspect?: (ref: string) => void }) {
  const sorted = [...issues].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  return (
    <section className="card" aria-labelledby="issues-title">
      <div className="card-head">
        <div>
          <h2 id="issues-title">数据体检</h2>
          <div className="hint">
            导入数据不会静默修补：错误会排除对应记录，警告只提示并在回放中按保守规则处理。
          </div>
        </div>
        <span className="pill">
          {issues.filter((i) => i.severity === 'error').length} 错误 ·{' '}
          {issues.filter((i) => i.severity === 'warning').length} 警告 ·{' '}
          {issues.filter((i) => i.severity === 'info').length} 说明
        </span>
      </div>
      {sorted.length === 0 ? (
        <div className="empty">没有发现数据问题。</div>
      ) : (
        <ul className="issue-list">
          {sorted.map((issue) => (
            <li key={issue.id}>
              <span className={`pill sev ${issue.severity === 'error' ? 'critical' : issue.severity === 'warning' ? 'warning' : ''}`}>
                {issue.severity === 'error' ? '错误' : issue.severity === 'warning' ? '警告' : '说明'}
              </span>
              <div>
                <div className="title">{issue.title}</div>
                <div className="detail">{issue.detail}</div>
                {issue.refs && issue.refs.length > 0 ? (
                  <div className="chips" style={{ marginTop: 3 }}>
                    {issue.refs.slice(0, 6).map((ref, index) => (
                      <button
                        key={`${ref}-${index}`}
                        type="button"
                        className="chip"
                        style={{ cursor: onInspect ? 'pointer' : undefined }}
                        onClick={() => onInspect?.(ref)}
                      >
                        {ref}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
