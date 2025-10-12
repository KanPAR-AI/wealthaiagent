"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useMemo } from "react"

interface BarChartWidgetDataset {
  label: string
  values: number[]
  color: string
}

interface BarChartWidgetData {
  labels: string[]
  datasets: BarChartWidgetDataset[]
}

interface BarChartWidgetProps {
  id: string
  title?: string
  data: BarChartWidgetData
  sourceUrl?: string
}

export function BarChartWidget({ title, data }: BarChartWidgetProps) {
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
        <CardTitle>{title || 'Performance'}</CardTitle>
        <CardDescription>Monthly trends and growth</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <RechartsBarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
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
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dashed" />}
            />
            {data.datasets.map((dataset) => {
              const key = dataset.label.toLowerCase().replace(/\s+/g, '_')
              return (
                <Bar
                  key={key}
                  dataKey={dataset.label}
                  fill={`var(--color-${key})`}
                  radius={4}
                />
              )
            })}
          </RechartsBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

