import { useState, useCallback } from 'react'
import type { OnboardingPayload, OnboardingField } from './types'

interface OnboardingProfileProps {
  data: OnboardingPayload
  isHistory?: boolean
}

interface ChildEntry {
  name: string
  age_years: number
}

function logSlider(position: number, min: number, max: number): number {
  const minLog = Math.log(Math.max(min, 1))
  const maxLog = Math.log(max)
  const scale = (maxLog - minLog) / 100
  return Math.round(Math.exp(minLog + scale * position))
}

function logPosition(value: number, min: number, max: number): number {
  const minLog = Math.log(Math.max(min, 1))
  const maxLog = Math.log(max)
  const scale = (maxLog - minLog) / 100
  return Math.round((Math.log(Math.max(value, 1)) - minLog) / scale)
}

const riskLabels: Record<string, { label: string; color: string; desc: string }> = {
  conservative: { label: 'Low Risk', color: 'border-blue-500 bg-blue-500/15 text-blue-400', desc: 'Stable returns, capital protection' },
  moderate: { label: 'Medium Risk', color: 'border-emerald-500 bg-emerald-500/15 text-emerald-400', desc: 'Balanced growth & stability' },
  aggressive: { label: 'High Risk', color: 'border-orange-500 bg-orange-500/15 text-orange-400', desc: 'Maximum growth potential' },
}

