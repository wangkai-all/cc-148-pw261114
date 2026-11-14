import { useRef, useState } from 'react';
import type { ImportMessage } from '../lib/import';
import type { Dataset } from '../lib/types';
import { BLOCKS_CSV_TEMPLATE, BOOKINGS_CSV_TEMPLATE, importBlocksCsv, importBookingsCsv } from '../lib/import';

type Kind = 'bookings' | 'blocks';

interface Props {
  dataset: Dataset;
  asOf: string;
  onMerge: (dataset: Dataset) => void;
  onReset: () => void;
}

export function ImportPanel({ dataset, asOf, onMerge, onReset }: Props) {
  const [kind, setKind] = useState<Kind>('bookings');
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<ImportMessage[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const template = kind === 'bookings' ? BOOKINGS_CSV_TEMPLATE : BLOCKS_CSV_TEMPLATE;

  const run = () => {
    setSummary(null);
    if (!text.trim()) {
      setMessages([{ row: 0, level: 'error', message: '请先粘贴 CSV 或选择文件' }]);
      return;
    }
    if (kind === 'bookings') {
      const result = importBookingsCsv(text);
      setMessages(result.messages);
      if (result.items.length > 0) {
        onMerge({ ...dataset, bookings: [...dataset.bookings, ...result.items] });
        setSummary(`已导入 ${result.items.length} 单（按 bookingCode 合并同单多段），住宿段 ${result.items.reduce((s, b) => s + b.segments.length, 0)} 段`);
      }
    } else {
      const result = importBlocksCsv(text);
      setMessages(result.messages);
      if (result.items.length > 0) {
        onMerge({ ...dataset, blocks: [...dataset.blocks, ...result.items] });
        setSummary(`已导入 ${result.items.length} 条封房记录`);
      }
    }
  };

  const preview = () => {
    if (!text.trim()) {
      setMessages([{ row: 0, level: 'error', message: '请先粘贴 CSV 或选择文件' }]);
      return;
    }
    setSummary(null);
    const result = kind === 'bookings' ? importBookingsCsv(text) : importBlocksCsv(text);
    setMessages(result.messages);
    setSummary(`校验通过 ${result.items.length} 条；导入前请确认下方消息。`);
  };

  return (
    <section className="card" aria-labelledby="import-title">
      <div className="card-head">
        <div>
          <h2 id="import-title">导入预订 / 封房</h2>
          <div className="hint">
            预订按 bookingCode 合并为同一单；实际入住需带 actualRecordedAt，晚于观察时点的变更不会用于美化回放。
          </div>
        </div>
        <div className="header-actions">
          <div className="segmented" role="group" aria-label="导入类型">
            <button type="button" aria-pressed={kind === 'bookings'} onClick={() => setKind('bookings')}>
              预订
            </button>
            <button type="button" aria-pressed={kind === 'blocks'} onClick={() => setKind('blocks')}>
              封房
            </button>
          </div>
          <button type="button" className="btn" onClick={onReset}>
            恢复样本数据
          </button>
        </div>
      </div>
      <div className="field" style={{ marginBottom: 8 }}>
        <span className="label">CSV 内容（可粘贴，或选择文件）。当前观察时点 {asOf.replace('T', ' ')}</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={template}
          rows={6}
          style={{
            width: '100%',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 12,
            background: 'var(--surface-1)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 8,
            resize: 'vertical',
          }}
          aria-label="CSV 内容"
        />
      </div>
      <div className="header-actions">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setFileName(file.name);
            setText(await file.text());
          }}
        />
        <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
          选择 CSV 文件
        </button>
        <button className="btn" type="button" onClick={preview}>
          仅校验
        </button>
        <button className="btn primary" type="button" onClick={run}>
          导入并重放
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            setText(template);
            setMessages([]);
            setSummary(null);
          }}
        >
          填入模板
        </button>
        {fileName ? <span className="tiny">文件：{fileName}</span> : null}
      </div>
      {summary ? <p className="filter-note" style={{ marginTop: 8 }}>{summary}</p> : null}
      {messages.length > 0 ? (
        <ul className="issue-list" style={{ marginTop: 10 }}>
          {messages.map((m, i) => (
            <li key={`${m.row}-${i}`}>
              <span className={`pill sev ${m.level === 'error' ? 'critical' : 'warning'}`}>
                {m.level === 'error' ? '错误' : '警告'}
              </span>
              <div>
                <div className="title">第 {m.row} 行</div>
                <div className="detail">{m.message}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
