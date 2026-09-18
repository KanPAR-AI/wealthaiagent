// "This reading is getting long" — when to suggest a fresh chat.
//
// Owner, 2026-09-18: "if one chat has mixed context and it grows beyond 30
// messages suggest user to open new chat". A long conversation that has
// wandered across a chart, a match, a muhurta and a palm gives the engine a
// muddier context and the user slower, vaguer answers; a fresh reading costs
// one tap and the old one stays saved.
//
// Pure. This is conversation hygiene, not astrology — nothing here is derived
// from a chart. "Mixed" is read off the typed blocks the ENGINE put in its own
// replies (a chart card, a match report, muhurta results…) and off a change of
// reading subject; the count is simply how many bubbles are on screen.
export const NUDGE_AFTER = 30;
/** After "Keep going", stay quiet until this many more messages have passed. */
export const NUDGE_AGAIN_EVERY = 20;

const TOPIC_BLOCKS: Record<string, string> = {
  natal_chart: 'chart',
  life_timeline: 'timeline',
  match_report: 'match',
  muhurta_results: 'muhurta',
  palm_analysis: 'palm',
  palm_predictions: 'palm',
  best_days: 'timing',
};

export interface NudgeMessage {
  sender: string;
  message?: string | null;
}

export interface ChatNudge {
  reason: 'mixed' | 'long';
  count: number;
  topics: string[];
  title: string;
  body: string;
}

/** The distinct topics and reading subjects the engine's replies carried. */
export function topicsIn(messages: readonly NudgeMessage[]): string[] {
  const topics = new Set<string>();
  const subjects = new Set<string>();
  for (const m of messages) {
    if (m.sender === 'user') continue;
    const text = m.message ?? '';
    for (const match of text.matchAll(/```([a-z_]+)\n/g)) {
      const topic = TOPIC_BLOCKS[match[1]];
      if (topic) topics.add(topic);
    }
    for (const s of text.matchAll(/```reading_subject\n(\{.*?\})\n```/gs)) {
      try {
        const v = JSON.parse(s[1]) as { mode?: string; person_id?: string | null };
        subjects.add(`${v.mode ?? 'self'}:${v.person_id ?? ''}`);
      } catch { /* a malformed block is not a subject */ }
    }
  }
  if (subjects.size > 1) topics.add('people');
  return [...topics].sort();
}

/**
 * The nudge to show, or null. `dismissedAt` is the message count at which the
 * user last said "Keep going" in THIS chat (null = never).
 */
export function chatNudge(
  messages: readonly NudgeMessage[], dismissedAt: number | null,
  /** the server's total for this chat, when known: a resumed chat loads only
   *  its latest page, so the bubbles in hand undercount a long conversation */
  totalCount: number | null = null,
): ChatNudge | null {
  const count = Math.max(messages.length, totalCount ?? 0);
  if (count <= NUDGE_AFTER) return null;
  if (dismissedAt !== null && count < dismissedAt + NUDGE_AGAIN_EVERY) return null;
  const topics = topicsIn(messages);
  const mixed = topics.length >= 2;
  return {
    reason: mixed ? 'mixed' : 'long',
    count,
    topics,
    title: mixed ? 'This reading has covered a lot' : 'This reading is getting long',
    body: mixed
      ? 'Several topics are mixed in one conversation now. A fresh reading keeps each answer sharp. This one stays saved.'
      : 'A fresh reading keeps answers quick and focused. This one stays saved.',
  };
}
