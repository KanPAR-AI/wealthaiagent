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
        name: g.name,
        icon: g.icon,
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

      <div className="grid grid-cols-2 gap-2.5">
        {availableGoals.map(goal => {
          const isSelected = selected.has(goal.goal_type)
          return (
            <button
              key={goal.goal_type}
              onClick={() => toggleGoal(goal.goal_type)}
              disabled={isHistory || submitted}
              className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all text-left
                active:scale-[0.97] disabled:opacity-50
                ${isSelected
                  ? 'border-blue-500 bg-blue-500/15 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
            >
              <span className="text-xl mt-0.5 shrink-0">{goal.icon || '🎯'}</span>
              <div className="min-w-0">
                <div className="text-xs font-medium text-white leading-tight">
                  {goal.name || goal.goal_type.replace(/_/g, ' ')}
                </div>
                {goal.description && (
                  <div className="text-[10px] text-slate-500 leading-snug mt-0.5">
                    {goal.description}
                  </div>
                )}
                {goal.default_target_lakh && (
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    ~₹{goal.default_target_lakh}L
                  </div>
                )}
              </div>
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

      {submitted && !isHistory && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="text-sm text-slate-400">{selected.size} goal{selected.size > 1 ? 's' : ''} selected</span>
          <button
            onClick={() => setSubmitted(false)}
            className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            Edit
          </button>
        </div>
      )}
      {submitted && isHistory && (
        <div className="mt-4 text-center text-sm text-slate-400">
          {selected.size} goal{selected.size > 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  )
}
