import { useMemo } from 'react'
import type { FinancialGoal } from './types'
import { formatINR } from '@/lib/formatters'

interface GoalTimelineProps {
  goals: FinancialGoal[]
  userAge: number
  monthlySIPs: number[]
}

const PRIORITY_COLORS: Record<number, { bar: string; text: string; label: string }> = {
  1: { bar: '#ef4444', text: 'text-red-400', label: 'Must Have' },
  2: { bar: '#f59e0b', text: 'text-amber-400', label: 'Should Have' },
  3: { bar: '#22c55e', text: 'text-emerald-400', label: 'Good to Have' },
  4: { bar: '#6366f1', text: 'text-indigo-400', label: 'Stretch' },
}

export function GoalTimeline({ goals, userAge, monthlySIPs }: GoalTimelineProps) {
  const maxYears = Math.max(...goals.map(g => g.timeline_years), 10)

  const pad = { top: 10, right: 20, bottom: 30, left: 120 }
  const width = 560
  const rowH = 40
  const height = pad.top + goals.length * rowH + pad.bottom
  const plotW = width - pad.left - pad.right

  const xScale = (year: number) => pad.left + (year / maxYears) * plotW

  // Year tick marks (every 5 years)
  const yearTicks = useMemo(() => {
    const ticks = []
    for (let y = 0; y <= maxYears; y += 5) ticks.push(y)
    if (ticks[ticks.length - 1] !== maxYears) ticks.push(maxYears)
    return ticks
  }, [maxYears])

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* Grid lines */}
      {yearTicks.map(y => (
        <g key={y}>
          <line
            x1={xScale(y)} y1={pad.top}
            x2={xScale(y)} y2={height - pad.bottom}
            stroke="#334155" strokeWidth={0.5} strokeDasharray="3,3"
          />
          <text
            x={xScale(y)} y={height - 10}
            textAnchor="middle" fill="#94a3b8" fontSize={9}
          >
            {y === 0 ? 'Now' : `Yr ${y} (${userAge + y})`}
          </text>
        </g>
      ))}

      {/* Goal bars */}
      {goals.map((goal, i) => {
        const y = pad.top + i * rowH + 8
        const barH = 22
        const barW = Math.max((goal.timeline_years / maxYears) * plotW, 4)
        const priority = goal.priority || 2
        const colors = PRIORITY_COLORS[priority] || PRIORITY_COLORS[2]

        // Milestone markers — 25%, 50%, 75% completion points
        const milestones = [
          { pct: 25, year: Math.round(goal.timeline_years * 0.25) },
          { pct: 50, year: Math.round(goal.timeline_years * 0.5) },
          { pct: 75, year: Math.round(goal.timeline_years * 0.75) },
        ].filter(m => m.year > 0 && m.year < goal.timeline_years)

        return (
          <g key={goal.goal_type}>
            {/* Goal label */}
            <text
              x={pad.left - 8} y={y + barH / 2 + 4}
              textAnchor="end" fill="#e2e8f0" fontSize={10}
            >
              {(goal.icon || '') + ' ' + (goal.name || goal.goal_type.replace(/_/g, ' '))}
            </text>

            {/* Bar background */}
            <rect
              x={pad.left} y={y}
              width={barW} height={barH}
              rx={4} fill={colors.bar} fillOpacity={0.2}
              stroke={colors.bar} strokeWidth={1} strokeOpacity={0.4}
            />

            {/* Gradient fill */}
            <rect
              x={pad.left} y={y}
              width={barW} height={barH}
              rx={4} fill={colors.bar} fillOpacity={0.15}
            />

            {/* Milestone dots */}
            {milestones.map(m => (
              <g key={m.pct}>
                <circle
                  cx={xScale(m.year)} cy={y + barH / 2}
                  r={3} fill={colors.bar} fillOpacity={0.6}
                  stroke="#1e293b" strokeWidth={1}
                />
                <text
                  x={xScale(m.year)} y={y - 2}
                  textAnchor="middle" fill="#94a3b8" fontSize={7}
                >
                  {m.pct}%
                </text>
              </g>
            ))}

            {/* Target marker (end of bar) */}
            <circle
              cx={xScale(goal.timeline_years)} cy={y + barH / 2}
              r={5} fill={colors.bar} stroke="#1e293b" strokeWidth={1.5}
            />

            {/* Target amount at end */}
            <text
              x={xScale(goal.timeline_years) + 10} y={y + barH / 2 + 3}
              fill="#94a3b8" fontSize={8}
            >
              {formatINR(goal.target_amount)}
            </text>

            {/* SIP label inside bar (if wide enough) */}
            {barW > 80 && (
              <text
                x={pad.left + 6} y={y + barH / 2 + 3}
                fill="#e2e8f0" fontSize={8} fontWeight={500}
              >
                {formatINR(monthlySIPs[i])}/mo
              </text>
            )}
          </g>
        )
      })}

      {/* "Today" marker */}
      <line
        x1={pad.left} y1={pad.top}
        x2={pad.left} y2={height - pad.bottom}
        stroke="#3b82f6" strokeWidth={1.5}
      />
    </svg>
  )
}
