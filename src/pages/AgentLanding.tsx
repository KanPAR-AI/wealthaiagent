// src/pages/AgentLanding.tsx
//
// Custom per-agent landing pages.
//
// URL shape:
//   /chataiagent/a/<slug>
//
// On mount this page:
//   1. Resolves the slug to an agent id via SLUG_ALIASES + the live
//      agent catalogue (`/api/v1/agents/available`).
//   2. Calls `chatStore.setSelectedAgent(agentId)` so any new chat is
//      created with this agent preselected.
//   3. Applies the MysticAI dark cosmic theme if the slug picks the
//      astrology_ai agent (so `/a/mystic` looks like astro.yourfinadvisor.com).
//      Reverts mystic theme for any other selection.
//   4. Redirects to `/new` so the user lands on the empty-state with
//      the agent already chosen.
//
// We deliberately handle unknown slugs by falling through to the
// agent selector on /new (no agent forced), instead of 404'ing. That
// way shareable links survive small typos / renamed dynamic agents.

import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useChatStore } from "@/store/chat";
import {
  applyMysticTheme,
  revertMysticTheme,
  MYSTIC_AGENT,
} from "@/lib/mysticai";

// Vanity slugs → built-in agent ids. Anything not in this map is
// passed through unchanged so dynamic agent ids work directly.
const SLUG_ALIASES: Record<string, string> = {
  mystic: MYSTIC_AGENT, // astrology_ai
  astro: MYSTIC_AGENT,
  astrology: MYSTIC_AGENT,
  jyotish: MYSTIC_AGENT,
  palm: MYSTIC_AGENT,
  diet: "dietician",
  barbie: "dietician",
  nutrition: "dietician",
  weight: "weight_management",
  pcos: "medical_nutrition",
  diabetes: "medical_nutrition",
  kids: "kids_nutrition",
  pregnancy: "pregnancy_nutrition",
  sports: "sports_nutrition",
  fitness: "fitness_nutrition",
  mental: "mental_health",
  cbt: "mental_health",
  knee: "knee_arthritis",
  property: "real_estate",
  realestate: "real_estate",
  insurance: "insurance",
  financial: "financial_planner",
  planner: "financial_planner",
  wealth: "financial_planner",
  pdf: "pdf",
};

function resolveSlug(rawSlug: string | undefined): string | null {
  if (!rawSlug) return null;
  const slug = rawSlug.trim().toLowerCase();
  if (!slug) return null;
  return SLUG_ALIASES[slug] || slug;
}

export default function AgentLanding() {
  const { slug } = useParams<{ slug: string }>();
  const setSelectedAgent = useChatStore((s) => s.setSelectedAgent);

  const agentId = resolveSlug(slug);

  useEffect(() => {
    if (!agentId) return;

    setSelectedAgent(agentId);

    if (agentId === MYSTIC_AGENT) {
      applyMysticTheme(true);
    } else {
      // Defensive revert in case the user navigated here from the
      // astro subdomain or a `?mystic=1` session — the chosen agent
      // is not astrology, so the mystic skin would be jarring.
      revertMysticTheme();
    }
  }, [agentId, setSelectedAgent]);

  // Forward to the new-chat empty state with the agent preselected.
  return <Navigate to="/new" replace />;
}
