/**
 * Client-side financial computation engine for WealthWise.
 *
 * Mirrors server-side tools.py for real-time slider interaction (no server round-trip).
 * Used for: slider drag → instant recompute → SVG update (requestAnimationFrame).
 * Server-side Plan-and-Execute used for: freeform "what if" text queries, plan generation.
 *
 * Indian defaults: inflation 6%, income growth 8%, equity 12%, FD 7%.
 * All amounts in INR.
 */

import type {
  FinancialProfile,
  FinancialGoal,
  RiverDataPoint,
  MonteCarloResult,
  FeasibilityResult,
  FeasibilityStatus,
  Nudge,
  EnhancedProfile,
  Scenario,
  ChildPlan,
  ActionItem,
  CorpusAllocation,
} from '@/components/widgets/financial-planner/types'

// ── Indian financial defaults ──────────────────────────────────────────

export const DEFAULT_INFLATION_RATE = 0.06
export const DEFAULT_INCOME_GROWTH_RATE = 0.0
export const DEFAULT_EQUITY_RETURN = 0.12
export const DEFAULT_DEBT_RETURN = 0.07
export const DEFAULT_BALANCED_RETURN = 0.10

// ── Core financial formulas ────────────────────────────────────────────

/** FV = PV × (1 + r)^n */
export function futureValue(pv: number, rate: number, years: number): number {
  return pv * Math.pow(1 + rate, years)
}

/** Monthly SIP needed to reach target FV: PMT = FV × r / ((1+r)^n - 1) */
export function sipNeeded(targetFV: number, annualRate: number, years: number): number {
  if (years <= 0 || annualRate <= 0) {
    return targetFV / Math.max(years * 12, 1)
  }
  const monthlyRate = annualRate / 12
  const months = years * 12
  const denominator = Math.pow(1 + monthlyRate, months) - 1
  if (denominator <= 0) return targetFV / months
  return targetFV * monthlyRate / denominator
}

/** Future value of a monthly SIP: FV = PMT × ((1+r)^n - 1) / r */
export function sipFutureValue(monthlySIP: number, annualRate: number, years: number): number {
  if (years <= 0) return 0
  const monthlyRate = annualRate / 12
  const months = years * 12
  if (monthlyRate <= 0) return monthlySIP * months
  return monthlySIP * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate
}

/** Corpus needed at retirement to sustain expenses for withdrawal years */
export function retirementCorpus(
  monthlyExpense: number,
  inflationRate = DEFAULT_INFLATION_RATE,
  yearsToRetirement = 30,
  withdrawalYears = 25,
  withdrawalRate = DEFAULT_DEBT_RETURN,
): number {
  const annualExpenseAtRetirement = monthlyExpense * 12 * Math.pow(1 + inflationRate, yearsToRetirement)
  if (withdrawalRate <= 0) return annualExpenseAtRetirement * withdrawalYears
  const pvFactor = (1 - Math.pow(1 + withdrawalRate, -withdrawalYears)) / withdrawalRate
  return annualExpenseAtRetirement * pvFactor
}

// ── Goal corpus calculation ────────────────────────────────────────────

export interface GoalCorpusResult {
  corpus_needed: number
  monthly_sip: number
  target_fv: number
  real_return: number
}

export function calculateGoalCorpus(
  goalType: string,
  targetAmount: number,
  timelineYears: number,
  inflationRate = DEFAULT_INFLATION_RATE,
  expectedReturn = DEFAULT_BALANCED_RETURN,
  monthlyExpense = 0,
): GoalCorpusResult {
  let corpus: number

  if (goalType === 'retirement' && monthlyExpense > 0) {
    corpus = retirementCorpus(monthlyExpense, inflationRate, timelineYears)
  } else if (goalType === 'emergency_fund' && monthlyExpense > 0) {
    corpus = monthlyExpense * 6
  } else {
    corpus = futureValue(targetAmount, inflationRate, timelineYears)
  }

  const monthly = sipNeeded(corpus, expectedReturn, timelineYears)

  return {
    corpus_needed: Math.round(corpus * 100) / 100,
    monthly_sip: Math.round(monthly * 100) / 100,
    target_fv: Math.round(corpus * 100) / 100,
    real_return: Math.round((expectedReturn - inflationRate) * 10000) / 10000,
  }
}

