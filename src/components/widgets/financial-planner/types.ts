/** Types for WealthWise Financial Life Planner widgets */

export enum GoalType {
  EMERGENCY_FUND = 'emergency_fund',
  HOME_PURCHASE = 'home_purchase',
  RETIREMENT = 'retirement',
  CHILDRENS_EDUCATION = 'childrens_education',
  CHILDRENS_WEDDING = 'childrens_wedding',
  CAR_PURCHASE = 'car_purchase',
  VACATION = 'vacation',
  WEALTH_BUILDING = 'wealth_building',
  DEBT_PAYOFF = 'debt_payoff',
  BUSINESS_STARTUP = 'business_startup',
  CUSTOM = 'custom',
}

export interface FinancialProfile {
  age: number
  monthly_income: number
  monthly_expenses: number
  existing_investments: number
  risk_tolerance?: string
  num_children?: number
  youngest_child_age?: number
  semi_retirement_age?: number  // age when switching to part-time/low-stress (50% income)
  retirement_age?: number       // age when income stops completely
}

export interface FinancialGoal {
  goal_type: string
  name: string
  icon?: string
  target_amount: number
  timeline_years: number
  priority: number
  monthly_sip?: number
  corpus_needed?: number
  description?: string
  default_target_lakh?: number
}

export interface RiverDataPoint {
  year: number
  age: number
  income: number
  expenses: number
  savings: number
  investments: number
  unallocated: number
  wealth: number
  goal_allocations: Record<string, number>
}

export interface MonteCarloResult {
  p10: number[]
  p25: number[]
  p50: number[]
  p75: number[]
  p90: number[]
}

export type FeasibilityStatus = 'green' | 'yellow' | 'red'

export interface FeasibilityResult {
  status: FeasibilityStatus
  total_sip_needed: number
  available_savings: number
  gap: number
  ratio: number
  per_goal_status: Record<string, FeasibilityStatus>
  binding_constraints: string[]
}

export interface Nudge {
  nudge_type: string
  description: string
  impact_monthly: number
  adjusted_value?: number | string
  goal_type?: string
}

export interface Assumptions {
  inflation_rate: number
  income_growth_rate: number
  expected_return: number
}

// Widget payload types
export interface OnboardingField {
  name: string
  label: string
  type: 'slider' | 'input' | 'select'
  min?: number
  max?: number
  default?: number
  step?: number
  unit?: string
  scale?: 'linear' | 'log'
}

export interface OnboardingPayload {
  step: string
  fields: OnboardingField[]
}

export interface GoalPickerPayload {
  step: string
  goals: FinancialGoal[]
  monthly_expenses: number
}

export interface GoalDetailPayload {
  step: string
  goals: FinancialGoal[]
  profile: FinancialProfile
}

export interface PlaygroundPayload {
  profile: FinancialProfile
  goals: FinancialGoal[]
  river_data: RiverDataPoint[]
  monte_carlo: MonteCarloResult
  feasibility: FeasibilityResult
  nudges: Nudge[]
  assumptions: Assumptions
}

export interface SummaryPayload {
  profile: FinancialProfile
  goals: FinancialGoal[]
  feasibility: FeasibilityResult
  total_monthly_sip: number
}

// ── Enhanced Profile Types (V2 — Prescriptive Plan) ──────────────────

export interface IncomeSource {
  label: string                    // "salary", "stock_dividends", "rental"
  monthly_amount: number
  growth_rate: number
}

export interface LumpSumInflow {
  label: string                    // "ESOP vesting", "bonus"
  amount: number
  arrives_in_months: number
  allocation: string               // "equity", "debt", "balanced"
}

export interface ExpenseItem {
  label: string                    // "household", "EMI", "insurance"
  monthly_amount: number
  inflation_rate: number
}

export interface ScheduledExpense {
  label: string                    // "elder_school_fees"
  annual_amount: number
  starts_in_years: number
  duration_years: number
  growth_rate: number
}

