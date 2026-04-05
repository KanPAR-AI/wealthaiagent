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
  starts_in_years?: number  // phased SIP: when SIP starts (0 = now)
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
export type GoalFeasibilityStatus = FeasibilityStatus | 'phased'

export interface SipScheduleEntry {
  year: number
  monthly_sip: number
}

export interface FeasibilityResult {
  status: FeasibilityStatus
  total_sip_needed: number
  year0_sip?: number             // SIP for goals starting now only
  available_savings: number
  gap: number
  ratio: number
  per_goal_status: Record<string, GoalFeasibilityStatus>
  binding_constraints: string[]
  sip_schedule?: SipScheduleEntry[]
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
  type: 'slider' | 'input' | 'select' | 'stepper'
  min?: number
  max?: number
  default?: number
  step?: number
  unit?: string
  scale?: 'linear' | 'log'
  options?: string[]
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

export interface SipBreakdownItem {
  fund: string
  amount: number
  return: number
}

export interface TimelineRow {
  year: number
  age: number
  annual_income: number
  annual_expenses: number
  annual_savings: number
  net_worth: number
}

export interface ActionItem {
  category: 'corpus' | 'sip' | 'lump_sum' | 'insurance' | 'expense' | 'home_loan'
  instruction: string        // "Invest ₹3Cr in balanced funds at 8%"
  amount: number
  instrument?: string
  expected_return?: number
  sip_breakdown?: SipBreakdownItem[]
}

export interface Scenario {
  name: string               // "Conservative" | "Moderate" | "Aggressive"
  description: string
  retirement_age: number
  monthly_sip: number
  total_monthly_investment?: number
  corpus_needed?: number              // Target corpus (expenses / SWP rate)
  corpus_at_retirement: number        // Projected corpus if SIP is followed
  monthly_expense_at_retirement?: number  // Inflated monthly expenses at retirement
  feasibility: FeasibilityStatus
  risk_level?: 'low' | 'medium' | 'high'
  equity_pct?: number
  expected_return?: number            // Pre-retirement accumulation return
  swp_rate?: number                   // Post-retirement SWP rate (0.04/0.06/0.10)
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

export interface SipPhaseGoal {
  name: string
  goal_type: string
  monthly_sip: number
}

export interface SipPhase {
  phase: string           // "now" | "year_2" | "year_4"
  label: string           // "Start now" | "Add in year 2 (age 30)"
  start_year: number
  age: number
  goals: SipPhaseGoal[]
  phase_sip: number       // SIP added in this phase
  cumulative_sip: number  // Total SIP after this phase
}

export interface ReturnStrategy {
  name: string
  realistic_return: string
  allocation_pct: number
  min_capital: number
  liquidity: string
  risk: string
  how_it_works: string
  key_risks: string
  example: string
}

export interface ReturnStrategiesPayload {
  reality_check?: string | null
  target_return: number
  strategies: ReturnStrategy[]
}

export interface PrescriptivePlanPayload {
  profile: EnhancedProfile
  action_items: ActionItem[]
  scenarios: Scenario[]
  child_plans: ChildPlan[]
  insurance?: InsuranceRecommendation
  timeline?: TimelineRow[]
  sip_phases?: SipPhase[]
  home_purchase_plan?: HomePurchasePlan
  return_strategies?: ReturnStrategiesPayload
}

// ── Home Purchase Plan Types ──────────────────────────────────────────

export interface AmortizationMilestone {
  year: number
  outstanding: number
  principal_paid: number
  interest_paid: number
  equity_pct: number
}

export interface HomeLoanInsurance {
  cover: number
  premium_monthly: number
  type: string
  reasoning: string
}

export interface HomePurchasePhase {
  name: string
  duration_years?: number
  monthly_sip?: number
  target?: number
  at_year?: number
  outflow?: number
  starts_year?: number
  monthly_emi?: number
  total_interest?: number
  description?: string
}

export interface HomePurchasePlan {
  home_value: number
  home_value_at_purchase: number
  down_payment: number
  down_payment_pct: number
  stamp_duty: number
  total_upfront: number
  loan_principal: number
  loan_rate: number
  loan_tenure_years: number
  emi_monthly: number
  total_interest: number
  total_payment: number
  purchase_in_years: number
  surplus_before_emi: number
  surplus_after_emi: number
  surplus_drop_pct: number
  amortization: AmortizationMilestone[]
  home_loan_insurance: HomeLoanInsurance
  home_equity_at_loan_end: number
  phases: HomePurchasePhase[]
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
