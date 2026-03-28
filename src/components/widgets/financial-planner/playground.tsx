import { useState, useCallback, useMemo, useRef } from 'react'
import type { PlaygroundPayload, FinancialProfile, FinancialGoal, Nudge, FeasibilityStatus } from './types'
import { computeRiverData, runMonteCarloSimulation, checkFeasibility, generateNudges } from '@/lib/financial-engine'
import { formatINR, formatPercent } from '@/lib/formatters'
import { RiverVisualization } from './river-visualization'
import { NudgePanel } from './nudge-panel'

interface PlaygroundProps {
  data: PlaygroundPayload
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

export function Playground({ data, isHistory }: PlaygroundProps) {
  const [profile, setProfile] = useState<FinancialProfile>(data.profile)
  const [assumptions, setAssumptions] = useState(data.assumptions || {
    inflation_rate: 0.06,
    income_growth_rate: 0.0,  // constant income by default
    expected_return: 0.10,
  })
  const [queryText, setQueryText] = useState('')
  const [loading, setLoading] = useState(false)
  const rafRef = useRef<number>(0)

  const goals = data.goals || []

  // Recompute everything client-side when sliders change
  const computed = useMemo(() => {
    const river = computeRiverData(
      profile, goals, 30,
      assumptions.inflation_rate,
      assumptions.income_growth_rate,
      assumptions.expected_return,
    )
    const mc = runMonteCarloSimulation(river, 500, 0.15, assumptions.expected_return)
    const feas = checkFeasibility(profile, goals, assumptions.inflation_rate, assumptions.expected_return)
    const nudgeList = feas.status !== 'green'
      ? generateNudges(profile, goals, feas.gap, assumptions.inflation_rate, assumptions.expected_return)
      : []
    return { river, mc, feas, nudges: nudgeList }
  }, [profile, goals, assumptions])

  const handleSliderChange = useCallback((key: string, value: number) => {
    if (isHistory) return
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      if (key in assumptions) {
        setAssumptions(prev => ({ ...prev, [key]: value }))
      } else {
        setProfile(prev => ({ ...prev, [key]: value }))
      }
    })
  }, [isHistory, assumptions])

  const handleNudgeApply = useCallback((nudge: Nudge) => {
    if (nudge.nudge_type === 'reduce_expenses' && nudge.adjusted_value) {
      setProfile(prev => ({ ...prev, monthly_expenses: Number(nudge.adjusted_value) }))
    } else if (nudge.nudge_type === 'increase_income' && nudge.adjusted_value) {
      setProfile(prev => ({ ...prev, monthly_income: Number(nudge.adjusted_value) }))
    }
  }, [])

  const handleQuery = useCallback(() => {
    if (!queryText.trim() || isHistory) return
    setLoading(true)
    window.dispatchEvent(new CustomEvent('chat-quick-reply', {
      detail: { text: queryText.trim() }
    }))
    setQueryText('')
    setTimeout(() => setLoading(false), 2000) // Reset after expected server response
  }, [queryText, isHistory])

  const handleGeneratePlan = useCallback(() => {
    if (isHistory) return
    window.dispatchEvent(new CustomEvent('chat-quick-reply', {
      detail: { text: 'generate plan summary' }
    }))
  }, [isHistory])

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-lg p-5 max-w-2xl">
      {/* Header with feasibility badge */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Financial Playground</h3>
        <span className={`text-xs px-2.5 py-1 rounded-full border ${statusColors[computed.feas.status]}`}>
          {statusLabels[computed.feas.status]}
          {computed.feas.gap > 0 && ` ${formatINR(computed.feas.gap)}/mo`}
        </span>
      </div>

      {/* River visualization */}
      <div className="rounded-lg border border-white/5 bg-black/20 p-2 mb-4">
        <RiverVisualization
          riverData={computed.river}
          monteCarlo={computed.mc}
        />
      </div>

      {/* Control sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <SliderControl
          label="Monthly Income"
          value={profile.monthly_income}
          min={10000} max={1000000} step={5000}
          format={formatINR}
          onChange={v => handleSliderChange('monthly_income', v)}
          disabled={isHistory}
        />
        <SliderControl
          label="Monthly Expenses"
          value={profile.monthly_expenses}
          min={5000} max={800000} step={5000}
          format={formatINR}
          onChange={v => handleSliderChange('monthly_expenses', v)}
          disabled={isHistory}
        />
        <SliderControl
          label="Go part-time at"
          value={profile.semi_retirement_age ?? 55}
          min={Math.max(profile.age + 1, 35)} max={70} step={1}
          format={v => `Age ${v}`}
          onChange={v => {
            handleSliderChange('semi_retirement_age', v)
            // Push retirement age forward if needed
            if (v > (profile.retirement_age ?? 60)) {
              handleSliderChange('retirement_age', v)
            }
          }}
          disabled={isHistory}
        />
        <SliderControl
          label="Fully retire at"
          value={profile.retirement_age ?? 60}
          min={profile.semi_retirement_age ?? 55} max={75} step={1}
          format={v => `Age ${v}`}
          onChange={v => handleSliderChange('retirement_age', v)}
          disabled={isHistory}
        />
        <SliderControl
          label="Children"
          value={profile.num_children ?? 0}
          min={0} max={4} step={1}
          format={v => `${v}`}
          onChange={v => handleSliderChange('num_children', v)}
          disabled={isHistory}
        />
        {(profile.num_children ?? 0) > 0 && (
          <SliderControl
            label="Youngest Child Age"
            value={profile.youngest_child_age ?? 0}
            min={0} max={18} step={1}
            format={v => `${v} yrs`}
            onChange={v => handleSliderChange('youngest_child_age', v)}
            disabled={isHistory}
          />
        )}
        <SliderControl
          label="Expected Return"
          value={assumptions.expected_return}
          min={0.04} max={0.18} step={0.01}
          format={formatPercent}
          onChange={v => handleSliderChange('expected_return', v)}
          disabled={isHistory}
        />
      </div>

      {/* Nudge panel */}
      {computed.feas.status !== 'green' && (
        <div className="mb-4">
          <NudgePanel
            nudges={computed.nudges}
            onApply={handleNudgeApply}
            isHistory={isHistory}
          />
        </div>
      )}

      {/* What-if query input */}
      {!isHistory && (
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={queryText}
            onChange={e => setQueryText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleQuery()}
            placeholder='Ask "What if I retire at 55?" or "Delay home by 3 years"'
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
              placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
          />
          <button
            onClick={handleQuery}
            disabled={!queryText.trim() || loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium
              transition-all disabled:opacity-40 active:scale-95"
          >
            {loading ? '...' : 'Ask'}
          </button>
        </div>
      )}

      {/* Generate plan button */}
      {!isHistory && (
        <button
          onClick={handleGeneratePlan}
          className="w-full py-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20
            text-blue-400 text-sm font-medium transition-all active:scale-[0.98]"
        >
          Generate Plan Summary
        </button>
      )}
    </div>
  )
}

// ── Slider helper component ──────────────────────────────────────────

interface SliderControlProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
  disabled?: boolean
}

function SliderControl({ label, value, min, max, step, format, onChange, disabled }: SliderControlProps) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-medium text-white">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full
          touch-none disabled:opacity-50"
      />
    </div>
  )
}
