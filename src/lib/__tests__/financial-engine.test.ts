import {
  futureValue,
  sipNeeded,
  sipFutureValue,
  retirementCorpus,
  calculateGoalCorpus,
  calculateAllGoals,
  computeRiverData,
  runMonteCarloSimulation,
  checkFeasibility,
  generateNudges,
  DEFAULT_BALANCED_RETURN,
  DEFAULT_INFLATION_RATE,
} from '../financial-engine'
import { formatINR, formatPercent, formatYears, formatINRCompact } from '../formatters'
import type { FinancialProfile, FinancialGoal } from '@/components/widgets/financial-planner/types'

// ── Fixtures ──────────────────────────────────────────────────────────

const sampleProfile: FinancialProfile = {
  age: 30,
  monthly_income: 100000,
  monthly_expenses: 50000,
  existing_investments: 500000,
}

const sampleGoals: FinancialGoal[] = [
  { goal_type: 'emergency_fund', name: 'Emergency Fund', target_amount: 300000, timeline_years: 1, priority: 1 },
  { goal_type: 'home_purchase', name: 'Home', target_amount: 5000000, timeline_years: 5, priority: 1 },
  { goal_type: 'retirement', name: 'Retirement', target_amount: 0, timeline_years: 30, priority: 2 },
]

// ── Future Value ──────────────────────────────────────────────────────

describe('futureValue', () => {
  it('computes basic FV', () => {
    expect(Math.round(futureValue(100, 0.10, 1) * 100) / 100).toBe(110.0)
  })

  it('computes compound FV over 10 years', () => {
    expect(Math.round(futureValue(100, 0.10, 10) * 100) / 100).toBe(259.37)
  })

  it('handles zero rate', () => {
    expect(futureValue(1000, 0, 10)).toBe(1000)
  })

  it('handles zero years', () => {
    expect(futureValue(1000, 0.10, 0)).toBe(1000)
  })
})

// ── SIP ───────────────────────────────────────────────────────────────

describe('sipNeeded', () => {
  it('computes SIP for 10L in 5 years at 12%', () => {
    const sip = sipNeeded(1000000, 0.12, 5)
    expect(sip).toBeGreaterThan(12000)
    expect(sip).toBeLessThan(13000)
  })

  it('handles zero years', () => {
    expect(sipNeeded(1000000, 0.12, 0)).toBe(1000000)
  })
})

describe('sipFutureValue round-trip', () => {
  it('SIP needed for 10L then FV equals target', () => {
    const target = 1000000
    const monthly = sipNeeded(target, 0.12, 10)
    const fv = sipFutureValue(monthly, 0.12, 10)
    expect(Math.abs(fv - target)).toBeLessThan(1)
  })
})

// ── Retirement corpus ─────────────────────────────────────────────────

describe('retirementCorpus', () => {
  it('produces crore-range corpus', () => {
    const corpus = retirementCorpus(50000, 0.06, 30, 25, 0.07)
    expect(corpus).toBeGreaterThan(1_00_00_000) // > 1 Cr
  })

  it('later retirement means larger corpus', () => {
    const early = retirementCorpus(50000, 0.06, 20, 25)
    const late = retirementCorpus(50000, 0.06, 30, 25)
    expect(late).toBeGreaterThan(early)
  })
})

// ── Goal corpus ───────────────────────────────────────────────────────

describe('calculateGoalCorpus', () => {
  it('emergency fund = 6x expenses', () => {
    const result = calculateGoalCorpus('emergency_fund', 300000, 1, 0.06, 0.10, 50000)
    expect(result.corpus_needed).toBe(300000)
  })

  it('home purchase inflated', () => {
    const result = calculateGoalCorpus('home_purchase', 5000000, 5, 0.06)
    expect(result.corpus_needed).toBeGreaterThan(5000000)
    expect(result.monthly_sip).toBeGreaterThan(0)
  })

  it('retirement goal', () => {
    const result = calculateGoalCorpus('retirement', 0, 30, 0.06, 0.10, 50000)
    expect(result.corpus_needed).toBeGreaterThan(0)
    expect(result.monthly_sip).toBeGreaterThan(0)
  })
})

