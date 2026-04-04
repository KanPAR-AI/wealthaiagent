import type { ScenarioComparisonPayload, Scenario } from './types'
import { formatINR } from '@/lib/formatters'

interface ScenarioComparisonProps {
  data: ScenarioComparisonPayload
  isHistory?: boolean
}

const riskBadge: Record<string, { label: string; color: string }> = {
  low: { label: 'Low Risk', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  medium: { label: 'Med Risk', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  high: { label: 'High Risk', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

const riskBorder: Record<string, string> = {
  low: 'border-blue-500/30',
  medium: 'border-yellow-500/30',
  high: 'border-orange-500/30',
}

export function ScenarioComparison({ data, isHistory }: ScenarioComparisonProps) {
  const { scenarios = [] } = data

  const handleApply = (scenario: Scenario) => {
    if (isHistory) return
    window.dispatchEvent(new CustomEvent('chat-quick-reply', {
      detail: {
        text: JSON.stringify({
          action: 'apply_scenario',
          scenario_name: scenario.name,
          retirement_age: scenario.retirement_age,
          expected_return: scenario.expected_return ?? 0.11,
          swp_rate: scenario.swp_rate ?? 0.04,
        }),
      },
    }))
  }

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-lg p-5 max-w-2xl">
      <h3 className="text-lg font-semibold text-white mb-1">Scenario Comparison</h3>
      <p className="text-[11px] text-slate-500 mb-4">Same retirement age — compare accumulation + withdrawal strategies</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {scenarios.map((scenario, i) => {
          const risk = scenario.risk_level || 'medium'
          const badge = riskBadge[risk] || riskBadge.medium
          const swpPct = scenario.swp_rate ? `${(scenario.swp_rate * 100).toFixed(0)}%` : '4%'
          const swpMultiple = scenario.swp_rate ? Math.round(1 / scenario.swp_rate) : 25
          return (
            <div
              key={i}
              className={`rounded-lg border p-3 bg-white/5 flex flex-col ${riskBorder[risk] || 'border-white/10'}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">{scenario.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${badge.color}`}>
                  {badge.label}
                </span>
              </div>

              {/* Two-phase summary */}
              <div className="text-[11px] text-slate-400 mb-3 flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400/60 text-[9px]">BUILD</span>
                  <span>{scenario.equity_pct ?? 60}% equity @ {((scenario.expected_return ?? 0.10) * 100).toFixed(0)}% p.a.</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-blue-400/60 text-[9px]">SPEND</span>
                  <span>{swpPct} SWP ({swpMultiple}x expenses)</span>
                </div>
              </div>

              {/* Metrics */}
              <div className="space-y-1.5 mb-3">
                <MetricRow label="Retire at" value={`Age ${scenario.retirement_age}`} />
                {scenario.monthly_expense_at_retirement != null && (
                  <MetricRow label="Expenses then" value={`${formatINR(scenario.monthly_expense_at_retirement)}/mo`} />
                )}
                <div className="border-t border-white/5 my-1" />
                {scenario.corpus_needed != null && (
                  <MetricRow label="Corpus needed" value={formatINR(scenario.corpus_needed)} highlight />
                )}
                <MetricRow label="SIP needed" value={`${formatINR(scenario.monthly_sip)}/mo`} />
                {scenario.total_monthly_investment != null && (
                  <MetricRow label="Total investing" value={`${formatINR(scenario.total_monthly_investment)}/mo`} />
                )}
                <MetricRow label="Projected corpus" value={formatINR(scenario.corpus_at_retirement)} highlight />
              </div>

              {/* Tradeoff */}
              <div className="text-[10px] text-slate-500 border-t border-white/5 pt-2 mb-3">
                {scenario.key_tradeoff}
              </div>

              {/* Apply button */}
              {!isHistory && (
                <button
                  onClick={() => handleApply(scenario)}
                  className="w-full py-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10
                    text-xs text-slate-300 transition-all active:scale-95"
                >
                  Apply this strategy
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MetricRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className={`text-xs font-medium text-right ${highlight ? 'text-emerald-400' : 'text-white'}`}>{value}</span>
    </div>
  )
}
