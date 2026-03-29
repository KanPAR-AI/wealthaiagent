/** AdvisorPanel — V3 goal graph visualization + proposal cards.
 *
 * Shows:
 * 1. Goal tree grouped by tier (need > protect > want) with completion bars
 * 2. Feasibility summary from goal graph computation
 * 3. Advisor proposals with accept/reject buttons
 */
import { useState } from 'react'
import type { AdvisorPayload, GoalNode, Proposal, FeasibilityStatus } from './types'

interface AdvisorPanelProps {
  data: AdvisorPayload
  isHistory?: boolean
}

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  need: { label: 'Needs', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
  protect: { label: 'Protect', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  want: { label: 'Wants', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  green: { label: 'Feasible', cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  yellow: { label: 'Tight', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  red: { label: 'Gap', cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
}

function formatINR(n: number): string {
  if (Math.abs(n) >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`
  if (Math.abs(n) >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

function GoalRow({ node }: { node: GoalNode }) {
  const pct = Math.round((node.completion_pct ?? 0) * 100)
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{node.label}</span>
          {node.negotiable && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">adjustable</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs text-gray-500">SIP needed</div>
        <div className="text-sm font-medium">{formatINR(node.monthly_sip_needed ?? 0)}/mo</div>
      </div>
      <div className="text-right shrink-0 w-16">
        <div className="text-xs text-gray-500">Target</div>
        <div className="text-sm font-medium">{formatINR(node.target ?? 0)}</div>
      </div>
    </div>
  )
}

function ProposalCard({ proposal, onAction, disabled }: {
  proposal: Proposal
  onAction: (id: string, action: 'accept' | 'reject') => void
  disabled: boolean
}) {
  const impactStr = proposal.impact_monthly_sip < 0
    ? `Saves ${formatINR(Math.abs(proposal.impact_monthly_sip))}/mo`
    : proposal.impact_monthly_sip > 0
      ? `Costs ${formatINR(proposal.impact_monthly_sip)}/mo more`
      : ''

  const feasBadge = proposal.feasibility_after
    ? STATUS_BADGE[proposal.feasibility_after as FeasibilityStatus]
    : null

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">{proposal.label}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{proposal.description}</p>
        </div>
        {feasBadge && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${feasBadge.cls}`}>
            {feasBadge.label}
          </span>
        )}
      </div>
      {impactStr && (
        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{impactStr}</p>
      )}
      {!disabled && proposal.status === 'proposed' && (
        <div className="flex gap-2 pt-1">
          <button
            className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            onClick={() => onAction(proposal.id, 'accept')}
          >
            Accept
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => onAction(proposal.id, 'reject')}
          >
            Not for me
          </button>
        </div>
      )}
      {proposal.status === 'accepted' && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Applied</span>
      )}
      {proposal.status === 'rejected' && (
        <span className="text-xs text-gray-400">Dismissed</span>
      )}
    </div>
  )
}

export function AdvisorPanel({ data, isHistory }: AdvisorPanelProps) {
  const [expandedTier, setExpandedTier] = useState<string | null>('need')
  const goalComp = data.goal_computation ?? data.financial_state?.goals ?? { nodes: [] }
  const summary = goalComp.summary
  const nodes = goalComp.nodes ?? []
  const proposals = data.proposals ?? []

  const handleProposalAction = (proposalId: string, action: 'accept' | 'reject') => {
    const proposal = proposals.find(p => p.id === proposalId)
    if (!proposal) return

    const msg = action === 'accept'
      ? `Accept proposal: ${proposal.label}`
      : `Reject proposal: ${proposal.label}`

    window.dispatchEvent(new CustomEvent('chat-quick-reply', { detail: { text: msg } }))
  }

  // Group nodes by tier
  const tiers = ['need', 'protect', 'want']
  const grouped = tiers.map(tier => ({
    tier,
    config: TIER_CONFIG[tier],
    nodes: nodes.filter((n: GoalNode) => n.tier === tier),
    totalSip: nodes.filter((n: GoalNode) => n.tier === tier).reduce((s: number, n: GoalNode) => s + (n.monthly_sip_needed ?? 0), 0),
  })).filter(g => g.nodes.length > 0)

  const statusBadge = summary?.status ? STATUS_BADGE[summary.status as FeasibilityStatus] : null

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Financial Advisor</h3>
        {statusBadge && (
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
        )}
      </div>

      {/* Summary bar */}
      {summary && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 flex gap-6 text-xs">
          <div>
            <span className="text-gray-500">Total SIP</span>
            <span className="ml-1 font-semibold">{formatINR(summary.total_monthly_sip)}/mo</span>
          </div>
          <div>
            <span className="text-gray-500">Savings</span>
            <span className="ml-1 font-semibold">{formatINR(summary.monthly_savings)}/mo</span>
          </div>
          {summary.gap > 0 && (
            <div>
              <span className="text-gray-500">Gap</span>
              <span className="ml-1 font-semibold text-red-600 dark:text-red-400">{formatINR(summary.gap)}/mo</span>
            </div>
          )}
        </div>
      )}

      {/* Goal tree by tier */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {grouped.map(({ tier, config, nodes: tierNodes, totalSip }) => (
          <div key={tier}>
            <button
              className={`w-full px-4 py-2.5 flex items-center justify-between ${config.bg} hover:opacity-90 transition-opacity`}
              onClick={() => setExpandedTier(expandedTier === tier ? null : tier)}
            >
              <span className={`text-xs font-semibold uppercase tracking-wider ${config.color}`}>
                {config.label} ({tierNodes.length})
              </span>
              <span className="text-xs text-gray-500">{formatINR(totalSip)}/mo</span>
            </button>
            {expandedTier === tier && (
              <div className="px-4 pb-2 divide-y divide-gray-50 dark:divide-gray-800/50">
                {tierNodes.map((node: GoalNode) => (
                  <GoalRow key={node.id} node={node} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Proposals */}
      {proposals.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Suggestions</h4>
          {proposals.map((p: Proposal) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              onAction={handleProposalAction}
              disabled={!!isHistory}
            />
          ))}
        </div>
      )}
    </div>
  )
}
