import { useMemo, useState, useCallback } from 'react'
import type { RiverDataPoint, MonteCarloResult } from './types'
import { formatINR } from '@/lib/formatters'

interface RiverVisualizationProps {
  riverData: RiverDataPoint[]
  monteCarlo?: MonteCarloResult
  width?: number
  height?: number
}

const COLORS = {
  income: '#3b82f6',       // blue
  expenses: '#ef4444',     // red
  savings: '#22c55e',      // green
  wealth: '#a855f7',       // purple
  mc_band: '#a855f7',      // purple (translucent)
  mc_median: '#a855f7',    // purple (solid)
  grid: '#334155',
  text: '#94a3b8',
  tooltip_bg: '#1e293b',
}

export function RiverVisualization({ riverData, monteCarlo, width = 600, height = 320 }: RiverVisualizationProps) {
  const [hoveredYear, setHoveredYear] = useState<number | null>(null)

  const pad = { top: 30, right: 20, bottom: 35, left: 60 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom

  const { maxWealth, xScale, yScale, wealthPath, incomePath, expensePath, mcBandPath, mcMedianPath } = useMemo(() => {
    if (!riverData.length) return { maxWealth: 0, xScale: () => 0, yScale: () => 0, wealthPath: '', incomePath: '', expensePath: '', mcBandPath: '', mcMedianPath: '' }

    const years = riverData.length

    // Determine max Y from wealth (or MC p90 if available)
    let maxY = Math.max(...riverData.map(d => d.wealth))
    if (monteCarlo?.p90?.length) {
      maxY = Math.max(maxY, ...monteCarlo.p90)
    }
    maxY = maxY * 1.1 // 10% headroom

    const xs = (y: number) => pad.left + (y / (years - 1)) * plotW
    const ys = (v: number) => pad.top + plotH - (v / maxY) * plotH

    // Wealth line
    const wp = riverData.map((d, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(d.wealth).toFixed(1)}`).join(' ')

    // Income line
    const ip = riverData.map((d, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(d.income).toFixed(1)}`).join(' ')

    // Expenses line
    const ep = riverData.map((d, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(d.expenses).toFixed(1)}`).join(' ')

    // Monte Carlo band (p10 to p90 fill)
    let mcBand = ''
    let mcMed = ''
    if (monteCarlo?.p10?.length && monteCarlo.p10.length === years) {
      const upper = monteCarlo.p90.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(' ')
      const lower = [...monteCarlo.p10].reverse().map((v, i) => {
        const yi = years - 1 - i
        return `L${xs(yi).toFixed(1)},${ys(v).toFixed(1)}`
      }).join(' ')
      mcBand = upper + ' ' + lower + ' Z'

      mcMed = monteCarlo.p50.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(' ')
    }

    return { maxWealth: maxY, xScale: xs, yScale: ys, wealthPath: wp, incomePath: ip, expensePath: ep, mcBandPath: mcBand, mcMedianPath: mcMed }
  }, [riverData, monteCarlo, plotW, plotH, pad])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left - pad.left
    const yearIndex = Math.round((x / plotW) * (riverData.length - 1))
    if (yearIndex >= 0 && yearIndex < riverData.length) {
      setHoveredYear(yearIndex)
    }
  }, [riverData.length, plotW, pad.left])

  const hoveredData = hoveredYear !== null ? riverData[hoveredYear] : null

  // Y-axis ticks
  const yTicks = useMemo(() => {
    if (maxWealth <= 0) return []
    const tickCount = 5
    const step = maxWealth / tickCount
    return Array.from({ length: tickCount + 1 }, (_, i) => i * step)
  }, [maxWealth])

  // X-axis ticks (every 5 years)
  const xTicks = useMemo(() => {
    if (!riverData.length) return []
    const ticks = []
    for (let i = 0; i < riverData.length; i += 5) {
      ticks.push(i)
    }
    if (ticks[ticks.length - 1] !== riverData.length - 1) {
      ticks.push(riverData.length - 1)
    }
    return ticks
  }, [riverData])

  if (!riverData.length) {
    return <div className="text-slate-500 text-sm p-4">No projection data</div>
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredYear(null)}
    >
      {/* Grid lines */}
      {yTicks.map((v, i) => (
        <g key={`y-${i}`}>
          <line x1={pad.left} y1={yScale(v)} x2={width - pad.right} y2={yScale(v)} stroke={COLORS.grid} strokeWidth={0.5} strokeDasharray="4,4" />
          <text x={pad.left - 8} y={yScale(v) + 4} textAnchor="end" fill={COLORS.text} fontSize={9}>
            {formatINR(v)}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {xTicks.map(i => (
        <text key={`x-${i}`} x={xScale(i)} y={height - 8} textAnchor="middle" fill={COLORS.text} fontSize={9}>
          {riverData[i]?.age ? `Age ${riverData[i].age}` : `Yr ${i}`}
        </text>
      ))}

      {/* Monte Carlo variance band */}
      {mcBandPath && (
        <path d={mcBandPath} fill={COLORS.mc_band} fillOpacity={0.1} stroke="none" />
      )}

      {/* Monte Carlo median */}
      {mcMedianPath && (
        <path d={mcMedianPath} fill="none" stroke={COLORS.mc_median} strokeWidth={1} strokeDasharray="4,2" opacity={0.5} />
      )}

      {/* Income line */}
      <path d={incomePath} fill="none" stroke={COLORS.income} strokeWidth={1.5} opacity={0.6} />

      {/* Expenses line */}
      <path d={expensePath} fill="none" stroke={COLORS.expenses} strokeWidth={1.5} opacity={0.6} />

      {/* Wealth line (main) */}
      <path d={wealthPath} fill="none" stroke={COLORS.wealth} strokeWidth={2.5} />

      {/* Hover line + tooltip */}
      {hoveredYear !== null && hoveredData && (
        <>
          <line x1={xScale(hoveredYear)} y1={pad.top} x2={xScale(hoveredYear)} y2={pad.top + plotH} stroke="#fff" strokeWidth={0.5} opacity={0.3} />
          <circle cx={xScale(hoveredYear)} cy={yScale(hoveredData.wealth)} r={4} fill={COLORS.wealth} stroke="#fff" strokeWidth={1.5} />

          <foreignObject x={Math.min(xScale(hoveredYear) + 10, width - 160)} y={pad.top + 5} width={150} height={90}>
            <div className="bg-slate-800/95 border border-white/10 rounded-lg p-2 text-xs shadow-lg">
              <div className="text-slate-400">Age {hoveredData.age} (Year {hoveredData.year})</div>
              <div className="text-purple-400 font-medium">Wealth: {formatINR(hoveredData.wealth)}</div>
              <div className="text-blue-400">Income: {formatINR(hoveredData.income)}</div>
              <div className="text-red-400">Expenses: {formatINR(hoveredData.expenses)}</div>
            </div>
          </foreignObject>
        </>
      )}

      {/* Legend */}
      <g transform={`translate(${pad.left + 5}, ${pad.top - 15})`}>
        {[
          { label: 'Wealth', color: COLORS.wealth },
          { label: 'Income', color: COLORS.income },
          { label: 'Expenses', color: COLORS.expenses },
        ].map((item, i) => (
          <g key={item.label} transform={`translate(${i * 85}, 0)`}>
            <line x1={0} y1={0} x2={15} y2={0} stroke={item.color} strokeWidth={2} />
            <text x={20} y={4} fill={COLORS.text} fontSize={9}>{item.label}</text>
          </g>
        ))}
      </g>

      {/* Flow animation on wealth line */}
      <style>{`
        @keyframes flow {
          0% { stroke-dashoffset: 20; }
          100% { stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  )
}