describe('calculateAllGoals', () => {
  it('returns all goals with SIP', () => {
    const result = calculateAllGoals(sampleGoals, 50000)
    expect(result.goals).toHaveLength(3)
    expect(result.total_monthly_sip).toBeGreaterThan(0)
    for (const g of result.goals) {
      expect(g.corpus_needed).toBeDefined()
      expect(g.monthly_sip).toBeDefined()
    }
  })
})

// ── River projection ──────────────────────────────────────────────────

describe('computeRiverData', () => {
  it('produces correct number of years', () => {
    const river = computeRiverData(sampleProfile, sampleGoals, 10)
    expect(river).toHaveLength(11) // year 0 to 10
    expect(river[0].year).toBe(0)
    expect(river[10].year).toBe(10)
  })

  it('income grows over time', () => {
    const river = computeRiverData(sampleProfile, sampleGoals, 5)
    expect(river[5].income).toBeGreaterThan(river[0].income)
  })

  it('expenses grow over time', () => {
    const river = computeRiverData(sampleProfile, sampleGoals, 5)
    expect(river[5].expenses).toBeGreaterThan(river[0].expenses)
  })

  it('wealth grows over time', () => {
    const river = computeRiverData(sampleProfile, sampleGoals, 10)
    expect(river[10].wealth).toBeGreaterThan(river[0].wealth)
  })

  it('has goal allocations', () => {
    const river = computeRiverData(sampleProfile, sampleGoals, 5)
    expect(river[1].goal_allocations).toBeDefined()
  })
})

// ── Monte Carlo ───────────────────────────────────────────────────────

describe('runMonteCarloSimulation', () => {
  it('percentiles are ordered', () => {
    const river = computeRiverData(sampleProfile, sampleGoals, 10)
    const mc = runMonteCarloSimulation(river, 500)
    for (let y = 0; y < river.length; y++) {
      expect(mc.p10[y]).toBeLessThanOrEqual(mc.p25[y])
      expect(mc.p25[y]).toBeLessThanOrEqual(mc.p50[y])
      expect(mc.p50[y]).toBeLessThanOrEqual(mc.p75[y])
      expect(mc.p75[y]).toBeLessThanOrEqual(mc.p90[y])
    }
  })

  it('correct output length', () => {
    const river = computeRiverData(sampleProfile, sampleGoals, 5)
    const mc = runMonteCarloSimulation(river, 100)
    expect(mc.p50).toHaveLength(6)
  })

  it('handles empty river', () => {
    const mc = runMonteCarloSimulation([], 100)
    expect(mc.p50).toEqual([])
  })
})

// ── Feasibility ───────────────────────────────────────────────────────

describe('checkFeasibility', () => {
  it('high income → green', () => {
    const profile: FinancialProfile = { age: 30, monthly_income: 200000, monthly_expenses: 50000, existing_investments: 0 }
    const goals: FinancialGoal[] = [{ goal_type: 'emergency_fund', name: 'EF', target_amount: 300000, timeline_years: 1, priority: 1 }]
    const result = checkFeasibility(profile, goals)
    expect(result.status).toBe('green')
    expect(result.gap).toBe(0)
  })

  it('low income → red', () => {
    const profile: FinancialProfile = { age: 30, monthly_income: 30000, monthly_expenses: 25000, existing_investments: 0 }
    const goals: FinancialGoal[] = [
      { goal_type: 'home_purchase', name: 'Home', target_amount: 10000000, timeline_years: 3, priority: 1 },
      { goal_type: 'retirement', name: 'Retirement', target_amount: 0, timeline_years: 30, priority: 1 },
    ]
    const result = checkFeasibility(profile, goals)
    expect(result.status).toBe('red')
    expect(result.gap).toBeGreaterThan(0)
  })

  it('zero income → red', () => {
    const profile: FinancialProfile = { age: 30, monthly_income: 0, monthly_expenses: 0, existing_investments: 0 }
    const goals: FinancialGoal[] = [{ goal_type: 'emergency_fund', name: 'EF', target_amount: 100000, timeline_years: 1, priority: 1 }]
    const result = checkFeasibility(profile, goals)
    expect(result.status).toBe('red')
  })

  it('per-goal status present', () => {
    const result = checkFeasibility(sampleProfile, sampleGoals)
    expect(Object.keys(result.per_goal_status)).toHaveLength(3)
  })
})

