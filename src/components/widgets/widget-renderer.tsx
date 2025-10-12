import { PieChartWidget } from "./pie-chart-widget"
import { BarChartWidget } from "./bar-chart-widget"
import { TableWidget } from "./table-widget"
import { LineChartWidget } from "./line-chart-widget"
import { CompoundInterestCalculator } from "./compound-interest-calculator"
import { SIPCalculator } from "./sip-calculator"
import { MortgageCalculator } from "./mortgage-calculator"
import { RetirementCalculator } from "./retirement-calculator"

export interface Widget {
  id: string
  type: string
  title?: string
  data: any
  config?: any
  sourceUrl?: string
}

interface WidgetRendererProps {
  widget: Widget
}

export function WidgetRenderer({ widget }: WidgetRendererProps) {
  console.log('[WidgetRenderer] Rendering widget:', widget.type, widget)

  switch (widget.type) {
    case 'widget_pie_chart':
      return <PieChartWidget {...widget} />
    
    case 'widget_bar_chart':
      return <BarChartWidget {...widget} />
    
    case 'widget_line_chart':
      return <LineChartWidget {...widget} />
    
    case 'widget_table':
      return <TableWidget {...widget} />
    
    case 'widget_compound_interest_calculator':
      return <CompoundInterestCalculator {...widget} />
    
    case 'widget_sip_calculator':
      return <SIPCalculator {...widget} />
    
    case 'widget_mortgage_calculator':
      return <MortgageCalculator {...widget} />
    
    case 'widget_retirement_calculator':
      return <RetirementCalculator {...widget} />
    
    default:
      console.warn('[WidgetRenderer] Unknown widget type:', widget.type)
      return (
        <div className="rounded-lg border border-yellow-500/50 p-4 bg-yellow-500/10">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            Unknown widget type: {widget.type}
          </p>
        </div>
      )
  }
}

