"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { CartesianGrid, Line, LineChart as RechartsLineChart, XAxis, YAxis } from "recharts"
import { useMemo } from "react"

interface LineChartWidgetDataset {
  label: string
  values: number[]
  color: string
}

interface LineChartWidgetData {
  labels: string[]
  datasets: LineChartWidgetDataset[]
}

interface LineChartWidgetProps {
  id: string
  title?: string
  data: LineChartWidgetData
  sourceUrl?: string
}

export function LineChartWidget({ title, data }: LineChartWidgetProps) {
  // Transform data for Recharts
  const chartData = useMemo(() => {
    return data.labels.map((label, index) => {
      const dataPoint: any = { month: label }
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
        <CardTitle>{title || 'Growth Trend'}</CardTitle>
        <CardDescription>Historical performance over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <RechartsLineChart accessibilityLayer data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            {data.datasets.map((dataset) => {
              const key = dataset.label.toLowerCase().replace(/\s+/g, '_')
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={dataset.label}
                  stroke={`var(--color-${key})`}
                  strokeWidth={2}
                  dot={false}
                />
              )
            })}
          </RechartsLineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