// ── Nudges ────────────────────────────────────────────────────────────

describe('generateNudges', () => {
  it('generates nudges for gap', () => {
    const nudges = generateNudges(sampleProfile, sampleGoals, 10000)
    expect(nudges.length).toBeGreaterThan(0)
    // Sorted by impact
    for (let i = 0; i < nudges.length - 1; i++) {
      expect(nudges[i].impact_monthly).toBeGreaterThanOrEqual(nudges[i + 1].impact_monthly)
    }
  })

  it('no nudges when no gap', () => {
    expect(generateNudges(sampleProfile, sampleGoals, 0)).toEqual([])
  })

  it('includes key nudge types', () => {
    const nudges = generateNudges(sampleProfile, sampleGoals, 20000)
    const types = new Set(nudges.map(n => n.nudge_type))
    expect(types.has('reduce_expenses')).toBe(true)
    expect(types.has('increase_income')).toBe(true)
  })
})

// ── INR formatting ───────────────────────────────────────────────────

describe('formatINR', () => {
  it('formats crores', () => {
    expect(formatINR(15000000)).toBe('₹1.5Cr')
  })

  it('formats lakhs', () => {
    expect(formatINR(1250000)).toBe('₹12.5L')
  })

  it('formats thousands', () => {
    expect(formatINR(5000)).toBe('₹5.0K')
  })

  it('formats small amounts', () => {
    expect(formatINR(500)).toBe('₹500')
  })

  it('handles negatives', () => {
    expect(formatINR(-1500000)).toBe('-₹15.0L')
  })
})

describe('formatPercent', () => {
  it('formats decimal to percent', () => {
    expect(formatPercent(0.12)).toBe('12.0%')
  })
})

describe('formatYears', () => {
  it('singular', () => {
    expect(formatYears(1)).toBe('1 year')
  })

  it('plural', () => {
    expect(formatYears(5)).toBe('5 years')
  })
})

describe('formatINRCompact', () => {
  it('compact crore format', () => {
    expect(formatINRCompact(15000000)).toBe('1.5Cr')
  })
})

// ── Edge cases ────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('zero income river', () => {
    const profile: FinancialProfile = { age: 30, monthly_income: 0, monthly_expenses: 0, existing_investments: 0 }
    const river = computeRiverData(profile, [], 5)
    expect(river).toHaveLength(6)
    expect(river[5].wealth).toBe(0)
  })

  it('single goal river', () => {
    const goals: FinancialGoal[] = [{ goal_type: 'retirement', name: 'R', target_amount: 0, timeline_years: 30, priority: 1 }]
    const river = computeRiverData(sampleProfile, goals, 5)
    expect(river).toHaveLength(6)
  })

  it('100% expenses → red feasibility', () => {
    const profile: FinancialProfile = { age: 30, monthly_income: 50000, monthly_expenses: 50000, existing_investments: 0 }
    const goals: FinancialGoal[] = [{ goal_type: 'emergency_fund', name: 'EF', target_amount: 100000, timeline_years: 1, priority: 1 }]
    const result = checkFeasibility(profile, goals)
    expect(result.status).toBe('red')
  })
})
