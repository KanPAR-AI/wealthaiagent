// The People API client (docs/49 ASTRAL-135, S18/S19).
//
// ONE module talks to `/people`, for the same reason `lib/credits.ts` is the
// only module that talks to `/credits`: a screen that fetches is a screen
// that owns a URL, a token header and an error shape, and three screens
// doing that is three places for the auth header to drift.
//
// ── what this client is NOT allowed to become ─────────────────────────────
//
// There is no `saveBirthDetails`, no `POST /people` and no `PATCH` that
// carries a date. The server has no such route and must not grow one (F24):
// birth facts reach state through the `input_request` → `input_response`
// carrier into `reconcile`, which is the only fact-writer (INV-1). What this
// file may write is what a person is CALLED and whether they are starred —
// owner-authored labels, never facts.
//
// ── reads never compute ───────────────────────────────────────────────────
//
// Opening Profile or Matches costs no ephemeris second, no model call and no
// credit (ASTRAL-135). There is deliberately no `recomputeChart()` here: no
// such endpoint exists, and a stale chart is RENDERED stale with the date it
// was cast rather than quietly refreshed (AMB-31, interim (a)).


// The shapes live next door (see `people-shapes.ts` for why) and are
// re-exported here so a screen has one import for the whole surface.
export * from './people-shapes';

import type {
  ChartResponse,
  DailyResponse,
  EditImpact,
  MatchDetail,
  MatchesResponse,
  PeopleResponse,
  PersonView,
  PrioritiesResponse,
  SelfResponse,
  TimelineResponse,
} from './people-shapes';
import { getToken } from './auth';
import { apiUrl } from './core-adapter';

// ── transport ─────────────────────────────────────────────────────────────

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : null),
      ...(init?.headers ?? null),
    },
  });
  if (!res.ok) {
    // Named and thrown, never swallowed into an empty list: "you have no
    // people" and "the read failed" are different sentences and the screens
    // below say the right one because this throws.
    throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function fetchPeople(): Promise<PeopleResponse> {
  return call<PeopleResponse>('people');
}

export function fetchSelf(): Promise<SelfResponse> {
  return call<SelfResponse>('people/self');
}

export function fetchMatches(): Promise<MatchesResponse> {
  return call<MatchesResponse>('people/matches');
}

/**
 * Screens 3 and 8 read THIS — one dated artifact with its four facets
 * (docs/49 ASTRAL-125/126).
 *
 * It takes no arguments and must not grow any. The day is the person's own
 * local day, decided server-side from their chart's timezone: a client that
 * could pass a date could ask for yesterday's card, which is the single
 * request the whole N1 artifact exists to refuse.
 *
 * ONE call serves both screens. Daily Guidance's four tabs are a filter over
 * `facets` in the response the app already holds — so switching a tab makes
 * no request, which is a property of this signature rather than of a
 * screen's good behaviour.
 */
export function fetchDaily(): Promise<DailyResponse> {
  return call<DailyResponse>('people/self/daily');
}

/**
 * Screen 9 (docs/49 ASTRAL-127). The WHOLE computed set arrives once, with
 * the years it covers — the board's year pills filter what is already here
 * and never ask the server for a year (ASTRAL-52).
 */
export function fetchTimeline(): Promise<TimelineResponse> {
  return call<TimelineResponse>('people/self/timeline');
}

/**
 * The priority set, the vocabulary it is drawn from, and the chart-derived
 * proposals (docs/49 ASTRAL-152/154/158).
 *
 * A READ, and there is deliberately no `savePriorities()` beside it. The
 * server has no such route and must not grow one: a priority is an engine
 * input that reorders what the user reads, and engine inputs reach state
 * through the `input_request` carrier into `reconcile` (F24, INV-1) — which
 * is what `edit_turn` and `app/preferences.tsx` are for.
 */
export function fetchPriorities(): Promise<PrioritiesResponse> {
  return call<PrioritiesResponse>('people/priorities');
}

/**
 * THE CHART (docs/49 PH-27 · ASTRAL-229).
 *
 * The read that made screen 5 possible. Before it, the only place a full
 * chart existed outside the engine was inside a chat turn — so "show me my
 * chart" was a conversation, which is the whole of the owner's complaint.
 *
 * It computes nothing: no ephemeris second, no model call, no credit, and a
 * stale chart comes back STALE with the date it was cast and which cause
 * made it stale (ASTRAL-135/238). There is deliberately no `recomputeChart()`
 * beside it — no such endpoint exists, and a control that cannot do anything
 * is the dead affordance ASTRAL-102 forbids.
 */
export function fetchChart(personId: string): Promise<ChartResponse> {
  return call<ChartResponse>(`people/${encodeURIComponent(personId)}/chart`);
}

/**
 * ONE saved match, whole (docs/49 PH-27 · ASTRAL-232).
 *
 * Every koota with its points, the pending ones with their reasons, the
 * doshas and the firm/pending split — the stored artifact, served as the
 * `match_report` payload the shipped scorecard already renders. "Why is Nadi
 * zero" stops being a question that costs a model call.
 */
export function fetchMatch(pairKey: string): Promise<MatchDetail> {
  return call<MatchDetail>(`people/matches/${encodeURIComponent(pairKey)}`);
}

export function fetchEditImpact(personId: string, field: string): Promise<EditImpact> {
  return call<EditImpact>(`people/${encodeURIComponent(personId)}/edit-impact?field=${encodeURIComponent(field)}`);
}

/** Labels only: what a person is CALLED and whether they are starred.
 *  `invalidated` comes back empty by construction — the list joins artifact
 *  to person at render (ASTRAL-141), so a rename recomputes nothing. */
export function patchLabels(
  personId: string,
  patch: { display_name?: string; favourite?: boolean; notes?: string },
): Promise<{ person: PersonView; invalidated: string[] }> {
  return call(`people/${encodeURIComponent(personId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/** ASTRAL-36's cascade. `self` is refused by the server, not hidden here. */
export function deletePerson(personId: string): Promise<{
  person_id: string;
  matches_deleted: string[];
  chart_deleted: boolean;
}> {
  return call(`people/${encodeURIComponent(personId)}`, { method: 'DELETE' });
}


import { nameToAdopt } from './people-shapes';
export { nameToAdopt };

export async function adoptAccountNameIfUnnamed(
  self: SelfResponse,
  accountName: string | null | undefined,
): Promise<string | null> {
  const adopt = nameToAdopt(
    self.person?.display_name,
    self.state === 'established',
    accountName,
  );
  if (!adopt || !self.person) return null;
  try {
    await patchLabels(self.person.id, { display_name: adopt });
    return adopt;
  } catch {
    return null; // a greeting is never worth a failed screen
  }
}
