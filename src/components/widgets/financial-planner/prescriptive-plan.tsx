import { useState } from 'react'
import type { PrescriptivePlanPayload, ActionItem, TimelineRow, SipPhase, HomePurchasePlan, ReturnStrategiesPayload, ReturnStrategy } from './types'
import { formatINR } from '@/lib/formatters'

interface PrescriptivePlanProps {
  data: PrescriptivePlanPayload
  isHistory?: boolean
}

const categoryLabels: Record<string, { title: string; icon: string; color: string }> = {
  corpus: { title: 'Existing Corpus', icon: '💰', color: 'border-emerald-500/30 bg-emerald-500/10' },
  sip: { title: 'Monthly SIP', icon: '📊', color: 'border-blue-500/30 bg-blue-500/10' },
  lump_sum: { title: 'Lump Sum Inflows', icon: '🎯', color: 'border-purple-500/30 bg-purple-500/10' },
  insurance: { title: 'Insurance', icon: '🛡️', color: 'border-amber-500/30 bg-amber-500/10' },
  expense: { title: 'Expense Optimization', icon: '✂️', color: 'border-slate-500/30 bg-slate-500/10' },
  home_loan: { title: 'Home Purchase', icon: '🏠', color: 'border-cyan-500/30 bg-cyan-500/10' },
}

