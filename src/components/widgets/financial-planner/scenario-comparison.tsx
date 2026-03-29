import type { ScenarioComparisonPayload, Scenario, FeasibilityStatus } from './types'
import { formatINR } from '@/lib/formatters'

interface ScenarioComparisonProps {
  data: ScenarioComparisonPayload
  isHistory?: boolean
}

const statusColors: Record<FeasibilityStatus, string> = {
  green: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const statusLabels: Record<FeasibilityStatus, string> = {
  green: 'Feasible',
  yellow: 'Tight',
  red: 'Gap',
}

const riskColors: Record<string, string> = {
  Conservative: 'border-blue-500/30',
  Moderate: 'border-emerald-500/30',
  Aggressive: 'border-orange-500/30',
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
          expected_return: scenario.name === 'Conservative' ? 0.08
            : scenario.name === 'Aggressive' ? 0.14 : 0.10,
        }),
      },
    }))
  }

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-lg p-5 max-w-2xl">
      <h3 className="text-lg font-semibold text-white mb-1">Scenario Comparison</h3>
      <p className="text-[11px] text-slate-500 mb-4">Compare risk-return tradeoffs across strategies</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {scenarios.map((scenario, i) => (
          <div
            key={i}
            className={`rounded-lg border p-3 bg-white/5 flex flex-col ${riskColors[scenario.name] || 'border-white/10'}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white">{scenario.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusColors[scenario.feasibility]}`}>
                {statusLabels[scenario.feasibility]}
              </span>
            </div>

            {/* Description */}
            <p className="text-[11px] text-slate-400 mb-3 flex-1">{scenario.description}</p>

            {/* Metrics */}
            <div className="space-y-1.5 mb-3">
              <MetricRow label="Retire at" value={`Age ${scenario.retirement_age}`} />
              <MetricRow label="Monthly SIP" value={formatINR(scenario.monthly_sip)} />
              <MetricRow label="Corpus at retirement" value={formatINR(scenario.corpus_at_retirement)} />
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
                Apply
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className="text-xs font-medium text-white">{value}</span>
    </div>
  )
}
