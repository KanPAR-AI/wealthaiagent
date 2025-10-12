"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Label, Pie, PieChart } from "recharts"
import { useMemo } from "react"

interface PieChartWidgetData {
  labels: string[]
  values: number[]
  colors: string[]
}

interface PieChartWidgetProps {
  id: string
  title?: string
  data: PieChartWidgetData
  sourceUrl?: string
}

export function PieChartWidget({ title, data }: PieChartWidgetProps) {
  // Transform data for Recharts
  const chartData = useMemo(() => {
    return data.labels.map((label, index) => ({
      name: label,
      value: data.values[index],
      fill: data.colors[index] || `hsl(var(--chart-${index + 1}))`,
    }))
  }, [data])

  // Generate chart config from data
  const chartConfig = useMemo(() => {
    return data.labels.reduce((config, label, index) => {
      config[label.toLowerCase().replace(/\s+/g, '_')] = {
        label: label,
        color: data.colors[index] || `hsl(var(--chart-${index + 1}))`,
      }
      return config
    }, {} as ChartConfig)
  }, [data]) satisfies ChartConfig

  const totalValue = useMemo(() => {
    return data.values.reduce((acc, curr) => acc + curr, 0)
  }, [data.values])

  return (
    <Card className="w-full">
      <CardHeader className="items-center pb-0">
        <CardTitle>{title || 'Distribution'}</CardTitle>
        <CardDescription>Asset Allocation Breakdown</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[300px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              strokeWidth={5}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-3xl font-bold"
                        >
                          {totalValue}%
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground"
                        >
                          Total
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

