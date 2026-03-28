import { useState, useCallback } from 'react'
import type { OnboardingPayload, FinancialProfile } from './types'

interface OnboardingProfileProps {
  data: OnboardingPayload
  isHistory?: boolean
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

export function OnboardingProfile({ data, isHistory }: OnboardingProfileProps) {
  const fields = data.fields || []

  const defaults: Record<string, number> = {}
  for (const f of fields) {
    defaults[f.name] = f.default ?? f.min ?? 0
  }

  const [values, setValues] = useState<Record<string, number>>(defaults)
  const [submitted, setSubmitted] = useState(false)

  const handleSlider = useCallback((name: string, field: typeof fields[0], rawValue: number) => {
    const value = field.scale === 'log'
      ? logSlider(rawValue, field.min ?? 0, field.max ?? 100)
      : rawValue
    setValues(prev => ({ ...prev, [name]: value }))
  }, [])

  const handleSubmit = useCallback(() => {
    if (isHistory || submitted) return
    setSubmitted(true)
    const profile: FinancialProfile = {
      age: values.age ?? 30,
      monthly_income: values.monthly_income ?? 75000,
      monthly_expenses: values.monthly_expenses ?? 40000,
      existing_investments: values.existing_investments ?? 0,
      num_children: values.num_children ?? 0,
      youngest_child_age: values.youngest_child_age ?? 0,
      semi_retirement_age: values.semi_retirement_age ?? 55,
      retirement_age: values.retirement_age ?? 60,
    }
    window.dispatchEvent(new CustomEvent('chat-quick-reply', {
      detail: { text: JSON.stringify(profile) }
    }))
  }, [values, isHistory, submitted])

  const formatValue = (field: typeof fields[0], value: number) => {
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
          const value = values[field.name] ?? field.default ?? 0
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

      {submitted && (
        <div className="mt-4 text-center text-sm text-slate-400">Profile submitted</div>
      )}
    </div>
  )
}