export function PrescriptivePlan({ data, isHistory }: PrescriptivePlanProps) {
  const [expandedChild, setExpandedChild] = useState<number | null>(null)
  const [showTimeline, setShowTimeline] = useState(false)
  const [showAmortization, setShowAmortization] = useState(false)
  const { action_items = [], child_plans = [], insurance, timeline = [], sip_phases = [], home_purchase_plan, return_strategies } = data

  // Group action items by category
  const grouped: Record<string, ActionItem[]> = {}
  for (const item of action_items) {
    if (!grouped[item.category]) grouped[item.category] = []
    grouped[item.category].push(item)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-lg p-5 max-w-2xl">
      <h3 className="text-lg font-semibold text-white mb-4">Your Action Plan</h3>

      {/* Action Items grouped by category */}
      <div className="space-y-3 mb-5">
        {Object.entries(grouped).map(([category, items]) => {
          const meta = categoryLabels[category] || categoryLabels.expense
          return (
            <div key={category} className={`rounded-lg border p-3 ${meta.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{meta.icon}</span>
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{meta.title}</span>
              </div>
              <div className="space-y-3">
                {items.map((item, i) => (
                  <div key={i}>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5 text-xs">●</span>
                      <div className="flex-1">
                        {/* Header line */}
                        <p className="text-sm text-white font-medium">
                          {item.instruction.split('\n')[0]}
                        </p>
                        {item.expected_return != null && (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Blended return: <span className="text-emerald-400 font-medium">{(item.expected_return * 100).toFixed(1)}% p.a.</span>
                          </p>
                        )}
                      </div>
                      {item.amount > 0 && (
                        <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
                          {formatINR(item.amount)}
                        </span>
                      )}
                    </div>

                    {/* SIP breakdown table — exact amounts per fund */}
                    {item.sip_breakdown && item.sip_breakdown.length > 0 && (
                      <div className="mt-2 ml-5 rounded-md border border-white/5 bg-white/[0.02] overflow-hidden">
                        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[10px] text-slate-500 px-2.5 py-1 border-b border-white/5 uppercase tracking-wider">
                          <span>Fund</span>
                          <span className="text-right">SIP/mo</span>
                          <span className="text-right">Return</span>
                        </div>
                        {item.sip_breakdown.map((row, j) => (
                          <div key={j} className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-2.5 py-1.5 border-b border-white/[0.03] last:border-0">
                            <span className="text-xs text-slate-300">{row.fund}</span>
                            <span className="text-xs font-medium text-white text-right">{formatINR(row.amount)}</span>
                            <span className="text-[10px] text-emerald-400 text-right">{(row.return * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Fallback: multi-line breakdown for non-SIP items */}
                    {!item.sip_breakdown && item.instruction.includes('\n') && (
                      <div className="ml-5 mt-1 space-y-0.5">
                        {item.instruction.split('\n').slice(1).map((line, j) =>
                          line.split(' | ').map((part, k) => (
                            <p key={`${j}-${k}`} className="text-xs text-slate-300">
                              <span className="text-slate-500">→</span> {part}
                            </p>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Phased SIP Schedule — when to start each SIP */}
      {sip_phases.length > 1 && (
        <div className="mb-5">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            SIP Ramp-Up Schedule
          </h4>
          <p className="text-[10px] text-slate-500 mb-3">
            You don&apos;t need to start everything at once. Phase your SIPs as life evolves.
          </p>
          <div className="space-y-2">
            {sip_phases.map((phase: SipPhase, i: number) => (
              <div
                key={phase.phase}
                className={`rounded-lg border p-3 ${['border-emerald-500/30 bg-emerald-500/5', 'border-blue-500/30 bg-blue-500/5', 'border-purple-500/30 bg-purple-500/5', 'border-amber-500/30 bg-amber-500/5'][i % 4]}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                    <span className="text-xs font-semibold text-white">{phase.label}</span>
                  </div>
                  <span className="text-xs font-medium text-emerald-400">
                    +{formatINR(phase.phase_sip)}/mo
                  </span>
                </div>
                <div className="space-y-1 ml-4">
                  {phase.goals.map((g, j) => (
                    <div key={j} className="flex justify-between text-xs">
                      <span className="text-slate-400">{g.name}</span>
                      <span className="text-white font-medium">{formatINR(g.monthly_sip)}/mo</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-white/5 flex justify-between">
                  <span className="text-[10px] text-slate-500">Total after this phase</span>
                  <span className="text-xs font-semibold text-white">{formatINR(phase.cumulative_sip)}/mo</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-Child Education Plans */}
      {child_plans.length > 0 && (
        <div className="mb-5">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Children&apos;s Education Plans
          </h4>
          <div className="space-y-2">
            {child_plans.map((child, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
                <button
                  onClick={() => setExpandedChild(expandedChild === i ? null : i)}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <div>
                    <span className="text-sm font-medium text-white">{child.child_name}</span>
                    <span className="text-xs text-slate-400 ml-2">
                      Corpus: {formatINR(child.corpus_needed)} | SIP: {formatINR(child.monthly_sip)}/mo
                    </span>
                  </div>
                  <span className="text-slate-500 text-xs">{expandedChild === i ? '▲' : '▼'}</span>
                </button>
                {expandedChild === i && child.school_fee_schedule.length > 0 && (
                  <div className="border-t border-white/5 p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">School Fee Schedule</p>
                    <div className="grid grid-cols-2 gap-1">
                      {child.school_fee_schedule.map((entry, j) => (
                        <div key={j} className="flex justify-between text-xs">
                          <span className="text-slate-400">Year {entry.year}</span>
                          <span className="text-white">{formatINR(entry.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insurance Recommendation */}
      {insurance && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 mb-5">
          <div className="flex items-center gap-2 mb-1.5">
            <span>🛡️</span>
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Term Insurance</span>
          </div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-white">Cover: {formatINR(insurance.cover)}</span>
            <span className="text-xs text-slate-400">~{formatINR(insurance.premium_monthly)}/mo</span>
          </div>
          <p className="text-[10px] text-slate-500">{insurance.reasoning}</p>
        </div>
      )}

      {/* Home Purchase Journey */}
      {home_purchase_plan && (
        <HomePurchaseSection
          plan={home_purchase_plan}
          showAmortization={showAmortization}
          setShowAmortization={setShowAmortization}
        />
      )}

      {/* How to earn the target return (LLM-generated) */}
      {return_strategies && return_strategies.strategies.length > 0 && (
        <ReturnStrategiesSection data={return_strategies} />
      )}

      {/* Timeline Projection */}
      {timeline.length > 0 && (
        <div>
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 hover:text-white transition-colors"
          >
            <span>📈</span>
            <span>Financial Timeline</span>
            <span className="text-slate-500">{showTimeline ? '▲' : '▼'}</span>
          </button>
          {showTimeline && (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-white/10">
                    <th className="text-left px-2.5 py-2">Age</th>
                    <th className="text-right px-2.5 py-2">Income/yr</th>
                    <th className="text-right px-2.5 py-2">Expenses/yr</th>
                    <th className="text-right px-2.5 py-2">Savings/yr</th>
                    <th className="text-right px-2.5 py-2">Net Worth</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((row: TimelineRow, i: number) => (
                    <tr key={i} className="border-b border-white/[0.03] last:border-0">
                      <td className="px-2.5 py-1.5 text-white font-medium">{row.age}</td>
                      <td className="px-2.5 py-1.5 text-right text-emerald-400">{formatINR(row.annual_income)}</td>
                      <td className="px-2.5 py-1.5 text-right text-red-400">{formatINR(row.annual_expenses)}</td>
                      <td className={`px-2.5 py-1.5 text-right ${row.annual_savings > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                        {formatINR(row.annual_savings)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right text-white font-medium">{formatINR(row.net_worth)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


// ── Home Purchase Journey sub-component ──────────────────────────────

function HomePurchaseSection({
  plan,
  showAmortization,
  setShowAmortization,
}: {
  plan: HomePurchasePlan
  showAmortization: boolean
  setShowAmortization: (v: boolean) => void
}) {
  const affordability = plan.surplus_after_emi > 0
    ? 'comfortable'
    : plan.surplus_after_emi > -plan.emi_monthly * 0.2
    ? 'tight'
    : 'risky'

  const affordabilityConfig = {
    comfortable: { badge: 'Affordable', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
    tight: { badge: 'Tight but Possible', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
    risky: { badge: 'High Risk', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  }
  const aff = affordabilityConfig[affordability]

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <span>🏠</span> Home Purchase Journey
        </h4>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${aff.color}`}>
          {aff.badge}
        </span>
      </div>

      {/* Key Numbers Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
          <p className="text-[10px] text-slate-500 uppercase">Home Value</p>
          <p className="text-sm font-semibold text-white">{formatINR(plan.home_value_at_purchase)}</p>
          <p className="text-[10px] text-slate-500">at year {plan.purchase_in_years}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
          <p className="text-[10px] text-slate-500 uppercase">Down Payment + Stamp</p>
          <p className="text-sm font-semibold text-white">{formatINR(plan.total_upfront)}</p>
          <p className="text-[10px] text-slate-500">{(plan.down_payment_pct * 100).toFixed(0)}% + 7% stamp</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
          <p className="text-[10px] text-slate-500 uppercase">Loan Amount</p>
          <p className="text-sm font-semibold text-white">{formatINR(plan.loan_principal)}</p>
          <p className="text-[10px] text-slate-500">{(plan.loan_rate * 100).toFixed(1)}% for {plan.loan_tenure_years} years</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
          <p className="text-[10px] text-slate-500 uppercase">Monthly EMI</p>
          <p className="text-sm font-semibold text-cyan-400">{formatINR(plan.emi_monthly)}/mo</p>
          <p className="text-[10px] text-slate-500">Total interest: {formatINR(plan.total_interest)}</p>
        </div>
      </div>

      {/* Cash Flow Impact Bar */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 mb-3">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Cash Flow Impact</p>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">Surplus before EMI</span>
            <span className="text-xs font-medium text-emerald-400">{formatINR(plan.surplus_before_emi)}/mo</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">EMI outflow</span>
            <span className="text-xs font-medium text-red-400">-{formatINR(plan.emi_monthly)}/mo</span>
          </div>
          <div className="border-t border-white/10 pt-2 flex justify-between items-center">
            <span className="text-xs text-slate-300 font-medium">Surplus after EMI</span>
            <span className={`text-xs font-semibold ${plan.surplus_after_emi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatINR(plan.surplus_after_emi)}/mo
            </span>
          </div>
          {plan.surplus_drop_pct > 0 && (
            <div className="mt-1">
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${affordability === 'comfortable' ? 'bg-emerald-500' : affordability === 'tight' ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(plan.surplus_drop_pct * 100, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {(plan.surplus_drop_pct * 100).toFixed(0)}% of surplus consumed by EMI
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 4-Phase Timeline */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 mb-3">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Journey Phases</p>
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/10" />
          <div className="space-y-3">
            {plan.phases.map((phase, i) => (
              <div key={i} className="flex items-start gap-3 relative">
                <div className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 flex-shrink-0 z-10 ${
                  i === 0 ? 'bg-emerald-500 border-emerald-400' :
                  i === 1 ? 'bg-cyan-500 border-cyan-400' :
                  i === 2 ? 'bg-amber-500 border-amber-400' :
                  'bg-purple-500 border-purple-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">{phase.name}</p>
                  {phase.monthly_sip != null && (
                    <p className="text-[10px] text-slate-400">
                      SIP: {formatINR(phase.monthly_sip)}/mo for {phase.duration_years} years
                      <span className="text-slate-500"> | Target: {formatINR(phase.target || 0)}</span>
                    </p>
                  )}
                  {phase.monthly_emi != null && (
                    <p className="text-[10px] text-slate-400">
                      EMI: {formatINR(phase.monthly_emi)}/mo for {phase.duration_years} years
                      <span className="text-slate-500"> | Interest: {formatINR(phase.total_interest || 0)}</span>
                    </p>
                  )}
                  {phase.outflow != null && (
                    <p className="text-[10px] text-slate-400">Outflow: {formatINR(phase.outflow)}</p>
                  )}
                  {phase.description && !phase.monthly_sip && !phase.monthly_emi && !phase.outflow && (
                    <p className="text-[10px] text-slate-400">{phase.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Home Loan Insurance */}
      {plan.home_loan_insurance && (
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 mb-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs">🛡️</span>
            <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">Home Loan Insurance</span>
          </div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-white">Decreasing term cover: {formatINR(plan.home_loan_insurance.cover)}</span>
            <span className="text-[10px] text-slate-400">~{formatINR(plan.home_loan_insurance.premium_monthly)}/mo</span>
          </div>
          <p className="text-[10px] text-slate-500">{plan.home_loan_insurance.reasoning}</p>
        </div>
      )}

      {/* Amortization Milestones (collapsible) */}
      {plan.amortization && plan.amortization.length > 0 && (
        <div>
          <button
            onClick={() => setShowAmortization(!showAmortization)}
            className="flex items-center gap-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 hover:text-white transition-colors"
          >
            <span>Loan Repayment Schedule</span>
            <span>{showAmortization ? '▲' : '▼'}</span>
          </button>
          {showAmortization && (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-white/10">
                    <th className="text-left px-2 py-1.5">Year</th>
                    <th className="text-right px-2 py-1.5">Outstanding</th>
                    <th className="text-right px-2 py-1.5">Paid</th>
                    <th className="text-right px-2 py-1.5">Equity</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.amortization.map((row, i) => (
                    <tr key={i} className="border-b border-white/[0.03] last:border-0">
                      <td className="px-2 py-1 text-white font-medium">Yr {row.year}</td>
                      <td className="px-2 py-1 text-right text-red-400">{formatINR(row.outstanding)}</td>
                      <td className="px-2 py-1 text-right text-emerald-400">{formatINR(row.principal_paid)}</td>
                      <td className="px-2 py-1 text-right text-cyan-400">{(row.equity_pct * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


// ── Return Strategies sub-component ─────────────────────────────────
// Shown when the user pins an ambitious expected_return via the playground
// slider. Populated by an LLM call in the financial_planner agent.

const riskColor: Record<string, string> = {
  medium: 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10',
  high: 'text-orange-300 border-orange-500/30 bg-orange-500/10',
  very_high: 'text-red-300 border-red-500/30 bg-red-500/10',
}

const liquidityColor: Record<string, string> = {
  high: 'text-emerald-300',
  medium: 'text-yellow-300',
  low: 'text-red-300',
}

function ReturnStrategiesSection({ data }: { data: ReturnStrategiesPayload }) {
  const [expanded, setExpanded] = useState<number | null>(0)
  const targetPct = Math.round(data.target_return * 100)

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">🚀</span>
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          How to target {targetPct}% returns
        </h4>
      </div>
      <p className="text-[11px] text-slate-500 mb-3">
        AI-generated strategies. Not financial advice — consult a SEBI-registered advisor.
      </p>

      {data.reality_check && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 mb-3">
          <div className="flex items-start gap-2">
            <span className="text-amber-400 text-sm">⚠️</span>
            <p className="text-xs text-amber-200">{data.reality_check}</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {data.strategies.map((s: ReturnStrategy, i: number) => {
          const isOpen = expanded === i
          return (
            <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : i)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{s.name}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">{s.realistic_return}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                    <span>Allocate {s.allocation_pct}%</span>
                    <span>•</span>
                    <span>Min {formatINR(s.min_capital)}</span>
                    <span>•</span>
                    <span className={liquidityColor[s.liquidity] || 'text-slate-400'}>{s.liquidity} liquidity</span>
                  </div>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full border ${riskColor[s.risk] || riskColor.high}`}>
                  {s.risk.replace('_', ' ')}
                </span>
                <svg
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-2 text-[11px]">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">How it works</p>
                    <p className="text-slate-300 leading-snug">{s.how_it_works}</p>
                  </div>
                  {s.example && (
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Example</p>
                      <p className="text-slate-300 leading-snug">{s.example}</p>
                    </div>
                  )}
                  {s.key_risks && (
                    <div>
                      <p className="text-[10px] text-red-400 uppercase tracking-wider mb-0.5">Key risk</p>
                      <p className="text-slate-300 leading-snug">{s.key_risks}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
