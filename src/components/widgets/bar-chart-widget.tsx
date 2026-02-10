"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart"
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useMemo } from "react"

function formatINR(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)} L`
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(0)}k`
  return `${sign}₹${abs.toFixed(0)}`
}

interface BarChartWidgetDataset {
  label: string
  values: number[]
  color: string
  stackId?: string
}

interface BarChartWidgetData {
  labels: string[]
  datasets: BarChartWidgetDataset[]
}

interface BarChartWidgetProps {
  id: string
  title?: string
  description?: string
  data: BarChartWidgetData
  sourceUrl?: string
}

export function BarChartWidget({ title, description, data }: BarChartWidgetProps) {
  // Transform data for Recharts
  const chartData = useMemo(() => {
    return data.labels.map((label, index) => {
      const dataPoint: any = { label }
      data.datasets.forEach((dataset) => {
        dataPoint[dataset.label] = dataset.values[index]
      })
      return dataPoint
    })
  }, [data])

  // Generate chart config from datasets
  const chartConfig = useMemo(() => {
    return data.datasets.reduce((config, dataset, index) => {
      const key = dataset.label.toLowerCase().replace(/\s+/g, '_')
      config[key] = {
        label: dataset.label,
        color: dataset.color || `hsl(var(--chart-${index + 1}))`,
      }
      return config
    }, {} as ChartConfig)
  }, [data.datasets]) satisfies ChartConfig

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title || 'Performance'}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <RechartsBarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tickFormatter={(value) => {
                if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`
                if (value >= 100000) return `₹${(value / 100000).toFixed(0)}L`
                return `₹${(value / 1000).toFixed(0)}k`
              }}
            />
            <ChartTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 shadow-xl text-foreground">
                    <p className="font-medium text-sm mb-1.5">{label}</p>
                    <div className="grid gap-1">
                      {payload.map((entry: any, idx: number) => {
                        if (entry.value === 0) return null
                        return (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <div className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: entry.color || entry.fill }} />
                            <span className="text-muted-foreground">{entry.name}</span>
                            <span className="ml-auto font-mono font-medium tabular-nums">{formatINR(entry.value)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              }}
            />
            {data.datasets.map((dataset) => {
              const key = dataset.label.toLowerCase().replace(/\s+/g, '_')
              return (
                <Bar
                  key={key}
                  dataKey={dataset.label}
                  fill={`var(--color-${key})`}
                  stackId={dataset.stackId}
                  radius={dataset.stackId ? 0 : 4}
                />
              )
            })}
          </RechartsBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
