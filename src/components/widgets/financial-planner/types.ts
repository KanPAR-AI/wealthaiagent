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
