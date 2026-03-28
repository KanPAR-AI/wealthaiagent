import { useState, useCallback, useMemo } from 'react'
import type { GoalDetailPayload, FinancialGoal } from './types'
import { calculateGoalCorpus, DEFAULT_INFLATION_RATE, DEFAULT_BALANCED_RETURN } from '@/lib/financial-engine'
import { formatINR } from '@/lib/formatters'
import { GoalTimeline } from './goal-timeline'

interface GoalDetailCardProps {
  data: GoalDetailPayload
  isHistory?: boolean
}

const CHILD_GOALS = ['childrens_education', 'childrens_wedding']

const PRIORITY_OPTIONS = [
  { value: 1, label: 'Must Have', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { value: 2, label: 'Should Have', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 3, label: 'Good to Have', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { value: 4, label: 'Stretch', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
]

const OPTIMIZE_OPTIONS = [
  { value: 'essentials_first', label: 'Essentials first', desc: 'Fund Must Haves before others' },
  { value: 'minimize_sip', label: 'Lowest monthly outflow', desc: 'Spread goals to minimize SIP' },
  { value: 'earliest_goals', label: 'Achieve goals sooner', desc: 'Prioritize shorter timelines' },
  { value: 'balanced', label: 'Balanced', desc: 'Even allocation across all goals' },
]

function getTimelineLabel(goal: FinancialGoal, profile: { age?: number; youngest_child_age?: number } | null): {
  label: string
  format: (years: number) => string
  min: number
  max: number
} {
  const userAge = profile?.age ?? 30
  const childAge = profile?.youngest_child_age ?? 0

  if (CHILD_GOALS.includes(goal.goal_type)) {
    return {
      label: 'When child is',
      format: (years) => `${childAge + years} yrs old`,
      min: Math.max(1, (goal.goal_type === 'childrens_education' ? 16 : 22) - childAge),
      max: Math.max(5, 30 - childAge),
    }
  }

  if (goal.goal_type === 'retirement') {
    return {
      label: 'Retire at age',
      format: (years) => `Age ${userAge + years}`,
      min: 5,
      max: Math.max(10, 70 - userAge),
    }
  }

  return {
    label: 'Achieve by',
    format: (years) => `Year ${years} (age ${userAge + years})`,
    min: 1,
    max: 40,
  }
}

export function GoalDetailCard({ data, isHistory }: GoalDetailCardProps) {
  const initialGoals = data.goals || []
  const profile = data.profile

  const [goals, setGoals] = useState<FinancialGoal[]>(initialGoals)
  const [submitted, setSubmitted] = useState(false)
  const [optimizeStrategy, setOptimizeStrategy] = useState('balanced')
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null)

  const updateGoal = useCallback((index: number, updates: Partial<FinancialGoal>) => {
    if (isHistory || submitted) return
    setGoals(prev => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      return next
    })
  }, [isHistory, submitted])

  const goalSIPs = useMemo(() => {
    return goals.map(goal => {
      const result = calculateGoalCorpus(
        goal.goal_type,
        goal.target_amount,
        goal.timeline_years,
        DEFAULT_INFLATION_RATE,
        DEFAULT_BALANCED_RETURN,
        profile?.monthly_expenses || 0,
      )
      return result.monthly_sip
    })
  }, [goals, profile])

  const totalSIP = goalSIPs.reduce((a, b) => a + b, 0)

  const handleSubmit = useCallback(() => {
    if (isHistory || submitted) return
    setSubmitted(true)
    const payload = goals.map(g => ({
      goal_type: g.goal_type,
      name: g.name,
      target_amount: g.target_amount,
      timeline_years: g.timeline_years,
      priority: g.priority,
    }))
    window.dispatchEvent(new CustomEvent('chat-quick-reply', {
      detail: { text: JSON.stringify({ goals: payload, optimize: optimizeStrategy }) }
    }))
  }, [goals, optimizeStrategy, isHistory, submitted])

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-lg p-5 max-w-2xl">
      <h3 className="text-lg font-semibold text-white mb-1">Your Goal Timeline</h3>
      <p className="text-xs text-slate-400 mb-4">Tap a goal to configure. Drag timeline sliders to adjust when each goal is achieved.</p>

      {/* Timeline visualization */}
      <div className="rounded-lg border border-white/5 bg-black/20 p-2 mb-5">
        <GoalTimeline
          goals={goals}
          userAge={profile?.age ?? 30}
          monthlySIPs={goalSIPs}
        />
      </div>

      {/* Goal cards — compact, expandable */}
      <div className="space-y-2 mb-4">
        {goals.map((goal, i) => {
          const tl = getTimelineLabel(goal, profile)
          const isExpanded = expandedGoal === goal.goal_type
          const currentPriority = PRIORITY_OPTIONS.find(p => p.value === (goal.priority || 2)) || PRIORITY_OPTIONS[1]

          return (
            <div
              key={goal.goal_type}
              className={`rounded-lg border transition-all ${
                isExpanded ? 'border-blue-500/30 bg-white/5' : 'border-white/10 bg-white/[0.02]'
              }`}
            >
              {/* Compact header — always visible */}
              <button
                onClick={() => setExpandedGoal(isExpanded ? null : goal.goal_type)}
                disabled={isHistory || submitted}
                className="w-full flex items-center gap-3 p-3 text-left disabled:opacity-60"
              >
                <span className="text-lg">{goal.icon || '🎯'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {goal.name || goal.goal_type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatINR(goal.target_amount)} · {tl.format(goal.timeline_years)} · {formatINR(goalSIPs[i])}/mo
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${currentPriority.color}`}>
                  {currentPriority.label}
                </span>
                <span className="text-slate-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
              </button>

              {/* Expanded config */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3">
                  {/* Priority selector */}
                  <div>
                    <span className="text-xs text-slate-400 mb-1.5 block">Priority</span>
                    <div className="flex gap-1.5">
                      {PRIORITY_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => updateGoal(i, { priority: opt.value })}
                          disabled={isHistory || submitted}
                          className={`flex-1 text-[10px] py-1.5 rounded-md border transition-all
                            ${(goal.priority || 2) === opt.value
                              ? opt.color + ' border-current'
                              : 'border-white/10 text-slate-500 hover:text-slate-300'
                            } disabled:opacity-40`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Target amount */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Target Amount</span>
                      <span className="text-white font-medium">{formatINR(goal.target_amount)}</span>
                    </div>
                    <input
                      type="range"
                      min={50000} max={50000000} step={50000}
                      value={goal.target_amount}
                      onChange={e => updateGoal(i, { target_amount: Number(e.target.value) })}
                      disabled={isHistory || submitted}
                      className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                        [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full
                        touch-none disabled:opacity-50"
                    />
                  </div>

                  {/* Timeline */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">{tl.label}</span>
                      <span className="text-white font-medium">{tl.format(goal.timeline_years)}</span>
                    </div>
                    <input
                      type="range"
                      min={tl.min} max={tl.max} step={1}
                      value={goal.timeline_years}
                      onChange={e => updateGoal(i, { timeline_years: Number(e.target.value) })}
                      disabled={isHistory || submitted}
                      className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                        [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full
                        touch-none disabled:opacity-50"
                    />
                  </div>

                  {/* SIP result */}
                  <div className="text-xs text-slate-300 bg-slate-800/50 rounded-md px-3 py-1.5">
                    Monthly SIP: <span className="text-white font-medium">{formatINR(goalSIPs[i])}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Total SIP */}
      <div className="flex justify-between items-center bg-blue-500/10 rounded-lg px-4 py-2.5 border border-blue-500/20 mb-4">
        <span className="text-sm text-blue-300">Total Monthly SIP</span>
        <span className="text-lg font-semibold text-white">{formatINR(totalSIP)}</span>
      </div>

      {/* Optimization strategy */}
      {!isHistory && !submitted && (
        <div className="mb-4">
          <span className="text-xs text-slate-400 mb-2 block">What should I optimize for?</span>
          <div className="grid grid-cols-2 gap-2">
            {OPTIMIZE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setOptimizeStrategy(opt.value)}
                className={`text-left p-2.5 rounded-lg border transition-all
                  ${optimizeStrategy === opt.value
                    ? 'border-blue-500/40 bg-blue-500/10'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/5'
                  }`}
              >
                <div className={`text-xs font-medium ${optimizeStrategy === opt.value ? 'text-blue-400' : 'text-white'}`}>
                  {opt.label}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!isHistory && !submitted && (
        <button
          onClick={handleSubmit}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-[0.98]
            text-white font-medium text-sm transition-all"
        >
          Continue
        </button>
      )}

      {submitted && (
        <div className="mt-4 text-center text-sm text-slate-400">Goals configured</div>
      )}
    </div>
  )
}
