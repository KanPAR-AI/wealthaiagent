"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { Home } from "lucide-react"

interface MortgageCalculatorProps {
  id: string
  title?: string
  config?: {
    defaults?: {
      loanAmount?: number
      interestRate?: number
      loanTerm?: number
    }
  }
}

export function MortgageCalculator({ title, config }: MortgageCalculatorProps) {
  const [loanAmount, setLoanAmount] = useState(config?.defaults?.loanAmount || 5000000) // 50 lakhs
  const [interestRate, setInterestRate] = useState(config?.defaults?.interestRate || 8.5)
  const [loanTerm, setLoanTerm] = useState(config?.defaults?.loanTerm || 20)

  const calculateMortgage = () => {
    const monthlyRate = interestRate / (12 * 100)
    const months = loanTerm * 12
    
    // EMI = [P x R x (1+R)^N]/[(1+R)^N-1]
    const emi = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
                (Math.pow(1 + monthlyRate, months) - 1)
    
    const totalPayment = emi * months
    const totalInterest = totalPayment - loanAmount
    
    return { emi, totalPayment, totalInterest }
  }

  const { emi, totalPayment, totalInterest } = calculateMortgage()

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5 text-primary" />
          <CardTitle>{title || 'Home Loan EMI Calculator'}</CardTitle>
        </div>
        <CardDescription>Calculate your monthly EMI and total interest</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="loan-amount">Loan Amount (₹)</Label>
            <Input
              id="loan-amount"
              type="number"
              value={loanAmount}
              onChange={(e) => setLoanAmount(Number(e.target.value))}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              ₹{(loanAmount / 100000).toFixed(1)} Lakhs
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="interest-rate">Interest Rate (% p.a.)</Label>
            <Input
              id="interest-rate"
              type="number"
              step="0.1"
              value={interestRate}
              onChange={(e) => setInterestRate(Number(e.target.value))}
              className="font-mono"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="loan-term">Loan Tenure (years)</Label>
            <Input
              id="loan-term"
              type="number"
              value={loanTerm}
              onChange={(e) => setLoanTerm(Number(e.target.value))}
              className="font-mono"
            />
          </div>
        </div>

        {/* EMI Display */}
        <div className="rounded-lg bg-primary text-primary-foreground p-6 text-center">
          <div className="text-sm font-medium mb-2">Monthly EMI</div>
          <div className="text-4xl font-bold font-mono">₹{emi.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-xs text-muted-foreground mb-1">Principal</div>
            <div className="font-mono font-semibold text-sm">₹{(loanAmount / 100000).toFixed(1)}L</div>
          </div>
          
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-xs text-muted-foreground mb-1">Interest</div>
            <div className="font-mono font-semibold text-sm text-orange-600">₹{(totalInterest / 100000).toFixed(1)}L</div>
          </div>
          
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-xs text-muted-foreground mb-1">Total</div>
            <div className="font-mono font-semibold text-sm">₹{(totalPayment / 100000).toFixed(1)}L</div>
          </div>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          💡 <strong>Tip:</strong> Making extra payments towards the principal can significantly reduce your total 
          interest and loan tenure. Even an extra ₹5,000/month can save lakhs in interest!
        </div>
      </CardContent>
    </Card>
  )
}

