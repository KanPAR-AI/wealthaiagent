import { useState } from 'react'
import type { PrescriptivePlanPayload, ActionItem, ChildPlan, InsuranceRecommendation } from './types'
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
}

export function PrescriptivePlan({ data, isHistory }: PrescriptivePlanProps) {
  const [expandedChild, setExpandedChild] = useState<number | null>(null)
  const { action_items = [], child_plans = [], insurance } = data

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
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5 text-xs">●</span>
                    <div className="flex-1">
                      <p className="text-sm text-white">{item.instruction}</p>
                      {item.expected_return != null && (
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Expected return: {(item.expected_return * 100).toFixed(0)}% p.a.
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
                      {formatINR(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Per-Child Education Plans */}
      {child_plans.length > 0 && (
        <div className="mb-5">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Children's Education Plans
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
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
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
    </div>
  )
}
