"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { Wallet } from "lucide-react"

interface RetirementCalculatorProps {
  id: string
  title?: string
  config?: {
    defaults?: {
      currentAge?: number
      retirementAge?: number
      monthlySavings?: number
      currentSavings?: number
      expectedReturn?: number
      inflationRate?: number
    }
  }
}

export function RetirementCalculator({ title, config }: RetirementCalculatorProps) {
  const [currentAge, setCurrentAge] = useState(config?.defaults?.currentAge || 30)
  const [retirementAge, setRetirementAge] = useState(config?.defaults?.retirementAge || 60)
  const [monthlySavings, setMonthlySavings] = useState(config?.defaults?.monthlySavings || 15000)
  const [currentSavings, setCurrentSavings] = useState(config?.defaults?.currentSavings || 500000)
  const [expectedReturn, setExpectedReturn] = useState(config?.defaults?.expectedReturn || 12)

  const calculateRetirement = () => {
    const yearsToRetirement = retirementAge - currentAge
    const monthsToRetirement = yearsToRetirement * 12
    const monthlyRate = expectedReturn / (12 * 100)
    
    // Future value of current savings
    const fvCurrentSavings = currentSavings * Math.pow(1 + monthlyRate, monthsToRetirement)
    
    // Future value of monthly SIP
    const fvMonthlySIP = monthlySavings * 
      (((Math.pow(1 + monthlyRate, monthsToRetirement) - 1) / monthlyRate) * (1 + monthlyRate))
    
    const totalCorpus = fvCurrentSavings + fvMonthlySIP
    const totalInvested = currentSavings + (monthlySavings * monthsToRetirement)
    const totalReturns = totalCorpus - totalInvested
    
    // Monthly income at 4% withdrawal rate
    const monthlyIncome = (totalCorpus * 0.04) / 12
    
    return { totalCorpus, totalInvested, totalReturns, monthlyIncome, yearsToRetirement }
  }

  const { totalCorpus, totalInvested, totalReturns, monthlyIncome, yearsToRetirement } = calculateRetirement()

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <CardTitle>{title || 'Retirement Planning Calculator'}</CardTitle>
        </div>
        <CardDescription>Plan your retirement corpus and monthly income</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Fields */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="current-age">Current Age</Label>
            <Input
              id="current-age"
              type="number"
              value={currentAge}
              onChange={(e) => setCurrentAge(Number(e.target.value))}
              className="font-mono"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="retirement-age">Retirement Age</Label>
            <Input
              id="retirement-age"
              type="number"
              value={retirementAge}
              onChange={(e) => setRetirementAge(Number(e.target.value))}
              className="font-mono"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="monthly-savings">Monthly Savings (₹)</Label>
            <Input
              id="monthly-savings"
              type="number"
              value={monthlySavings}
              onChange={(e) => setMonthlySavings(Number(e.target.value))}
              className="font-mono"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="current-savings">Current Savings (₹)</Label>
            <Input
              id="current-savings"
              type="number"
              value={currentSavings}
              onChange={(e) => setCurrentSavings(Number(e.target.value))}
              className="font-mono"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="expected-return">Expected Return (%)</Label>
            <Input
              id="expected-return"
              type="number"
              step="0.1"
              value={expectedReturn}
              onChange={(e) => setExpectedReturn(Number(e.target.value))}
              className="font-mono"
            />
          </div>
          
          <div className="space-y-2 flex items-end">
            <div className="text-sm text-muted-foreground">
              {yearsToRetirement} years to retirement
            </div>
          </div>
        </div>

        {/* Main Result */}
        <div className="rounded-lg bg-gradient-to-br from-green-500/10 to-blue-500/10 p-6 border border-green-500/20">
          <div className="text-center space-y-2">
            <div className="text-sm text-muted-foreground">Retirement Corpus at Age {retirementAge}</div>
            <div className="text-4xl font-bold font-mono text-primary">
              ₹{(totalCorpus / 10000000).toFixed(2)} Cr
            </div>
            <div className="text-xs text-muted-foreground">
              ≈ ${(totalCorpus / 83).toLocaleString('en-US', { maximumFractionDigits: 0 })} USD
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="text-center p-4 rounded-lg bg-muted/50 border">
            <div className="text-xs text-muted-foreground mb-1">Total Invested</div>
            <div className="font-mono font-semibold text-blue-600">₹{(totalInvested / 100000).toFixed(1)}L</div>
          </div>
          
          <div className="text-center p-4 rounded-lg bg-muted/50 border">
            <div className="text-xs text-muted-foreground mb-1">Returns Generated</div>
            <div className="font-mono font-semibold text-green-600">₹{(totalReturns / 100000).toFixed(1)}L</div>
          </div>
          
          <div className="text-center p-4 rounded-lg bg-muted/50 border">
            <div className="text-xs text-muted-foreground mb-1">Monthly Income*</div>
            <div className="font-mono font-semibold text-primary">₹{monthlyIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          </div>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          *Monthly income based on 4% annual withdrawal rate (safe withdrawal rate)
        </div>
      </CardContent>
    </Card>
  )
}

