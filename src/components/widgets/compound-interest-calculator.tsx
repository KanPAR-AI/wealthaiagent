"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import { Calculator } from "lucide-react"

interface CompoundInterestCalculatorProps {
  id: string
  title?: string
  config?: {
    defaults?: {
      principal?: number
      rate?: number
      time?: number
      frequency?: number
    }
  }
}

export function CompoundInterestCalculator({ title, config }: CompoundInterestCalculatorProps) {
  const [principal, setPrincipal] = useState(config?.defaults?.principal || 100000)
  const [rate, setRate] = useState(config?.defaults?.rate || 12)
  const [time, setTime] = useState(config?.defaults?.time || 10)
  const [frequency, setFrequency] = useState(config?.defaults?.frequency || 1) // 1 = annually, 12 = monthly

  const calculateCompoundInterest = () => {
    const amount = principal * Math.pow((1 + rate / (100 * frequency)), frequency * time)
    const interest = amount - principal
    return { amount, interest }
  }

  const { amount, interest } = calculateCompoundInterest()

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          <CardTitle>{title || 'Compound Interest Calculator'}</CardTitle>
        </div>
        <CardDescription>Calculate the power of compounding</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="principal">Principal Amount (₹)</Label>
            <Input
              id="principal"
              type="number"
              value={principal}
              onChange={(e) => setPrincipal(Number(e.target.value))}
              className="font-mono"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="rate">Annual Interest Rate (%)</Label>
            <Input
              id="rate"
              type="number"
              step="0.1"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="font-mono"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="time">Time Period (years)</Label>
            <Input
              id="time"
              type="number"
              value={time}
              onChange={(e) => setTime(Number(e.target.value))}
              className="font-mono"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="frequency">Compounding Frequency</Label>
            <select
              id="frequency"
              value={frequency}
              onChange={(e) => setFrequency(Number(e.target.value))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="1">Annually</option>
              <option value="2">Semi-annually</option>
              <option value="4">Quarterly</option>
              <option value="12">Monthly</option>
              <option value="365">Daily</option>
            </select>
          </div>
        </div>

        {/* Results */}
        <div className="rounded-lg bg-primary/5 p-6 space-y-3 border border-primary/20">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Principal Amount</span>
            <span className="font-mono font-semibold">₹{principal.toLocaleString('en-IN')}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Interest Earned</span>
            <span className="font-mono font-semibold text-green-600">+₹{interest.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
          
          <div className="pt-3 border-t border-primary/20">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Final Amount</span>
              <span className="text-2xl font-bold font-mono text-primary">₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground text-center pt-2">
            {((amount - principal) / principal * 100).toFixed(1)}% total return over {time} years
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

