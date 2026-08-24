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
  EditImpact,
  MatchesResponse,
  PeopleResponse,
  PersonView,
  SelfResponse,
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
