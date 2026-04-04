import { useState } from 'react'
import { formatINR } from '@/lib/formatters'

interface GoalSummary {
  goal_type: string
  name: string
  target_amount: number
  timeline_years: number
  starts_in_years?: number
  priority: number
}

interface HealthSnapshotData {
  profile: Record<string, unknown>
  monthly_income: number
  monthly_expenses: number
  monthly_surplus: number
  savings_rate: number
  savings_grade: 'excellent' | 'good' | 'fair' | 'needs_attention'
  existing_investments: number
  risk_profile: string
  recommended_allocation: {
    equity_pct: number
    debt_pct: number
  }
  goals_by_timeline: {
    short_term: GoalSummary[]
    medium_term: GoalSummary[]
    long_term: GoalSummary[]
  }
  retirement_age: number
  owns_home: boolean
  age: number
}

interface HealthSnapshotProps {
  data: HealthSnapshotData
  isHistory?: boolean
}

const gradeConfig = {
  excellent: { label: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500/20', bar: 'bg-emerald-500' },
  good: { label: 'Good', color: 'text-blue-400', bg: 'bg-blue-500/20', bar: 'bg-blue-500' },
  fair: { label: 'Fair', color: 'text-yellow-400', bg: 'bg-yellow-500/20', bar: 'bg-yellow-500' },
  needs_attention: { label: 'Needs Attention', color: 'text-red-400', bg: 'bg-red-500/20', bar: 'bg-red-500' },
}

const riskOptions = ['conservative', 'moderate', 'aggressive'] as const
const riskLabels: Record<string, string> = {
  aggressive: 'Aggressive — equity-heavy, high growth',
  moderate: 'Moderate — balanced equity + debt',
  conservative: 'Conservative — capital preservation',
}
const riskAllocation: Record<string, { equity: number; debt: number }> = {
  conservative: { equity: 30, debt: 70 },
  moderate: { equity: 60, debt: 40 },
  aggressive: { equity: 85, debt: 15 },
}

const timelineIcons: Record<string, string> = {
  short_term: '🔵',
  medium_term: '🟡',
  long_term: '🟢',
}

const timelineLabels: Record<string, string> = {
  short_term: 'Now — 2 years',
  medium_term: '2 — 10 years',
  long_term: '10+ years',
}

export function HealthSnapshot({ data, isHistory }: HealthSnapshotProps) {
  const grade = gradeConfig[data.savings_grade] || gradeConfig.fair
  const savingsPct = Math.round(data.savings_rate * 100)
  const allGoals = [
    ...data.goals_by_timeline.short_term,
    ...data.goals_by_timeline.medium_term,
    ...data.goals_by_timeline.long_term,
  ]

  // Editable state
  const [retireAge, setRetireAge] = useState(data.retirement_age)
  const [risk, setRisk] = useState(data.risk_profile)
  const [children, setChildren] = useState<{ name: string; age_months: number }[]>([])
  const [hasParentCare, setHasParentCare] = useState(data.age >= 25)
  const allocation = riskAllocation[risk] || riskAllocation.moderate

  const handleBuildPlan = () => {
    if (isHistory) return
    window.dispatchEvent(new CustomEvent('chat-quick-reply', {
      detail: {
        text: JSON.stringify({
          action: 'build_plan',
          confirmed: true,
          retirement_age: retireAge,
          risk_tolerance: risk,
          children: children.length > 0 ? children : undefined,
          has_parent_care: hasParentCare,
        }),
      },
    }))
  }

  const addChild = () => {
    if (children.length >= 4) return
    setChildren(prev => [...prev, { name: `Child ${prev.length + 1}`, age_months: 60 }])
  }
  const removeChild = (idx: number) => {
    setChildren(prev => prev.filter((_, i) => i !== idx))
  }
  const updateChildAge = (idx: number, ageYears: number) => {
    setChildren(prev => prev.map((c, i) => i === idx ? { ...c, age_months: ageYears * 12 } : c))
  }

  const yearsToRetire = Math.max(1, retireAge - data.age)

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-lg p-5 max-w-2xl">
      <h3 className="text-lg font-semibold text-white mb-1">Your Financial Snapshot</h3>
      <p className="text-[11px] text-slate-500 mb-5">Here&apos;s where you stand — adjust anything, then build your plan</p>

      {/* ── Key Metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Monthly Surplus" value={formatINR(data.monthly_surplus)} sub={`${savingsPct}% of income`} />
        <MetricCard label="Savings Rate" value={`${savingsPct}%`} sub={grade.label} valueColor={grade.color} />
        <MetricCard label="Invested" value={formatINR(data.existing_investments)} sub="Current corpus" />
        {/* Retire at — static display, slider below */}
        <MetricCard label="Retire at" value={`Age ${retireAge}`} sub={`${yearsToRetire} years away`} />
      </div>

      {/* ── Retirement Age Slider ── */}
      {!isHistory && (
        <div className="mb-5 rounded-lg border border-white/5 bg-white/[0.03] p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-slate-400">When do you want to retire?</span>
            <span className="text-xs font-semibold text-white">Age {retireAge}</span>
          </div>
          <input
            type="range"
            min={data.age + 2}
            max={75}
            step={1}
            value={retireAge}
            onChange={e => setRetireAge(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg
              touch-none"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-slate-600">Age {data.age + 2}</span>
            <span className="text-[9px] text-slate-500">
              {yearsToRetire <= 5 ? 'Early retirement — aggressive saving needed' :
               yearsToRetire <= 15 ? 'Mid-career exit — very achievable' :
               yearsToRetire <= 25 ? 'Standard timeline — compounding works for you' :
               'Long runway — maximum flexibility'}
            </span>
            <span className="text-[9px] text-slate-600">75</span>
          </div>
        </div>
      )}

      {/* ── Savings Rate Bar ── */}
      <div className="mb-5">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[11px] text-slate-400">Savings rate vs 50/30/20 rule</span>
          <span className={`text-[11px] font-medium ${grade.color}`}>{grade.label}</span>
        </div>
        <div className="relative h-2.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`absolute left-0 top-0 h-full rounded-full transition-all ${grade.bar}`}
            style={{ width: `${Math.min(100, savingsPct * 2)}%` }}
          />
          {/* 20% marker */}
          <div className="absolute top-0 h-full w-px bg-white/30" style={{ left: '40%' }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-slate-600">0%</span>
          <span className="text-[9px] text-slate-500" style={{ marginLeft: '30%' }}>20% ideal</span>
          <span className="text-[9px] text-slate-600">50%</span>
        </div>
      </div>

      {/* ── Risk Profile — tappable to change ── */}
      <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3 mb-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-slate-400">Risk Profile</span>
          {!isHistory && (
            <span className="text-[9px] text-slate-600">tap to change</span>
          )}
        </div>
        {/* Risk toggle buttons */}
        <div className="flex gap-1.5 mb-3">
          {riskOptions.map(opt => (
            <button
              key={opt}
              onClick={() => !isHistory && setRisk(opt)}
              disabled={isHistory}
              className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-all capitalize
                ${risk === opt
                  ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40'
                  : 'bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10 hover:text-slate-300'
                }
                disabled:cursor-not-allowed`}
            >
              {opt}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mb-2">{riskLabels[risk] || ''}</p>
        <div className="flex gap-1 h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500 rounded-l-full transition-all"
            style={{ width: `${allocation.equity}%` }}
          />
          <div
            className="bg-blue-500 rounded-r-full transition-all"
            style={{ width: `${allocation.debt}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-emerald-400/70">Equity {allocation.equity}%</span>
          <span className="text-[10px] text-blue-400/70">Debt {allocation.debt}%</span>
        </div>
      </div>

      {/* ── Goals by Timeline ── */}
      <div className="mb-5">
        <h4 className="text-sm font-medium text-white mb-3">Goals I&apos;d Recommend</h4>
        <p className="text-[10px] text-slate-500 mb-3">Based on your age ({data.age}) and life stage — prioritized by urgency</p>

        {(['short_term', 'medium_term', 'long_term'] as const).map(bucket => {
          const goals = data.goals_by_timeline[bucket]
          if (goals.length === 0) return null
          return (
            <div key={bucket} className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-xs">{timelineIcons[bucket]}</span>
                <span className="text-[11px] font-medium text-slate-300">{timelineLabels[bucket]}</span>
              </div>
              <div className="space-y-1 pl-5">
                {goals.map((goal, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                    <div>
                      <span className="text-xs text-white">{goal.name}</span>
                      {goal.starts_in_years != null && goal.starts_in_years > 0 && (
                        <span className="text-[9px] text-slate-500 ml-1.5">starts in yr {goal.starts_in_years}</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400">
                        {goal.target_amount > 0 ? formatINR(goal.target_amount) : 'Auto'}
                      </span>
                      <span className="text-[9px] text-slate-600 ml-1">{goal.timeline_years}yr</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Family & Responsibilities (expandable) ── */}
      {!isHistory && (
        <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3 mb-5">
          <h4 className="text-xs font-medium text-slate-300 mb-3">Family & Responsibilities</h4>

          {/* Children */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] text-slate-400">Children</span>
              <button
                onClick={addChild}
                disabled={children.length >= 4}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 disabled:text-slate-600 disabled:cursor-not-allowed"
              >
                + Add child
              </button>
            </div>
            {children.length === 0 && (
              <p className="text-[10px] text-slate-600 italic">No children — add if you have or are planning kids</p>
            )}
            {children.map((child, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-slate-500 w-14">{child.name}</span>
                <input
                  type="range"
                  min={0} max={22} step={1}
                  value={Math.round(child.age_months / 12)}
                  onChange={e => updateChildAge(i, Number(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full
                    touch-none"
                />
                <span className="text-[10px] text-white w-12 text-right">
                  {child.age_months < 12 ? `${child.age_months} mo` : `${Math.round(child.age_months / 12)} yrs`}
                </span>
                <button
                  onClick={() => removeChild(i)}
                  className="text-[10px] text-red-400/60 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Parent care toggle */}
          <div className="flex justify-between items-center pt-2 border-t border-white/5">
            <div>
              <span className="text-[11px] text-slate-400">Parent medical & care fund</span>
              <p className="text-[9px] text-slate-600">Medical costs at 8% inflation</p>
            </div>
            <button
              onClick={() => setHasParentCare(!hasParentCare)}
              className={`w-10 h-5 rounded-full transition-all relative ${hasParentCare ? 'bg-emerald-600' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${hasParentCare ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      )}

      {/* ── Insights ── */}
      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 mb-5 space-y-1.5">
        <InsightRow
          text={savingsPct >= 20
            ? `You save ${savingsPct}% of income — well above the 20% minimum`
            : `You save ${savingsPct}% of income — try to reach the 20% benchmark`}
          positive={savingsPct >= 20}
        />
        <InsightRow
          text={`Monthly investable surplus: ${formatINR(data.monthly_surplus)}`}
          positive={data.monthly_surplus > 0}
        />
        <InsightRow
          text={`${allGoals.length} goals recommended for your life stage`}
          positive
        />
        {data.age < 35 && (
          <InsightRow text="Long investment runway — compounding is your superpower" positive />
        )}
        {!data.owns_home && data.age < 40 && (
          <InsightRow text="Home purchase goal added — building equity early" positive />
        )}
      </div>

      {/* ── Build Plan Button ── */}
      {!isHistory && (
        <button
          onClick={handleBuildPlan}
          className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500
            text-sm font-semibold text-white transition-all active:scale-[0.98]
            shadow-lg shadow-emerald-900/30"
        >
          Build My Plan
        </button>
      )}
    </div>
  )
}

function MetricCard({ label, value, sub, valueColor }: {
  label: string; value: string; sub?: string; valueColor?: string
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
      <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
      <div className={`text-sm font-semibold ${valueColor || 'text-white'}`}>{value}</div>
      {sub && <div className="text-[9px] text-slate-600 mt-0.5">{sub}</div>}
    </div>
  )
}

function InsightRow({ text, positive }: { text: string; positive: boolean }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className={`text-[10px] mt-0.5 ${positive ? 'text-emerald-400' : 'text-yellow-400'}`}>
        {positive ? '✓' : '!'}
      </span>
      <span className="text-[11px] text-slate-400">{text}</span>
    </div>
  )
}
