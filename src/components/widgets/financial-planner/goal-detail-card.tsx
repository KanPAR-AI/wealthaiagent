import { useState, useCallback, useMemo } from 'react'
import type { GoalDetailPayload, FinancialGoal } from './types'
import { calculateGoalCorpus, DEFAULT_INFLATION_RATE, DEFAULT_BALANCED_RETURN } from '@/lib/financial-engine'
import { formatINR } from '@/lib/formatters'

interface GoalDetailCardProps {
  data: GoalDetailPayload
  isHistory?: boolean
}

const CHILD_GOALS = ['childrens_education', 'childrens_wedding']

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
    label: 'Timeline',
    format: (years) => `${years} yrs (age ${userAge + years})`,
    min: 1,
    max: 40,
  }
}

export function GoalDetailCard({ data, isHistory }: GoalDetailCardProps) {
  const initialGoals = data.goals || []
  const profile = data.profile

  const [goals, setGoals] = useState<FinancialGoal[]>(initialGoals)
  const [submitted, setSubmitted] = useState(false)

  const updateGoal = useCallback((index: number, field: string, value: number) => {
    if (isHistory || submitted) return
    setGoals(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
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
      detail: { text: JSON.stringify({ goals: payload }) }
    }))
  }, [goals, isHistory, submitted])

  const priorityLabels: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' }
  const priorityColors: Record<number, string> = {
    1: 'bg-red-500/20 text-red-400',
    2: 'bg-yellow-500/20 text-yellow-400',
    3: 'bg-green-500/20 text-green-400',
  }

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-lg p-5 max-w-lg">
      <h3 className="text-lg font-semibold text-white mb-4">Configure Your Goals</h3>

      <div className="space-y-5">
        {goals.map((goal, i) => {
          const tl = getTimelineLabel(goal, profile)
          return (
            <div key={goal.goal_type} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{goal.icon || '🎯'}</span>
                <span className="font-medium text-white">{goal.name || goal.goal_type.replace(/_/g, ' ')}</span>
                <button
                  onClick={() => {
                    const next = ((goal.priority || 2) % 3) + 1
                    updateGoal(i, 'priority', next)
                  }}
                  disabled={isHistory || submitted}
                  className={`ml-auto text-xs px-2 py-0.5 rounded-full ${priorityColors[goal.priority || 2]}`}
                >
                  {priorityLabels[goal.priority || 2]}
                </button>
              </div>

              {/* Target amount slider */}
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Target Amount</span>
                  <span className="text-white font-medium">{formatINR(goal.target_amount)}</span>
                </div>
                <input
                  type="range"
                  min={50000}
                  max={50000000}
                  step={50000}
                  value={goal.target_amount}
                  onChange={e => updateGoal(i, 'target_amount', Number(e.target.value))}
                  disabled={isHistory || submitted}
                  className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full
                    touch-none disabled:opacity-50"
                />
              </div>

              {/* Timeline slider — context-aware label */}
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">{tl.label}</span>
                  <span className="text-white font-medium">{tl.format(goal.timeline_years)}</span>
                </div>
                <input
                  type="range"
                  min={tl.min}
                  max={tl.max}
                  step={1}
                  value={goal.timeline_years}
                  onChange={e => updateGoal(i, 'timeline_years', Number(e.target.value))}
                  disabled={isHistory || submitted}
                  className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full
                    touch-none disabled:opacity-50"
                />
              </div>

              {/* Computed SIP */}
              <div className="text-sm text-slate-300 bg-slate-800/50 rounded-md px-3 py-1.5">
                Monthly SIP needed: <span className="text-white font-medium">{formatINR(goalSIPs[i])}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Total SIP */}
      <div className="mt-4 flex justify-between items-center bg-blue-500/10 rounded-lg px-4 py-2.5 border border-blue-500/20">
        <span className="text-sm text-blue-300">Total Monthly SIP</span>
        <span className="text-lg font-semibold text-white">
          {formatINR(goalSIPs.reduce((a, b) => a + b, 0))}
        </span>
      </div>

      {!isHistory && !submitted && (
        <button
          onClick={handleSubmit}
          className="mt-4 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-[0.98]
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