export function calculateAllGoals(
  goals: FinancialGoal[],
  monthlyExpense = 0,
  inflationRate = DEFAULT_INFLATION_RATE,
  expectedReturn = DEFAULT_BALANCED_RETURN,
): { goals: (FinancialGoal & GoalCorpusResult)[]; total_monthly_sip: number } {
  let totalSIP = 0
  const results = goals.map(goal => {
    const calc = calculateGoalCorpus(
      goal.goal_type,
      goal.target_amount,
      goal.timeline_years,
      inflationRate,
      expectedReturn,
      monthlyExpense,
    )
    totalSIP += calc.monthly_sip
    return { ...goal, ...calc }
  })

  return { goals: results, total_monthly_sip: Math.round(totalSIP * 100) / 100 }
}

// ── River projection ──────────────────────────────────────────────────

/**
 * Get effective annual income for a given age based on life phases.
 *
 * Three phases:
 *   1. Full-time: full income (with optional growth)
 *   2. Semi-retirement: 50% income (part-time / low-stress job)
 *   3. Retired: 0 income
 */
function phaseAdjustedIncome(
  baseAnnualIncome: number,
  currentAge: number,
  semiRetirementAge: number,
  retirementAge: number,
): number {
  if (currentAge >= retirementAge) return 0
  if (currentAge >= semiRetirementAge) return baseAnnualIncome * 0.5
  return baseAnnualIncome
}

/**
 * Monthly child expense based on child's current age (in today's rupees).
 * Increases with school, peaks during higher education, drops to 0 when independent.
 */
function childMonthlyExpense(childAge: number): number {
  if (childAge < 0 || childAge >= 23) return 0
  if (childAge < 4) return 8000      // daycare, basic
  if (childAge < 14) return 15000    // school fees, activities
  if (childAge < 18) return 25000    // coaching, higher secondary
  return 35000                        // college, hostel, living (18-22)
}

/**
 * Compute total annual child-related expenses for a given projection year.
 * Children are assumed 2 years apart starting from youngest_child_age.
 */
function annualChildExpenses(
  numChildren: number,
  youngestChildAge: number,
  projectionYear: number,
  inflationRate: number,
): number {
  if (numChildren <= 0) return 0
  let total = 0
  for (let i = 0; i < numChildren; i++) {
    const childAgeNow = youngestChildAge + i * 2 // each older child is 2 years apart
    const childAgeAtYear = childAgeNow + projectionYear
    const baseExpense = childMonthlyExpense(childAgeAtYear) * 12
    // Inflate to that year's value
    total += baseExpense * Math.pow(1 + inflationRate, projectionYear)
  }
  return total
}

export function computeRiverData(
  profile: FinancialProfile,
  goals: FinancialGoal[],
  years = 30,
  inflationRate = DEFAULT_INFLATION_RATE,
  incomeGrowthRate = DEFAULT_INCOME_GROWTH_RATE,
  expectedReturn = DEFAULT_BALANCED_RETURN,
): RiverDataPoint[] {
  const { age = 30, monthly_income = 0, monthly_expenses = 0, existing_investments = 0 } = profile
  const numChildren = profile.num_children ?? 0
  const youngestChildAge = profile.youngest_child_age ?? 0

  const goalCalcs = calculateAllGoals(goals, monthly_expenses, inflationRate, expectedReturn)
  const goalSips: Record<string, number> = {}
  for (const g of goalCalcs.goals) {
    goalSips[g.goal_type] = g.monthly_sip
  }

  const semiRetAge = profile.semi_retirement_age ?? 55
  const retireAge = profile.retirement_age ?? 60

  const projection: RiverDataPoint[] = []
  let wealth = existing_investments
  const baseAnnualIncome = monthly_income * 12

  for (let y = 0; y <= years; y++) {
    // Apply income growth to base (modest, if any)
    const grownIncome = baseAnnualIncome * Math.pow(1 + incomeGrowthRate, y)
    // Phase-adjust: full → semi-retired (50%) → retired (0%)
    const currentIncome = phaseAdjustedIncome(grownIncome, age + y, semiRetAge, retireAge)
    const baseExpenses = monthly_expenses * 12 * Math.pow(1 + inflationRate, y)
    const childExp = annualChildExpenses(numChildren, youngestChildAge, y, inflationRate)
    const currentExpenses = baseExpenses + childExp
    const annualSavings = Math.max(currentIncome - currentExpenses, 0)

    const allocations: Record<string, number> = {}
    for (const goal of goals) {
      const gt = goal.goal_type
      const tl = goal.timeline_years
      allocations[gt] = y < tl ? (goalSips[gt] || 0) * 12 : 0
    }

    const totalSipAnnual = Object.values(allocations).reduce((a, b) => a + b, 0)
    const unallocated = Math.max(annualSavings - totalSipAnnual, 0)

    if (y === 0) {
      wealth = existing_investments
    } else {
      wealth = wealth * (1 + expectedReturn) + annualSavings
    }

    projection.push({
      year: y,
      age: age + y,
      income: Math.round(currentIncome * 100) / 100,
      expenses: Math.round(currentExpenses * 100) / 100,
      savings: Math.round(annualSavings * 100) / 100,
      investments: Math.round(totalSipAnnual * 100) / 100,
      unallocated: Math.round(unallocated * 100) / 100,
      wealth: Math.round(wealth * 100) / 100,
      goal_allocations: Object.fromEntries(
        Object.entries(allocations).map(([k, v]) => [k, Math.round(v * 100) / 100])
      ),
    })
  }

  return projection
}

