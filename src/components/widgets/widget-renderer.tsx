import { PieChartWidget } from "./pie-chart-widget"
import { BarChartWidget } from "./bar-chart-widget"
import { TableWidget } from "./table-widget"
import { LineChartWidget } from "./line-chart-widget"
import { CompoundInterestCalculator } from "./compound-interest-calculator"
import { SIPCalculator } from "./sip-calculator"
import { MortgageCalculator } from "./mortgage-calculator"
import { RetirementCalculator } from "./retirement-calculator"
import { FinancialSummaryChart } from "./financial-summary-chart"
import { ActionTilesWidget } from "./action-tiles-widget"
import { MultiSelectWidget } from "./multi-select-widget"
import { OnboardingFormWidget } from "./onboarding-form-widget"
import { CuisineProportionWidget } from "./cuisine-proportion-widget"
import { SpecialistPickerWidget } from "./specialist-picker-widget"
import { OnboardingProfile } from "./financial-planner/onboarding-profile"
import { GoalPicker } from "./financial-planner/goal-picker"
import { GoalDetailCard } from "./financial-planner/goal-detail-card"
import { Playground } from "./financial-planner/playground"
import { PlanSummary } from "./financial-planner/plan-summary"
import { PrescriptivePlan } from "./financial-planner/prescriptive-plan"
import { ScenarioComparison } from "./financial-planner/scenario-comparison"
import { ProfileReview } from "./financial-planner/profile-review"
import { AdvisorPanel } from "./financial-planner/advisor-panel"

export interface Widget {
  id: string
  type: string
  title?: string
  description?: string
  data: any
  config?: any
  sourceUrl?: string
}

interface WidgetRendererProps {
  widget: Widget
  isHistory?: boolean
}

export function WidgetRenderer({ widget, isHistory }: WidgetRendererProps) {
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

    case 'widget_composed_chart':
      return <FinancialSummaryChart {...widget} />

    case 'widget_action_tiles':
      return <ActionTilesWidget {...widget} isHistory={isHistory} />

    case 'widget_multi_select':
      return <MultiSelectWidget {...widget} isHistory={isHistory} />

    case 'widget_onboarding_form':
      return <OnboardingFormWidget {...widget} isHistory={isHistory} />

    case 'widget_cuisine_proportions':
      return <CuisineProportionWidget {...widget} isHistory={isHistory} />

    case 'widget_specialist_picker':
      return <SpecialistPickerWidget {...widget} isHistory={isHistory} />

    case 'widget_financial_onboarding':
      return <OnboardingProfile data={widget.data ?? widget} isHistory={isHistory} />

    case 'widget_financial_goals':
      return <GoalPicker data={widget.data ?? widget} isHistory={isHistory} />

    case 'widget_financial_goal_detail':
      return <GoalDetailCard data={widget.data ?? widget} isHistory={isHistory} />

    case 'widget_financial_playground':
      return <Playground data={widget.data ?? widget} isHistory={isHistory} />

    case 'widget_financial_summary':
      return <PlanSummary data={widget.data ?? widget} isHistory={isHistory} />

    case 'widget_financial_prescriptive_plan':
      return <PrescriptivePlan data={widget.data ?? widget} isHistory={isHistory} />

    case 'widget_financial_scenario_comparison':
      return <ScenarioComparison data={widget.data ?? widget} isHistory={isHistory} />

    case 'widget_financial_profile_review':
      return <ProfileReview data={widget.data ?? widget} isHistory={isHistory} />

    case 'widget_financial_advisor':
      return <AdvisorPanel data={widget.data ?? widget} isHistory={isHistory} />

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