export function OnboardingProfile({ data, isHistory }: OnboardingProfileProps) {
  const fields = data.fields || []

  const defaults: Record<string, number | string> = {}
  for (const f of fields) {
    if (f.type === 'select') {
      defaults[f.name] = f.options?.[1] ?? f.options?.[0] ?? ''
    } else {
      defaults[f.name] = f.default ?? f.min ?? 0
    }
  }

  const [values, setValues] = useState<Record<string, number | string>>(defaults)
  const [children, setChildren] = useState<ChildEntry[]>([])
  const [submitted, setSubmitted] = useState(false)

  const handleSlider = useCallback((name: string, field: OnboardingField, rawValue: number) => {
    const value = field.scale === 'log'
      ? logSlider(rawValue, field.min ?? 0, field.max ?? 100)
      : rawValue
    setValues(prev => ({ ...prev, [name]: value }))
  }, [])

  const handleSelect = useCallback((name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }, [])

  const handleChildrenCount = useCallback((delta: number) => {
    setChildren(prev => {
      const newCount = Math.max(0, Math.min(5, prev.length + delta))
      if (newCount > prev.length) {
        return [...prev, ...Array.from({ length: newCount - prev.length }, (_, i) => ({
          name: `Child ${prev.length + i + 1}`,
          age_years: 5,
        }))]
      }
      return prev.slice(0, newCount)
    })
    setValues(prev => ({ ...prev, num_children: Math.max(0, Math.min(5, children.length + delta)) }))
  }, [children.length])

  const handleChildAge = useCallback((index: number, age: number) => {
    setChildren(prev => prev.map((c, i) => i === index ? { ...c, age_years: age } : c))
  }, [])

  const handleSubmit = useCallback(() => {
    if (isHistory || submitted) return
    setSubmitted(true)
    const retireAge = (values.retirement_age as number) ?? 60
    const payload: Record<string, unknown> = {
      age: (values.age as number) ?? 30,
      monthly_income: (values.monthly_income as number) ?? 75000,
      monthly_expenses: (values.monthly_expenses as number) ?? 40000,
      existing_investments: (values.existing_investments as number) ?? 0,
      retirement_age: retireAge,
      semi_retirement_age: retireAge,
      owns_primary_residence: values.owns_primary_residence ?? 'no',
      risk_tolerance: values.risk_tolerance ?? 'moderate',
      num_children: children.length,
    }
    if (children.length > 0) {
      payload.children = children
    }
    window.dispatchEvent(new CustomEvent('chat-quick-reply', {
      detail: { text: JSON.stringify(payload) }
    }))
  }, [values, children, isHistory, submitted])

  const formatValue = (field: OnboardingField, value: number) => {
    if (field.unit === '₹') {
      if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(1)}Cr`
      if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(1)}L`
      if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`
      return `₹${value}`
    }
    return `${value}${field.unit ? ` ${field.unit}` : ''}`
  }

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-lg p-5 max-w-md">
      <h3 className="text-lg font-semibold text-white mb-4">Your Financial Profile</h3>

      <div className="space-y-5">
        {fields.map(field => {
          // ── Select field (risk profile, yes/no) ──
          if (field.type === 'select' && field.options) {
            const selected = (values[field.name] as string) || field.options[0]
            const isRisk = field.name === 'risk_tolerance'
            return (
              <div key={field.name}>
                <label className="text-sm text-slate-300 mb-2 block">{field.label}</label>
                <div className={`grid gap-2 ${isRisk ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {field.options.map(opt => {
                    const isActive = selected === opt
                    const risk = isRisk ? riskLabels[opt] : null
                    return (
                      <button
                        key={opt}
                        onClick={() => handleSelect(field.name, opt)}
                        disabled={isHistory || submitted}
                        className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all
                          active:scale-[0.97] disabled:opacity-50
                          ${isActive
                            ? (risk ? risk.color : 'border-blue-500 bg-blue-500/15 text-blue-400')
                            : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                          }`}
                      >
                        {risk ? risk.label : opt.charAt(0).toUpperCase() + opt.slice(1)}
                        {risk && isActive && (
                          <span className="block text-[9px] mt-0.5 opacity-70 font-normal">{risk.desc}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          }

          // ── Stepper field (children count + per-child ages) ──
          if (field.type === 'stepper') {
            return (
              <div key={field.name}>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm text-slate-300">{field.label}</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleChildrenCount(-1)}
                      disabled={isHistory || submitted || children.length <= (field.min ?? 0)}
                      className="w-7 h-7 rounded-full border border-white/20 bg-white/5 text-white
                        flex items-center justify-center text-sm active:scale-90 disabled:opacity-30"
                    >−</button>
                    <span className="text-sm font-medium text-white w-4 text-center">{children.length}</span>
                    <button
                      onClick={() => handleChildrenCount(1)}
                      disabled={isHistory || submitted || children.length >= (field.max ?? 5)}
                      className="w-7 h-7 rounded-full border border-white/20 bg-white/5 text-white
                        flex items-center justify-center text-sm active:scale-90 disabled:opacity-30"
                    >+</button>
                  </div>
                </div>
                {/* Per-child age inputs */}
                {children.length > 0 && (
                  <div className="space-y-2 mt-2 pl-2 border-l-2 border-white/10">
                    {children.map((child, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-16">Child {i + 1}</span>
                        <input
                          type="range"
                          min={0}
                          max={25}
                          step={1}
                          value={child.age_years}
                          onChange={e => handleChildAge(i, Number(e.target.value))}
                          disabled={isHistory || submitted}
                          className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                            [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full
                            touch-none disabled:opacity-50"
                        />
                        <span className="text-xs font-medium text-white w-14 text-right">
                          {child.age_years === 0 ? '< 1 yr' : `${child.age_years} yrs`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          // ── Slider field (default) ──
          const value = (values[field.name] as number) ?? field.default ?? 0
          const isLog = field.scale === 'log'
          const sliderVal = isLog ? logPosition(value, field.min ?? 0, field.max ?? 100) : value

          return (
            <div key={field.name}>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-sm text-slate-300">{field.label}</label>
                <span className="text-sm font-medium text-white">
                  {formatValue(field, value)}
                </span>
              </div>
              <input
                type="range"
                min={isLog ? 0 : (field.min ?? 0)}
                max={isLog ? 100 : (field.max ?? 100)}
                step={isLog ? 1 : (field.step ?? 1)}
                value={sliderVal}
                onChange={e => handleSlider(field.name, field, Number(e.target.value))}
                disabled={isHistory || submitted}
                className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:active:scale-110
                  touch-none disabled:opacity-50"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-0.5">
                <span>{formatValue(field, field.min ?? 0)}</span>
                <span>{formatValue(field, field.max ?? 100)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {!isHistory && !submitted && (
        <button
          onClick={handleSubmit}
          className="mt-5 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-[0.98]
            text-white font-medium text-sm transition-all"
        >
          Continue
        </button>
      )}

      {submitted && !isHistory && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="text-sm text-slate-400">Profile submitted</span>
          <button
            onClick={() => setSubmitted(false)}
            className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            Edit
          </button>
        </div>
      )}
      {submitted && isHistory && (
        <div className="mt-4 text-center text-sm text-slate-400">Profile submitted</div>
      )}
    </div>
  )
}
