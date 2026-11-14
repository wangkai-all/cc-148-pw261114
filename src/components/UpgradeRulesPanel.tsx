import type { Model } from '../lib/model';
import type { Tier, UpgradeRule } from '../lib/types';
import { TIER_LABEL, TIER_OPTIONS } from '../lib/types';

interface Props {
  model: Model;
  rules: UpgradeRule[];
  costCap: number | null;
  onChangeRule: (rule: UpgradeRule) => void;
  onChangeCap: (value: number | null) => void;
}

export function UpgradeRulesPanel({ model, rules, costCap, onChangeRule, onChangeCap }: Props) {
  const typeName = (id: string) => model.roomTypeById.get(id)?.name ?? id;
  const usage = new Map<string, number>();
  for (const a of model.allocations) {
    if (a.action !== 'upgraded') continue;
    for (const ruleId of a.upgradeRuleIds) usage.set(ruleId, (usage.get(ruleId) ?? 0) + a.rooms);
  }

  return (
    <section className="card" aria-labelledby="rules-title">
      <div className="card-head">
        <div>
          <h2 id="rules-title">升级关系与成本</h2>
          <div className="hint">
            允许升级的目标房型按「链路总成本最低 → 跳级最少 → 房型顺序」尝试；未启用的关系不会被使用。
          </div>
        </div>
        <label className="field" style={{ minWidth: 150 }}>
          <span className="label">单晚升级成本上限</span>
          <input
            type="number"
            min={0}
            step={10}
            value={costCap ?? ''}
            placeholder="不限"
            onChange={(e) => onChangeCap(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
          />
        </label>
      </div>
      <div className="table-wrap">
        <table className="data rules-table" aria-label="升级关系配置">
          <thead>
            <tr>
              <th>从</th>
              <th>到</th>
              <th>启用</th>
              <th>成本/间/晚</th>
              <th>最低会员等级</th>
              <th className="num">本窗口使用</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{typeName(rule.fromTypeId)}</td>
                <td>{typeName(rule.toTypeId)}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={rule.allowed}
                    aria-label={`启用 ${typeName(rule.fromTypeId)} 到 ${typeName(rule.toTypeId)} 升级`}
                    onChange={(e) => onChangeRule({ ...rule, allowed: e.target.checked })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={rule.costPerNight}
                    aria-label={`${typeName(rule.fromTypeId)} 到 ${typeName(rule.toTypeId)} 成本`}
                    onChange={(e) =>
                      onChangeRule({ ...rule, costPerNight: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </td>
                <td>
                  <select
                    value={rule.minTier ?? ''}
                    aria-label={`${typeName(rule.fromTypeId)} 到 ${typeName(rule.toTypeId)} 最低会员等级`}
                    onChange={(e) =>
                      onChangeRule({ ...rule, minTier: (e.target.value || undefined) as Tier | undefined })
                    }
                  >
                    <option value="">不限</option>
                    {TIER_OPTIONS.map((tier) => (
                      <option key={tier} value={tier}>
                        {TIER_LABEL[tier]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="num">{usage.get(rule.id) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny" style={{ marginBottom: 0 }}>
        成本上限只限制安排时采用的链路；历史已发生的实际入住不受影响。链路可多跳，例如标准 → 豪华 → 套房。
      </p>
    </section>
  );
}
