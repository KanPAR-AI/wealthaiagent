"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
} from "@/components/ui/chart"
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts"
import { useMemo } from "react"

function formatINR(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)} L`
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(0)}k`
  return `${sign}₹${abs.toFixed(0)}`
}

interface Dataset {
  label: string
  values: number[]
  color: string
  chartType: "bar" | "line"
  stackId?: string
  dashed?: boolean
  dotted?: boolean
  strokeWidth?: number
  yAxisId?: "left" | "right"
}

interface FinancialSummaryData {
  labels: string[]
  datasets: Dataset[]
}

interface FinancialSummaryChartProps {
  id: string
  title?: string
  description?: string
  data: FinancialSummaryData
  sourceUrl?: string
}

export function FinancialSummaryChart({ title, description, data }: FinancialSummaryChartProps) {
  const chartData = useMemo(() => {
    return data.labels.map((label, index) => {
      const point: any = { label }
      data.datasets.forEach((ds) => {
        point[ds.label] = ds.values[index]
      })
      return point
    })
  }, [data])

  const chartConfig = useMemo(() => {
    return data.datasets.reduce((config, ds, index) => {
      const key = ds.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')
      config[key] = {
        label: ds.label,
        color: ds.color || `hsl(var(--chart-${index + 1}))`,
      }
      return config
    }, {} as ChartConfig)
  }, [data.datasets]) satisfies ChartConfig

  const hasRightAxis = data.datasets.some((ds) => ds.yAxisId === "right")

  // Separate bar and line datasets
  const barDatasets = data.datasets.filter((ds) => ds.chartType === "bar")
  const lineDatasets = data.datasets.filter((ds) => ds.chartType === "line")

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title || 'Financial Summary'}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[380px] w-full">
          <ComposedChart data={chartData} margin={{ top: 5, right: hasRightAxis ? 20 : 5, bottom: 5, left: 5 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="label"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              fontSize={12}
            />
            {/* Left Y-axis: ₹ values (handles negative for outflows) */}
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={11}
              tickFormatter={(value) => {
                const abs = Math.abs(value)
                const sign = value < 0 ? '-' : ''
                if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(1)}Cr`
                if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(0)}L`
                return `${sign}₹${(abs / 1000).toFixed(0)}k`
              }}
            />
            {/* Right Y-axis: % for IRR */}
            {hasRightAxis && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
                tickFormatter={(value) => `${value}%`}
              />
            )}
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="rounded-lg border bg-background px-3 py-2.5 shadow-xl text-foreground min-w-[200px]">
                    <p className="font-semibold text-sm mb-2 border-b pb-1.5">{label}</p>
                    <div className="grid gap-1">
                      {payload.map((entry: any, idx: number) => {
                        if (entry.value === 0 || entry.value === undefined) return null
                        const ds = data.datasets.find((d) => d.label === entry.name)
                        const isPercent = ds?.yAxisId === "right"
                        const val = Number(entry.value)
                        const isNegative = val < 0
                        return (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <div
                              className="h-2.5 w-2.5 shrink-0 rounded-sm"
                              style={{ backgroundColor: entry.color || entry.fill || entry.stroke }}
                            />
                            <span className="text-muted-foreground">{entry.name}</span>
                            <span className={`ml-auto font-mono font-medium tabular-nums ${isNegative ? 'text-red-500' : 'text-green-600'}`}>
                              {isPercent
                                ? `${val.toFixed(1)}%`
                                : formatINR(Math.abs(val))}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              iconSize={10}
            />

            {/* Zero line for bidirectional charts */}
            <ReferenceLine yAxisId="left" y={0} stroke="hsl(var(--border))" strokeWidth={1} />

            {/* Render stacked bars for cost breakdown */}
            {barDatasets.map((ds) => (
              <Bar
                key={ds.label}
                dataKey={ds.label}
                yAxisId={ds.yAxisId || "left"}
                fill={ds.color}
                stackId={ds.stackId}
                radius={0}
                barSize={32}
              />
            ))}

            {/* Render lines for values, proceeds, etc. */}
            {lineDatasets.map((ds) => (
              <Line
                key={ds.label}
                type="monotone"
                dataKey={ds.label}
                yAxisId={ds.yAxisId || "left"}
                stroke={ds.color}
                strokeWidth={ds.strokeWidth || 2}
                strokeDasharray={ds.dotted ? "3 3" : ds.dashed ? "8 4" : undefined}
                dot={ds.dotted ? { r: 3, fill: ds.color } : false}
                activeDot={{ r: 4 }}
              />
            ))}
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