export interface ChildProfileV2 {
  name: string
  age_months: number               // 3 months, not "0 years"
  education_corpus_by_age: number
  education_withdrawal_rate: number
  school_fee_annual: number
  school_fee_starts_in_years: number
  school_fee_growth_rate: number
}

export interface CorpusAllocation {
  equity_pct: number
  debt_pct: number
  real_estate_pct: number
}

export interface EnhancedProfile {
  age: number
  income_sources: IncomeSource[]
  lump_sum_inflows: LumpSumInflow[]
  expenses: ExpenseItem[]
  scheduled_expenses: ScheduledExpense[]
  existing_corpus: number
  corpus_allocation: CorpusAllocation
  children: ChildProfileV2[]
  wants_insurance: boolean
  existing_insurance_cover: number
  semi_retirement_age: number | null
  retirement_age: number
}

export interface ActionItem {
  category: 'corpus' | 'sip' | 'lump_sum' | 'insurance' | 'expense'
  instruction: string        // "Invest ₹3Cr in balanced funds at 8%"
  amount: number
  instrument?: string
  expected_return?: number
}

export interface Scenario {
  name: string               // "Conservative" | "Moderate" | "Aggressive"
  description: string
  retirement_age: number
  monthly_sip: number
  corpus_at_retirement: number
  feasibility: FeasibilityStatus
  key_tradeoff: string
}

export interface ChildPlan {
  child_name: string
  corpus_needed: number
  monthly_sip: number
  school_fee_schedule: { year: number; amount: number }[]
}

export interface InsuranceRecommendation {
  cover: number
  premium_monthly: number
  reasoning: string
}

export interface PrescriptivePlanPayload {
  profile: EnhancedProfile
  action_items: ActionItem[]
  scenarios: Scenario[]
  child_plans: ChildPlan[]
  insurance?: InsuranceRecommendation
}

export interface ScenarioComparisonPayload {
  scenarios: Scenario[]
  profile: EnhancedProfile
}

export interface ProfileReviewPayload {
  profile: EnhancedProfile
  missing_fields: string[]
}

// ── V3 — Goal Graph + Proposal Graph ──────────────────────────────────

export interface WealthItem {
  id: string
  label: string
  category: 'savings' | 'equity' | 'real_estate' | 'debt' | 'esop' | 'insurance' | 'liability'
  current_value: number
  expected_return: number
  is_liquid: boolean
  arrives_in_months: number
  notes: string
}

export interface GoalNode {
  id: string
  label: string
  parent_id?: string | null
  affects: string[]
  tier: 'need' | 'protect' | 'want'
  negotiable: boolean
  target: number
  funded: number
  completion_pct: number
  monthly_sip_needed: number
  deadline_years: number
  starts_in_years: number
  alternatives: Array<{ label: string; target: number }>
  notes: string
}

export interface GoalGraphData {
  nodes: GoalNode[]
  summary?: {
    total_monthly_sip: number
    monthly_savings: number
    gap: number
    status: FeasibilityStatus
    unallocated_liquid: number
  }
}

export interface Proposal {
  id: string
  label: string
  description: string
  modifies_goal_id?: string | null
  creates_goal_id?: string | null
  removes_goal_id?: string | null
  field_changes: Record<string, unknown>
  impact_monthly_sip: number
  impact_gap: number
  impact_corpus: number
  feasibility_after: string
  status: 'proposed' | 'accepted' | 'rejected' | 'exploring'
  rejection_reason: string
}

export interface ProposalGraphData {
  proposals: Proposal[]
}

export interface PersonData {
  age: number
  retirement_age: number
  semi_retirement_age?: number | null
  children: ChildProfileV2[]
  risk_tolerance: string
  location: string
}

export interface WealthData {
  items: WealthItem[]
  income_sources: IncomeSource[]
  expenses: ExpenseItem[]
  scheduled_expenses: ScheduledExpense[]
}

export interface FinancialStateData {
  person: PersonData
  wealth: WealthData
  goals: GoalGraphData
  proposals: ProposalGraphData
}

export interface AdvisorPayload {
  financial_state: FinancialStateData
  goal_computation: GoalGraphData
  proposals: Proposal[]
}
