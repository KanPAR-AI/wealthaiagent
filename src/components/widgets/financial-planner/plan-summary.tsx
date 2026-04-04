import { useState } from 'react'
import type { PlaygroundPayload, GoalFeasibilityStatus } from './types'
import { formatINR } from '@/lib/formatters'

interface PlanSummaryProps {
  data: PlaygroundPayload
  isHistory?: boolean
}

const statusColors: Record<GoalFeasibilityStatus, string> = {
  green: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  phased: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

const statusLabels: Record<GoalFeasibilityStatus, string> = {
  green: 'Feasible',
  yellow: 'Tight',
  red: 'Infeasible',
  phased: 'Phased',
}

export function PlanSummary({ data, isHistory }: PlanSummaryProps) {
  const { profile, goals, feasibility, nudges } = data
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null)

  const handleStartOver = () => {
    if (isHistory) return
    window.dispatchEvent(new CustomEvent('chat-quick-reply', {
      detail: { text: 'start over' }
    }))
  }

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-lg p-5 max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Financial Plan Summary</h3>
        <span className={`text-xs px-2.5 py-1 rounded-full border ${statusColors[feasibility?.status || 'red']}`}>
          {statusLabels[feasibility?.status || 'red']}
        </span>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-xs text-slate-400">Monthly SIP Needed</div>
          <div className="text-lg font-semibold text-white">{formatINR(feasibility?.total_sip_needed || 0)}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-xs text-slate-400">Available Savings</div>
          <div className="text-lg font-semibold text-white">{formatINR(feasibility?.available_savings || 0)}</div>
        </div>
        {(feasibility?.gap || 0) > 0 && (
          <div className="col-span-2 bg-red-500/10 rounded-lg p-3 border border-red-500/20">
            <div className="text-xs text-red-400">Monthly Gap</div>
            <div className="text-lg font-semibold text-red-300">{formatINR(feasibility?.gap || 0)}</div>
          </div>
        )}
      </div>

      {/* Goal breakdown */}
      <h4 className="text-sm font-medium text-slate-300 mb-3">Goal Breakdown</h4>
      <div className="space-y-2">
        {goals?.map(goal => {
          const goalStatus = feasibility?.per_goal_status?.[goal.goal_type] || 'red'
          const isExpanded = expandedGoal === goal.goal_type

          return (
            <div key={goal.goal_type} className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
              <button
                onClick={() => setExpandedGoal(isExpanded ? null : goal.goal_type)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
              >
                <span className="text-lg">{goal.icon || '🎯'}</span>
                <span className="flex-1 text-sm font-medium text-white">
                  {goal.name || goal.goal_type.replace(/_/g, ' ')}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[goalStatus]}`}>
                  {statusLabels[goalStatus]}
                </span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-white/5 text-sm space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Target</span>
                    <span className="text-white">{formatINR(goal.target_amount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Timeline</span>
                    <span className="text-white">{goal.timeline_years} years</span>
                  </div>
                  {goal.monthly_sip && (
                    <div className="flex justify-between text-slate-400">
                      <span>Monthly SIP</span>
                      <span className="text-white">{formatINR(goal.monthly_sip)}</span>
                    </div>
                  )}
                  {goal.corpus_needed && (
                    <div className="flex justify-between text-slate-400">
                      <span>Corpus Needed</span>
                      <span className="text-white">{formatINR(goal.corpus_needed)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Nudges */}
      {nudges && nudges.length > 0 && feasibility?.status !== 'green' && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Suggestions</h4>
          <div className="space-y-2">
            {nudges.slice(0, 3).map((nudge, i) => (
              <div key={i} className="flex items-center gap-2 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">
                <span className="text-amber-400 text-lg">
                  {nudge.nudge_type === 'extend_timeline' ? '⏱' : nudge.nudge_type === 'reduce_expenses' ? '💰' : nudge.nudge_type === 'increase_income' ? '📈' : '🎯'}
                </span>
                <div className="flex-1">
                  <div className="text-xs text-white">{nudge.description}</div>
                  <div className="text-[10px] text-amber-400">Saves {formatINR(nudge.impact_monthly)}/month</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="mt-4 text-[10px] text-slate-500 leading-tight">
        This plan is for educational purposes only. Consult a SEBI-registered financial advisor for personalized advice.
      </p>

      {!isHistory && (
        <button
          onClick={handleStartOver}
          className="mt-3 w-full py-2 rounded-lg border border-white/10 hover:bg-white/5
            text-slate-400 text-sm transition-all"
        >
          Start Over
        </button>
      )}
    </div>
  )
}
