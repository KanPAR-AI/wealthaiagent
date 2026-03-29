import type { Nudge } from './types'
import { formatINR } from '@/lib/formatters'

interface NudgePanelProps {
  nudges: Nudge[]
  onApply?: (nudge: Nudge) => void
  isHistory?: boolean
}

const nudgeIcons: Record<string, string> = {
  extend_timeline: '⏱',
  reduce_expenses: '💰',
  increase_income: '📈',
  reduce_target: '🎯',
  change_allocation: '⚖️',
  higher_risk: '🔥',
  entrepreneurship: '🚀',
  phased_retirement: '🔄',
}

export function NudgePanel({ nudges, onApply, isHistory }: NudgePanelProps) {
  if (!nudges || nudges.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
      <h4 className="text-sm font-medium text-amber-300 mb-3 flex items-center gap-1.5">
        <span>💡</span> Suggestions to close the gap
      </h4>

      <div className="space-y-2.5">
        {nudges.map((nudge, i) => (
          <div
            key={i}
            className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2.5 border border-white/5
              transition-all hover:bg-white/10"
          >
            <span className="text-xl flex-shrink-0">
              {nudgeIcons[nudge.nudge_type] || '💡'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white">{nudge.description}</div>
              <div className="text-xs text-amber-400 mt-0.5">
                Saves {formatINR(nudge.impact_monthly)}/month
              </div>
            </div>
            {onApply && !isHistory && (
              <button
                onClick={() => onApply(nudge)}
                className="flex-shrink-0 text-xs px-3 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30
                  text-amber-300 font-medium transition-all active:scale-95"
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
