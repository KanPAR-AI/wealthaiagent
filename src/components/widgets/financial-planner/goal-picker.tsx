import { useState, useCallback } from 'react'
import type { GoalPickerPayload, FinancialGoal } from './types'

interface GoalPickerProps {
  data: GoalPickerPayload
  isHistory?: boolean
}

export function GoalPicker({ data, isHistory }: GoalPickerProps) {
  const availableGoals = data.goals || []
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  const toggleGoal = useCallback((goalType: string) => {
    if (isHistory || submitted) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(goalType)) next.delete(goalType)
      else next.add(goalType)
      return next
    })
  }, [isHistory, submitted])

  const handleSubmit = useCallback(() => {
    if (isHistory || submitted || selected.size === 0) return
    setSubmitted(true)
    const selectedGoals = availableGoals
      .filter(g => selected.has(g.goal_type))
      .map(g => ({
        goal_type: g.goal_type,
        target_amount: (g.default_target_lakh || 10) * 100000,
        timeline_years: g.timeline_years || 5,
        priority: 2,
      }))
    window.dispatchEvent(new CustomEvent('chat-quick-reply', {
      detail: { text: JSON.stringify(selectedGoals) }
    }))
  }, [availableGoals, selected, isHistory, submitted])

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-lg p-5 max-w-lg">
      <h3 className="text-lg font-semibold text-white mb-1">Choose Your Goals</h3>
      <p className="text-sm text-slate-400 mb-4">Select the financial goals that matter to you</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {availableGoals.map(goal => {
          const isSelected = selected.has(goal.goal_type)
          return (
            <button
              key={goal.goal_type}
              onClick={() => toggleGoal(goal.goal_type)}
              disabled={isHistory || submitted}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all
                active:scale-[0.96] touch-none disabled:opacity-50
                ${isSelected
                  ? 'border-blue-500 bg-blue-500/15 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
            >
              <span className="text-2xl">{goal.icon || '🎯'}</span>
              <span className="text-xs font-medium text-white text-center leading-tight">
                {goal.name || goal.goal_type.replace(/_/g, ' ')}
              </span>
              {goal.default_target_lakh && (
                <span className="text-[10px] text-slate-400">
                  ₹{goal.default_target_lakh}L default
                </span>
              )}
            </button>
          )
        })}
      </div>

      {!isHistory && !submitted && (
        <button
          onClick={handleSubmit}
          disabled={selected.size === 0}
          className="mt-5 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-[0.98]
            text-white font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {selected.size > 0 ? `Continue with ${selected.size} goal${selected.size > 1 ? 's' : ''}` : 'Select at least one goal'}
        </button>
      )}

      {submitted && (
        <div className="mt-4 text-center text-sm text-slate-400">
          {selected.size} goal{selected.size > 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  )
}
