import { useState } from 'react'
import type { ProfileReviewPayload, EnhancedProfile, IncomeSource, ExpenseItem, ChildProfileV2 } from './types'
import { formatINR } from '@/lib/formatters'

interface ProfileReviewProps {
  data: ProfileReviewPayload
  isHistory?: boolean
}

export function ProfileReview({ data, isHistory }: ProfileReviewProps) {
  const [profile, setProfile] = useState<EnhancedProfile>(data.profile)
  const [confirmed, setConfirmed] = useState(false)

  const handleConfirm = () => {
    if (isHistory) return
    setConfirmed(true)
    window.dispatchEvent(new CustomEvent('chat-quick-reply', {
      detail: { text: JSON.stringify({ confirmed: true, profile }) },
    }))
  }

  const totalIncome = profile.income_sources.reduce((s, src) => s + src.monthly_amount, 0)
  const totalExpenses = profile.expenses.reduce((s, e) => s + e.monthly_amount, 0)

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-lg p-5 max-w-2xl">
      <h3 className="text-lg font-semibold text-white mb-1">Profile Review</h3>
      <p className="text-[11px] text-slate-500 mb-4">Verify I understood your details correctly</p>

      {/* Basic Info */}
      <SectionCard title="Basic Info">
        <InfoRow label="Age" value={`${profile.age} years`} />
        <InfoRow label="Retire at" value={`Age ${profile.retirement_age}`} />
        {profile.semi_retirement_age && (
          <InfoRow label="Semi-retirement" value={`Age ${profile.semi_retirement_age}`} />
        )}
      </SectionCard>

      {/* Income Sources */}
      <SectionCard title="Income Sources" summary={`Total: ${formatINR(totalIncome)}/mo`}>
        {profile.income_sources.map((src, i) => (
          <InfoRow
            key={i}
            label={src.label}
            value={`${formatINR(src.monthly_amount)}/mo`}
            sub={src.growth_rate > 0 ? `+${(src.growth_rate * 100).toFixed(0)}% growth` : undefined}
          />
        ))}
      </SectionCard>

      {/* Expenses */}
      <SectionCard title="Expenses" summary={`Total: ${formatINR(totalExpenses)}/mo`}>
        {profile.expenses.map((exp, i) => (
          <InfoRow
            key={i}
            label={exp.label}
            value={`${formatINR(exp.monthly_amount)}/mo`}
          />
        ))}
      </SectionCard>

      {/* Savings */}
      <SectionCard title="Savings & Corpus">
        <InfoRow label="Existing corpus" value={formatINR(profile.existing_corpus)} />
        <InfoRow label="Monthly savings" value={`${formatINR(totalIncome - totalExpenses)}/mo`} />
        {profile.corpus_allocation && (
          <div className="flex gap-2 mt-1">
            {profile.corpus_allocation.equity_pct > 0 && (
              <Badge label="Equity" value={`${(profile.corpus_allocation.equity_pct * 100).toFixed(0)}%`} color="text-emerald-400" />
            )}
            {profile.corpus_allocation.debt_pct > 0 && (
              <Badge label="Debt" value={`${(profile.corpus_allocation.debt_pct * 100).toFixed(0)}%`} color="text-blue-400" />
            )}
            {profile.corpus_allocation.real_estate_pct > 0 && (
              <Badge label="RE" value={`${(profile.corpus_allocation.real_estate_pct * 100).toFixed(0)}%`} color="text-amber-400" />
            )}
          </div>
        )}
      </SectionCard>

      {/* Lump Sum Inflows */}
      {profile.lump_sum_inflows.length > 0 && (
        <SectionCard title="Expected Inflows">
          {profile.lump_sum_inflows.map((ls, i) => (
            <InfoRow
              key={i}
              label={ls.label}
              value={formatINR(ls.amount)}
              sub={`in ${ls.arrives_in_months} months → ${ls.allocation}`}
            />
          ))}
        </SectionCard>
      )}

      {/* Children */}
      {profile.children.length > 0 && (
        <SectionCard title="Children">
          {profile.children.map((child, i) => (
            <InfoRow
              key={i}
              label={child.name || `Child ${i + 1}`}
              value={child.age_months < 12 ? `${child.age_months} months` : `${(child.age_months / 12).toFixed(1)} years`}
              sub={child.school_fee_annual > 0 ? `School: ${formatINR(child.school_fee_annual)}/yr` : undefined}
            />
          ))}
        </SectionCard>
      )}

      {/* Scheduled Expenses */}
      {profile.scheduled_expenses.length > 0 && (
        <SectionCard title="Scheduled Expenses">
          {profile.scheduled_expenses.map((se, i) => (
            <InfoRow
              key={i}
              label={se.label}
              value={`${formatINR(se.annual_amount)}/yr`}
              sub={`Starts in ${se.starts_in_years}yr, ${se.duration_years}yr duration`}
            />
          ))}
        </SectionCard>
      )}

      {/* Insurance */}
      {profile.wants_insurance && (
        <SectionCard title="Insurance">
          <InfoRow label="Needs term insurance" value="Yes" />
          {profile.existing_insurance_cover > 0 && (
            <InfoRow label="Existing cover" value={formatINR(profile.existing_insurance_cover)} />
          )}
        </SectionCard>
      )}

      {/* Missing fields warning */}
      {data.missing_fields.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 mb-4">
          <p className="text-[11px] text-amber-400 font-medium mb-1">Some fields used defaults:</p>
          <ul className="text-[10px] text-slate-500 space-y-0.5">
            {data.missing_fields.map((f, i) => (
              <li key={i}>- {f}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Confirm / Edit buttons */}
      {!isHistory && !confirmed && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium
              transition-all active:scale-[0.98]"
          >
            Looks Good — Generate Plan
          </button>
        </div>
      )}
      {confirmed && (
        <div className="text-center text-xs text-emerald-400 mt-3">
          Confirmed — generating your plan...
        </div>
      )}
    </div>
  )
}

function SectionCard({ title, summary, children }: { title: string; summary?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/5 p-3 mb-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{title}</span>
        {summary && <span className="text-[10px] text-slate-500">{summary}</span>}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function InfoRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-medium text-white">{value}</span>
      </div>
      {sub && <p className="text-[10px] text-slate-500 text-right">{sub}</p>}
    </div>
  )
}

function Badge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border border-white/10 ${color}`}>
      {label} {value}
    </span>
  )
}
