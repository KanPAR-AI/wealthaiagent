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
    income_growth_rate: 0.0,
    expected_return: 0.10,
  })
  const [queryText, setQueryText] = useState('')
  const [loading, setLoading] = useState(false)
  const rafRef = useRef<number>(0)

  const goals = data.goals || []

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

  const updateProfile = useCallback((updates: Partial<FinancialProfile>) => {
    if (isHistory) return
    setProfile(prev => ({ ...prev, ...updates }))
  }, [isHistory])

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
    setTimeout(() => setLoading(false), 2000)
  }, [queryText, isHistory])

  const handleGeneratePlan = useCallback(() => {
    if (isHistory) return
    window.dispatchEvent(new CustomEvent('chat-quick-reply', {
      detail: { text: 'generate plan summary' }
    }))
  }, [isHistory])

  const numChildren = profile.num_children ?? 0
  const retireAge = profile.retirement_age ?? 60
  const semiRetAge = profile.semi_retirement_age ?? retireAge
  const hasPartTime = semiRetAge < retireAge

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
      <div className="rounded-lg border border-white/5 bg-black/20 p-2 mb-5">
        <RiverVisualization
          riverData={computed.river}
          monteCarlo={computed.mc}
        />
      </div>

      {/* ── Section: Income & Expenses ── */}
      <SectionHeader title="Income & Expenses" hint="Your current cash flow — savings = income minus expenses" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <SliderControl
          label="Monthly Income"
          value={profile.monthly_income}
          min={10000} max={1000000} step={5000}
          format={formatINR}
          hint="Your total monthly take-home pay"
          onChange={v => handleSliderChange('monthly_income', v)}
          disabled={isHistory}
        />
        <SliderControl
          label="Monthly Expenses"
          value={profile.monthly_expenses}
          min={5000} max={800000} step={5000}
          format={formatINR}
          hint="All household spending excluding investments"
          onChange={v => handleSliderChange('monthly_expenses', v)}
          disabled={isHistory}
        />
      </div>

      {/* ── Section: Life Phases ── */}
      <SectionHeader title="Life Phases" hint="When you plan to slow down and stop working" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <SliderControl
          label="Fully retire at"
          value={retireAge}
          min={Math.max(profile.age + 1, 40)} max={75} step={1}
          format={v => `Age ${v}`}
          hint="No income after this age"
          onChange={v => handleSliderChange('retirement_age', v)}
          disabled={isHistory}
        />

        {/* Part-time toggle + slider */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-slate-400">Part-time phase</span>
            <button
              onClick={() => {
                if (isHistory) return
                if (hasPartTime) {
                  updateProfile({ semi_retirement_age: retireAge })
                } else {
                  updateProfile({ semi_retirement_age: Math.max(profile.age + 1, retireAge - 5) })
                }
              }}
              disabled={isHistory}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-all
                ${hasPartTime
                  ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-400'
                  : 'border-white/10 bg-white/5 text-slate-500'
                }`}
            >
              {hasPartTime ? 'On' : 'Off'}
            </button>
          </div>
          {hasPartTime && (
            <input
              type="range"
              min={Math.max(profile.age + 1, 35)}
              max={retireAge - 1}
              step={1}
              value={semiRetAge}
              onChange={e => updateProfile({ semi_retirement_age: Number(e.target.value) })}
              disabled={isHistory}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full
                touch-none disabled:opacity-50"
            />
          )}
          <div className="text-[10px] text-slate-500 mt-0.5">
            {hasPartTime
              ? `50% income from age ${semiRetAge} to ${retireAge}`
              : 'Enable to model a low-stress job before full retirement'
            }
          </div>
        </div>
      </div>

      {/* ── Section: Family ── */}
      <SectionHeader title="Family" hint="Children add age-based expenses (school, college, etc.)" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {/* Children stepper */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-slate-400">Children</span>
            <span className="text-xs font-medium text-white">{numChildren}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateProfile({ num_children: Math.max(0, numChildren - 1) })}
              disabled={isHistory || numChildren <= 0}
              className="w-9 h-9 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg font-bold
                transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              -
            </button>
            <div className="flex-1 text-center text-sm font-medium text-white">
              {numChildren === 0 ? 'No children' : `${numChildren} child${numChildren > 1 ? 'ren' : ''}`}
            </div>
            <button
              onClick={() => updateProfile({ num_children: Math.min(4, numChildren + 1) })}
              disabled={isHistory || numChildren >= 4}
              className="w-9 h-9 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg font-bold
                transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Costs: ~8K/mo (0-3), ~15K (4-14), ~25K (15-17), ~35K (18-22)
          </div>
        </div>

        {numChildren > 0 && (
          <SliderControl
            label="Youngest Child Age"
            value={profile.youngest_child_age ?? 0}
            min={0} max={18} step={1}
            format={v => `${v} yrs`}
            hint="Older children assumed 2 years apart"
            onChange={v => handleSliderChange('youngest_child_age', v)}
            disabled={isHistory}
          />
        )}
      </div>

      {/* ── Section: Assumptions ── */}
      <SectionHeader title="Assumptions" hint="Market assumptions used for projections" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <SliderControl
          label="Expected Return"
          value={assumptions.expected_return}
          min={0.04} max={0.18} step={0.01}
          format={formatPercent}
          hint="Blended portfolio return (equity + debt)"
          onChange={v => handleSliderChange('expected_return', v)}
          disabled={isHistory}
        />
        <SliderControl
          label="Inflation Rate"
          value={assumptions.inflation_rate}
          min={0.02} max={0.12} step={0.005}
          format={formatPercent}
          hint="How fast prices rise each year"
          onChange={v => handleSliderChange('inflation_rate', v)}
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

// ── Section header component ──────────────────────────────────────────

function SectionHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-2.5">
      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{title}</h4>
      <p className="text-[10px] text-slate-500">{hint}</p>
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
  hint?: string
}

function SliderControl({ label, value, min, max, step, format, onChange, disabled, hint }: SliderControlProps) {
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
      {hint && <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  )
}
