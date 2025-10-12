"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { TrendingUp } from "lucide-react"

interface SIPCalculatorProps {
  id: string
  title?: string
  config?: {
    defaults?: {
      monthlyInvestment?: number
      rate?: number
      time?: number
    }
  }
}

export function SIPCalculator({ title, config }: SIPCalculatorProps) {
  const [monthlyInvestment, setMonthlyInvestment] = useState(config?.defaults?.monthlyInvestment || 10000)
  const [rate, setRate] = useState(config?.defaults?.rate || 12)
  const [time, setTime] = useState(config?.defaults?.time || 10)

  const calculateSIP = () => {
    const monthlyRate = rate / (12 * 100)
    const months = time * 12
    
    // SIP Future Value formula: FV = P × ((1 + r)^n - 1) / r × (1 + r)
    const futureValue = monthlyInvestment * 
      (((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate))
    
    const totalInvested = monthlyInvestment * months
    const totalReturns = futureValue - totalInvested
    
    return { futureValue, totalInvested, totalReturns }
  }

  const { futureValue, totalInvested, totalReturns } = calculateSIP()

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle>{title || 'SIP Calculator'}</CardTitle>
        </div>
        <CardDescription>Calculate your Systematic Investment Plan returns</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sip-monthly">Monthly Investment (₹)</Label>
            <Input
              id="sip-monthly"
              type="number"
              value={monthlyInvestment}
              onChange={(e) => setMonthlyInvestment(Number(e.target.value))}
              className="font-mono"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sip-rate">Expected Return (% p.a.)</Label>
            <Input
              id="sip-rate"
              type="number"
              step="0.1"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="font-mono"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sip-time">Time Period (years)</Label>
            <Input
              id="sip-time"
              type="number"
              value={time}
              onChange={(e) => setTime(Number(e.target.value))}
              className="font-mono"
            />
          </div>
        </div>

        {/* Results */}
        <div className="rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 p-6 space-y-3 border border-primary/20">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Amount Invested</span>
            <span className="font-mono font-semibold text-blue-600">₹{totalInvested.toLocaleString('en-IN')}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Estimated Returns</span>
            <span className="font-mono font-semibold text-green-600">+₹{totalReturns.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
          
          <div className="pt-3 border-t border-primary/20">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Value</span>
              <span className="text-2xl font-bold font-mono text-primary">₹{futureValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
          
          <div className="flex justify-between text-xs text-muted-foreground pt-2">
            <span>Monthly: ₹{monthlyInvestment.toLocaleString('en-IN')}</span>
            <span>{(totalReturns / totalInvested * 100).toFixed(1)}% gain</span>
            <span>{time * 12} months</span>
          </div>
        </div>

        {/* Info Box */}
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          💡 <strong>Pro Tip:</strong> Starting early makes a huge difference! A 25-year-old investing ₹5,000/month 
          can accumulate significantly more than a 35-year-old investing ₹10,000/month due to the power of compounding.
        </div>
      </CardContent>
    </Card>
  )
}