// ── Monte Carlo simulation ─────────────────────────────────────────────

function boxMuller(): number {
  let u1 = Math.random()
  const u2 = Math.random()
  while (u1 === 0) u1 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

export function runMonteCarloSimulation(
  riverData: RiverDataPoint[],
  simulations = 1000,
  returnVolatility = 0.15,
  expectedReturn = DEFAULT_BALANCED_RETURN,
): MonteCarloResult {
  const years = riverData.length
  if (years === 0) return { p10: [], p25: [], p50: [], p75: [], p90: [] }

  const allPaths: number[][] = []

  for (let s = 0; s < simulations; s++) {
    const path: number[] = []
    let wealth = riverData[0]?.wealth ?? 0

    for (let y = 0; y < years; y++) {
      if (y === 0) {
        path.push(wealth)
        continue
      }
      const savings = riverData[y]?.savings ?? 0
      const simulatedReturn = expectedReturn + returnVolatility * boxMuller()
      wealth = wealth * (1 + simulatedReturn) + savings
      wealth = Math.max(wealth, 0)
      path.push(Math.round(wealth * 100) / 100)
    }
    allPaths.push(path)
  }

  const result: MonteCarloResult = { p10: [], p25: [], p50: [], p75: [], p90: [] }

  for (let y = 0; y < years; y++) {
    const yearValues = allPaths.map(p => p[y]).sort((a, b) => a - b)
    const n = yearValues.length
    result.p10.push(yearValues[Math.floor(n * 0.10)])
    result.p25.push(yearValues[Math.floor(n * 0.25)])
    result.p50.push(yearValues[Math.floor(n * 0.50)])
    result.p75.push(yearValues[Math.floor(n * 0.75)])
    result.p90.push(yearValues[Math.min(Math.floor(n * 0.90), n - 1)])
  }

  return result
}

// ── Feasibility check ──────────────────────────────────────────────────

export function checkFeasibility(
  profile: FinancialProfile,
  goals: FinancialGoal[],
  inflationRate = DEFAULT_INFLATION_RATE,
  expectedReturn = DEFAULT_BALANCED_RETURN,
): FeasibilityResult {
  const { monthly_income = 0, monthly_expenses = 0, existing_investments = 0 } = profile
  const availableSavings = monthly_income - monthly_expenses

  const goalCalcs = calculateAllGoals(goals, monthly_expenses, inflationRate, expectedReturn)
  let totalSIP = goalCalcs.total_monthly_sip

  // Existing investments grow and offset SIP requirements
  // Distribute existing corpus proportionally across goals based on SIP weight
  if (existing_investments > 0 && totalSIP > 0) {
    let sipReduction = 0
    for (const g of goalCalcs.goals) {
      const share = g.monthly_sip / totalSIP
      const allocatedCorpus = existing_investments * share
      // FV of allocated corpus at goal timeline
      const corpusFV = futureValue(allocatedCorpus, expectedReturn, g.timeline_years)
      // How much SIP is offset by this existing corpus growing?
      const offsetSIP = Math.min(g.monthly_sip, sipNeeded(corpusFV, expectedReturn, g.timeline_years))
      sipReduction += offsetSIP
    }
    totalSIP = Math.max(totalSIP - sipReduction, 0)
  }

  const gap = Math.max(totalSIP - availableSavings, 0)
  const ratio = availableSavings > 0 ? totalSIP / availableSavings : Infinity

  // Per-goal status
  const perGoalStatus: Record<string, FeasibilityStatus> = {}
  let remaining = availableSavings
  const sorted = [...goalCalcs.goals].sort((a, b) => (a.priority || 2) - (b.priority || 2))
  for (const g of sorted) {
    if (remaining >= g.monthly_sip) {
      perGoalStatus[g.goal_type] = 'green'
      remaining -= g.monthly_sip
    } else if (remaining > 0) {
      perGoalStatus[g.goal_type] = 'yellow'
      remaining = 0
    } else {
      perGoalStatus[g.goal_type] = 'red'
    }
  }

  let status: FeasibilityStatus
  if (ratio <= 0.8) status = 'green'
  else if (ratio <= 1.0) status = 'yellow'
  else status = 'red'

  const bindingConstraints: string[] = []
  if (gap > 0) bindingConstraints.push(`Monthly shortfall of ₹${gap.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`)
  if (availableSavings <= 0) bindingConstraints.push('No savings margin (expenses >= income)')
  if (ratio > 1.5) bindingConstraints.push('Goals require >150% of available savings')

  return {
    status,
    total_sip_needed: Math.round(totalSIP * 100) / 100,
    available_savings: Math.round(availableSavings * 100) / 100,
    gap: Math.round(gap * 100) / 100,
    ratio: Math.round(ratio * 10000) / 10000,
    per_goal_status: perGoalStatus,
    binding_constraints: bindingConstraints,
  }
}

// ── Nudge generation ──────────────────────────────────────────────────

export function generateNudges(
  profile: FinancialProfile,
  goals: FinancialGoal[],
  gap: number,
  inflationRate = DEFAULT_INFLATION_RATE,
  expectedReturn = DEFAULT_BALANCED_RETURN,
): Nudge[] {
  if (gap <= 0) return []

  const nudges: Nudge[] = []
  const { monthly_income = 0, monthly_expenses = 0 } = profile

  // 1. Extend timelines — use calculateGoalCorpus for consistency
  for (const goal of goals) {
    const tl = goal.timeline_years
    if (tl < 40) {
      const extraYears = Math.min(3, 40 - tl)
      const currentCalc = calculateGoalCorpus(goal.goal_type, goal.target_amount, tl, inflationRate, expectedReturn, monthly_expenses)
      const newCalc = calculateGoalCorpus(goal.goal_type, goal.target_amount, tl + extraYears, inflationRate, expectedReturn, monthly_expenses)
      const impact = currentCalc.monthly_sip - newCalc.monthly_sip
      if (impact > 0) {
        nudges.push({
          nudge_type: 'extend_timeline',
          goal_type: goal.goal_type,
          description: `Extend ${goal.goal_type.replace(/_/g, ' ')} timeline by ${extraYears} years`,
          impact_monthly: Math.round(impact * 100) / 100,
          adjusted_value: tl + extraYears,
        })
      }
    }
  }

  // 2. Reduce expenses by 10%
  if (monthly_expenses > 0) {
    nudges.push({
      nudge_type: 'reduce_expenses',
      description: 'Reduce monthly expenses by 10%',
      impact_monthly: Math.round(monthly_expenses * 0.10 * 100) / 100,
      adjusted_value: Math.round(monthly_expenses * 0.90 * 100) / 100,
    })
  }

  // 3. Increase income by 15%
  if (monthly_income > 0) {
    nudges.push({
      nudge_type: 'increase_income',
      description: 'Increase monthly income by 15%',
      impact_monthly: Math.round(monthly_income * 0.15 * 100) / 100,
      adjusted_value: Math.round(monthly_income * 1.15 * 100) / 100,
    })
  }

  // 4. Reduce targets for low-priority goals — use calculateGoalCorpus for consistency
  const lowPriority = goals.filter(g => (g.priority || 2) >= 2)
  for (const goal of lowPriority) {
    const tl = goal.timeline_years
    const currentCalc = calculateGoalCorpus(goal.goal_type, goal.target_amount, tl, inflationRate, expectedReturn, monthly_expenses)
    const newCalc = calculateGoalCorpus(goal.goal_type, goal.target_amount * 0.80, tl, inflationRate, expectedReturn, monthly_expenses)
    const impact = currentCalc.monthly_sip - newCalc.monthly_sip
    if (impact > 0) {
      nudges.push({
        nudge_type: 'reduce_target',
        goal_type: goal.goal_type,
        description: `Reduce ${goal.goal_type.replace(/_/g, ' ')} target by 20%`,
        impact_monthly: Math.round(impact * 100) / 100,
        adjusted_value: Math.round(goal.target_amount * 0.80 * 100) / 100,
      })
    }
  }

  // 5. Higher-risk allocation — show impact of switching to aggressive equity
  if (expectedReturn < 0.14) {
    const aggressiveReturn = 0.14
    const currentTotal = calculateAllGoals(goals, monthly_expenses, inflationRate, expectedReturn).total_monthly_sip
    const aggressiveTotal = calculateAllGoals(goals, monthly_expenses, inflationRate, aggressiveReturn).total_monthly_sip
    const impact = currentTotal - aggressiveTotal
    if (impact > 0) {
      nudges.push({
        nudge_type: 'higher_risk',
        description: 'Switch to aggressive equity portfolio (14% return)',
        impact_monthly: Math.round(impact * 100) / 100,
      })
    }
  }

  // 6. Entrepreneurship / side income — model 2x income scenario
  if (monthly_income > 0) {
    nudges.push({
      nudge_type: 'entrepreneurship',
      description: 'Start a side business or freelance (double income)',
      impact_monthly: Math.round(monthly_income * 100) / 100,
      adjusted_value: Math.round(monthly_income * 2 * 100) / 100,
    })
  }

  // 7. Phased retirement — suggest semi-retirement if not already enabled
  const retireAge = profile.retirement_age ?? 60
  const semiRetAge = profile.semi_retirement_age ?? retireAge
  if (semiRetAge >= retireAge && retireAge < 65) {
    // Not using semi-retirement — suggest adding a part-time phase
    const phasedRetireAge = retireAge + 5
    const totalWithPhase = calculateAllGoals(goals, monthly_expenses, inflationRate, expectedReturn).total_monthly_sip
    // Extending effective earning years by 5 via part-time reduces pressure
    nudges.push({
      nudge_type: 'phased_retirement',
      description: `Add part-time phase: half income from ${retireAge} to ${phasedRetireAge}`,
      impact_monthly: Math.round(monthly_income * 0.5 * (5 / ((retireAge - (profile.age ?? 30)) * 12)) * 12 * 100) / 100 || Math.round(monthly_income * 0.25 * 100) / 100,
    })
  }

  nudges.sort((a, b) => b.impact_monthly - a.impact_monthly)
  return nudges
}

// ══════════════════════════════════════════════════════════════════════
// V2 — Enhanced Prescriptive Plan Computations
// ══════════════════════════════════════════════════════════════════════

const ASSET_RETURNS: Record<string, number> = {
  equity: 0.12,
  debt: 0.07,
  real_estate: 0.07,
  balanced: 0.10,
  aggressive_equity: 0.14,
}

/** Weighted average return from corpus allocation */
export function computeCorpusReturn(allocation: CorpusAllocation): number {
  const eq = allocation.equity_pct || 0
  const debt = allocation.debt_pct || 0
  const re = allocation.real_estate_pct || 0
  const bal = Math.max(0, 1.0 - eq - debt - re)
  return (
    eq * ASSET_RETURNS.equity +
    debt * ASSET_RETURNS.debt +
    re * ASSET_RETURNS.real_estate +
    bal * ASSET_RETURNS.balanced
  )
}

/** Compute per-child education corpus and school fee schedule */
export function computeChildEducationPlan(
  child: { name?: string; age_months: number; education_corpus_by_age?: number; education_withdrawal_rate?: number; school_fee_annual?: number; school_fee_starts_in_years?: number; school_fee_growth_rate?: number },
  inflationRate = DEFAULT_INFLATION_RATE,
  expectedReturn = DEFAULT_BALANCED_RETURN,
): ChildPlan {
  const name = child.name || 'Child'
  const ageYears = child.age_months / 12
  const targetAge = child.education_corpus_by_age ?? 18
  const yearsToTarget = Math.max(1, Math.floor(targetAge - ageYears))

  const baseEducationCost = 2500000 // ₹25L today
  const inflatedCost = futureValue(baseEducationCost, inflationRate, yearsToTarget)
  const corpusNeeded = inflatedCost
  const monthlySipNeeded = sipNeeded(corpusNeeded, expectedReturn, yearsToTarget)

  const feeAnnual = child.school_fee_annual ?? 0
  const feeStarts = child.school_fee_starts_in_years ?? 0
  const feeGrowth = child.school_fee_growth_rate ?? 0.06
  const feeDuration = feeAnnual > 0 ? Math.max(1, targetAge - Math.floor(ageYears) - feeStarts) : 0

  const schedule: { year: number; amount: number }[] = []
  for (let yr = 0; yr < feeDuration; yr++) {
    const actualYear = feeStarts + yr
    const amount = feeAnnual * Math.pow(1 + feeGrowth, yr)
    schedule.push({ year: actualYear, amount: Math.round(amount * 100) / 100 })
  }

  return {
    child_name: name,
    corpus_needed: Math.round(corpusNeeded * 100) / 100,
    monthly_sip: Math.round(monthlySipNeeded * 100) / 100,
    school_fee_schedule: schedule,
  }
}

/** Generate 3 auto-scenarios with different risk/return profiles */
export function generateScenarios(
  profile: EnhancedProfile | FinancialProfile,
  goals: FinancialGoal[],
  inflationRate = DEFAULT_INFLATION_RATE,
): Scenario[] {
  const age = profile.age
  const retireAge = profile.retirement_age ?? 60

  // Extract income/expenses — handle both V1 and V2 profiles
  let monthlyIncome: number
  let monthlyExpenses: number
  let existing: number

  if ('income_sources' in profile && profile.income_sources) {
    monthlyIncome = (profile as EnhancedProfile).income_sources.reduce((s, src) => s + src.monthly_amount, 0)
    monthlyExpenses = (profile as EnhancedProfile).expenses.reduce((s, e) => s + e.monthly_amount, 0)
    existing = (profile as EnhancedProfile).existing_corpus || 0
  } else {
    monthlyIncome = (profile as FinancialProfile).monthly_income || 0
    monthlyExpenses = (profile as FinancialProfile).monthly_expenses || 0
    existing = (profile as FinancialProfile).existing_investments || 0
  }

  const configs = [
    { name: 'Conservative' as const, ret: 0.08, offset: 2, desc: 'Lower risk, mostly debt + balanced funds. Retire 2 years later for safety margin.', tradeoff: 'Lower volatility but need to work 2 more years' },
    { name: 'Moderate' as const, ret: 0.10, offset: 0, desc: 'Balanced equity-debt mix. Retire at your target age.', tradeoff: 'Good balance of growth and stability' },
    { name: 'Aggressive' as const, ret: 0.14, offset: -2, desc: 'Equity-heavy portfolio. Potential to retire earlier if markets perform.', tradeoff: 'Higher growth potential but significant volatility risk' },
  ]

  return configs.map(cfg => {
    const sRetire = Math.max(age + 5, retireAge + cfg.offset)
    const yearsToRetire = sRetire - age

    const legacy: FinancialProfile = {
      age,
      monthly_income: monthlyIncome,
      monthly_expenses: monthlyExpenses,
      existing_investments: existing,
      retirement_age: sRetire,
      semi_retirement_age: profile.semi_retirement_age ?? sRetire,
    }

    const feas = checkFeasibility(legacy, goals, inflationRate, cfg.ret)
    const river = computeRiverData(legacy, goals, yearsToRetire, inflationRate, 0, cfg.ret)
    const corpusAtRetire = river.length > 0 ? river[river.length - 1].wealth : 0

    return {
      name: cfg.name,
      description: cfg.desc,
      retirement_age: sRetire,
      monthly_sip: feas.total_sip_needed,
      corpus_at_retirement: Math.round(corpusAtRetire * 100) / 100,
      feasibility: feas.status,
      key_tradeoff: cfg.tradeoff,
    }
  })
}

/** Enhanced river projection with multiple income sources and lump-sum inflows */
export function computeEnhancedRiver(
  profile: EnhancedProfile,
  goals: FinancialGoal[],
  years = 30,
  inflationRate = DEFAULT_INFLATION_RATE,
  expectedReturn = DEFAULT_BALANCED_RETURN,
): RiverDataPoint[] {
  const { age, income_sources, expenses, scheduled_expenses = [], lump_sum_inflows = [], children = [] } = profile
  const existingCorpus = profile.existing_corpus || 0
  const corpusReturn = profile.corpus_allocation ? computeCorpusReturn(profile.corpus_allocation) : expectedReturn
  const semiRetAge = profile.semi_retirement_age ?? profile.retirement_age
  const retireAge = profile.retirement_age

  const totalMonthlyExpenses = expenses.reduce((s, e) => s + e.monthly_amount, 0)
  const goalCalcs = calculateAllGoals(goals, totalMonthlyExpenses, inflationRate, expectedReturn)
  const goalSips: Record<string, number> = {}
  for (const g of goalCalcs.goals) goalSips[g.goal_type] = g.monthly_sip

  const projection: RiverDataPoint[] = []
  let wealth = existingCorpus

  for (let y = 0; y <= years; y++) {
    const currentAge = age + y

    // Income: each source with own growth, phase-adjusted
    let annualIncome = 0
    for (const src of income_sources) {
      const base = src.monthly_amount * 12
      const grown = base * Math.pow(1 + src.growth_rate, y)
      annualIncome += phaseAdjustedIncome(grown, currentAge, semiRetAge, retireAge)
    }

    // Expenses: each with own inflation
    let annualExpenses = 0
    for (const exp of expenses) {
      annualExpenses += exp.monthly_amount * 12 * Math.pow(1 + (exp.inflation_rate || inflationRate), y)
    }

    // Scheduled expenses
    for (const sexp of scheduled_expenses) {
      if (sexp.starts_in_years <= y && y < sexp.starts_in_years + sexp.duration_years) {
        const yearsActive = y - sexp.starts_in_years
        annualExpenses += sexp.annual_amount * Math.pow(1 + sexp.growth_rate, yearsActive)
      }
    }

    // Child expenses
    for (const child of children) {
      const childAgeAtYear = (child.age_months / 12) + y
      annualExpenses += childMonthlyExpense(Math.floor(childAgeAtYear)) * 12 * Math.pow(1 + inflationRate, y)
    }

    // Lump-sum inflows
    let lumpSum = 0
    for (const ls of lump_sum_inflows) {
      if (Math.floor(ls.arrives_in_months / 12) === y) lumpSum += ls.amount
    }

    const annualSavings = Math.max(annualIncome - annualExpenses, 0)

    const allocations: Record<string, number> = {}
    for (const goal of goals) {
      allocations[goal.goal_type] = y < goal.timeline_years ? (goalSips[goal.goal_type] || 0) * 12 : 0
    }
    const totalSipAnnual = Object.values(allocations).reduce((a, b) => a + b, 0)

    if (y === 0) {
      wealth = existingCorpus + lumpSum
    } else {
      wealth = wealth * (1 + corpusReturn) + annualSavings + lumpSum
    }

    projection.push({
      year: y,
      age: currentAge,
      income: Math.round(annualIncome * 100) / 100,
      expenses: Math.round(annualExpenses * 100) / 100,
      savings: Math.round(annualSavings * 100) / 100,
      investments: Math.round(totalSipAnnual * 100) / 100,
      unallocated: Math.round(Math.max(annualSavings - totalSipAnnual, 0) * 100) / 100,
      wealth: Math.round(wealth * 100) / 100,
      goal_allocations: Object.fromEntries(
        Object.entries(allocations).map(([k, v]) => [k, Math.round(v * 100) / 100])
      ),
    })
  }

  return projection
}
