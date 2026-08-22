/**
 * The three block payloads the astrology graph puts on the wire, and the
 * parsers that decide whether a block is renderable at all.
 *
 * Field-for-field sources (chatservice, read-only for this phase):
 *   natal_chart      graph.py `chart_data` (~:1819) + natal.py NatalChart/
 *                    PlanetPosition/HouseCusp/DashaPeriod
 *   match_report     matching.py `compute_gun_milan` return (~:492)
 *   muhurta_results  graph.py `widget_data` (~:4028) + models.py MuhurtaWindow
 *
 * PARSE, DON'T TRUST. Every parser returns `null` rather than a partial
 * object, and every host renders nothing for `null`. The negative-space rule
 * at the PH-3 gate is "an unparseable payload renders nothing — never raw JSON
 * to the user", and the astrology system prompt (prompts.py:27) says out loud
 * that a model occasionally emits a hallucinated ```kundli fence, so a
 * malformed block is a live case and not a hypothetical one.
 */

export interface NatalPlanet {
  planet: string;
  sign: string;
  /** null on a time-less chart: a house number IS an ascendant claim. */
  house: number | null;
  /** ABSOLUTE ecliptic longitude 0..360, not degrees within the sign. */
  degree: number | null;
  nakshatra: string | null;
  /** null on a time-less chart (a pada is 3°20' wide). */
  nakshatra_pada: number | null;
  retrograde: boolean;
  dignity: string | null;
}

export interface NatalHouse {
  house: number;
  sign: string;
  /** ABSOLUTE ecliptic longitude of the cusp. */
  degree: number | null;
  lord: string | null;
}

export interface NatalDashaPeriod {
  planet: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface NatalBirthData {
  date_of_birth?: string | null;
  time_of_birth?: string | null;
  time_known?: boolean;
  place_of_birth?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
}

export interface NatalChartPayload {
  type: 'natal_chart';
  /** null when `time_known` is false (ASTRAL-9). */
  ascendant: string | null;
  ascendant_degree: number | null;
  moon_sign: string | null;
  sun_sign: string | null;
  planets: NatalPlanet[];
  /** EMPTY when `time_known` is false. */
  houses: NatalHouse[];
  dasha_periods: NatalDashaPeriod[];
  yogas: string[];
  zodiac_mode: string | null;
  ayanamsa: string | null;
  house_system: string | null;
  time_known: boolean;
  moon_sign_alternatives: string[];
  moon_nakshatra_alternatives: string[];
  birth_data: NatalBirthData | null;
}

export interface MatchKoota {
  name: string;
  /** null when `pending` — the koota was NOT scored, it did not score zero. */
  points: number | null;
  max: number;
  note: string;
  meaning: string;
  time_dependent: boolean;
  pending: boolean;
  /** scored, but from an input the missing birth time leaves ambiguous. */
  provisional: boolean;
}

export interface MatchPerson {
  moon_rashi: string | null;
  nakshatra: string | null;
  manglik: boolean | null;
  time_known: boolean;
  moon_rashi_alternatives: string[];
  nakshatra_alternatives: string[];
}

export interface MatchDosha {
  name: string;
  detail: string;
  provisional: boolean;
}

export interface MatchReportPayload {
  type: 'match_report';
  groom: MatchPerson;
  bride: MatchPerson;
  kootas: MatchKoota[];
  time_known: boolean;
  /** null on a time-less match: there is no /36 to print (ASTRAL-12). */
  total: number | null;
  max_total: number | null;
  firm_total: number;
  firm_max: number;
  pending_max: number;
  pending_reasons: string[];
  /** the engine's own band. NEVER recomputed, NEVER replaced by a number. */
  verdict: string;
  doshas: MatchDosha[];
}

export interface MuhurtaWindow {
  start: string;
  end: string;
  score: number | null;
  lagna: string | null;
  lagna_lord: string | null;
  moon_sign: string | null;
  nakshatra: string | null;
  pada: number | null;
  tithi: string | null;
  yoga: string | null;
  karana: string | null;
  vara: string | null;
  rahu_kaal: boolean;
  benefics: string[];
  malefics: string[];
  naming_letter: string | null;
}

export interface MuhurtaResultsPayload {
  type: 'muhurta_results';
  location: string | null;
  date_range: string | null;
  total_evaluated: number | null;
  windows: MuhurtaWindow[];
}

export type AstralPayload =
  | NatalChartPayload
  | MatchReportPayload
  | MuhurtaResultsPayload;

// ── primitive coercions ────────────────────────────────────────────────────
// Each one answers "is this field usable" with a yes or a null. None of them
// substitutes a default: a substituted default is a claim the payload did not
// make, and on this artifact a fabricated 0 is a fabricated position.

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v : null;

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const bool = (v: unknown): boolean => v === true;

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];

// ── natal_chart ────────────────────────────────────────────────────────────

function parsePlanet(v: unknown): NatalPlanet | null {
  if (!isObj(v)) return null;
  const planet = str(v.planet);
  const sign = str(v.sign);
  if (!planet || !sign) return null;
  return {
    planet,
    sign,
    house: num(v.house),
    degree: num(v.degree),
    nakshatra: str(v.nakshatra),
    nakshatra_pada: num(v.nakshatra_pada),
    retrograde: bool(v.retrograde),
    dignity: str(v.dignity),
  };
}

function parseHouse(v: unknown): NatalHouse | null {
  if (!isObj(v)) return null;
  const house = num(v.house);
  const sign = str(v.sign);
  if (house === null || !sign) return null;
  return { house, sign, degree: num(v.degree), lord: str(v.lord) };
}

function parseDasha(v: unknown): NatalDashaPeriod | null {
  if (!isObj(v)) return null;
  const planet = str(v.planet);
  const start = str(v.start_date);
  const end = str(v.end_date);
  if (!planet || !start || !end) return null;
  return { planet, start_date: start, end_date: end, is_current: bool(v.is_current) };
}

export function parseNatalChart(value: unknown): NatalChartPayload | null {
  if (!isObj(value) || value.type !== 'natal_chart') return null;
  const planets = (Array.isArray(value.planets) ? value.planets : [])
    .map(parsePlanet)
    .filter((p): p is NatalPlanet => p !== null);
  // A chart with no usable graha is not a chart. Rendering an empty frame
  // beside a confident heading is the "reports success" failure mode.
  if (planets.length === 0) return null;

  const timeKnown = bool(value.time_known);
  const houses = (Array.isArray(value.houses) ? value.houses : [])
    .map(parseHouse)
    .filter((h): h is NatalHouse => h !== null);

  return {
    type: 'natal_chart',
    // INV-6 at the edge: on a time-less chart these are dropped HERE, so no
    // downstream component can render an ascendant even if a future backend
    // regression starts shipping one. The renderer cannot draw what the
    // parser refuses to carry.
    ascendant: timeKnown ? str(value.ascendant) : null,
    ascendant_degree: timeKnown ? num(value.ascendant_degree) : null,
    moon_sign: str(value.moon_sign),
    sun_sign: str(value.sun_sign),
    planets: timeKnown ? planets : planets.map((p) => ({ ...p, house: null, nakshatra_pada: null })),
    houses: timeKnown ? houses : [],
    dasha_periods: (Array.isArray(value.dasha_periods) ? value.dasha_periods : [])
      .map(parseDasha)
      .filter((d): d is NatalDashaPeriod => d !== null),
    yogas: strList(value.yogas),
    zodiac_mode: str(value.zodiac_mode),
    ayanamsa: str(value.ayanamsa),
    house_system: str(value.house_system),
    time_known: timeKnown,
    moon_sign_alternatives: strList(value.moon_sign_alternatives),
    moon_nakshatra_alternatives: strList(value.moon_nakshatra_alternatives),
    birth_data: isObj(value.birth_data)
      ? {
          date_of_birth: str(value.birth_data.date_of_birth),
          time_of_birth: str(value.birth_data.time_of_birth),
          time_known: bool(value.birth_data.time_known),
          place_of_birth: str(value.birth_data.place_of_birth),
          latitude: num(value.birth_data.latitude),
          longitude: num(value.birth_data.longitude),
          timezone: str(value.birth_data.timezone),
        }
      : null,
  };
}

// ── match_report ───────────────────────────────────────────────────────────

function parseKoota(v: unknown): MatchKoota | null {
  if (!isObj(v)) return null;
  const name = str(v.name);
  const max = num(v.max);
  if (!name || max === null) return null;
  return {
    name,
    points: num(v.points),
    max,
    note: str(v.note) ?? '',
    meaning: str(v.meaning) ?? '',
    time_dependent: bool(v.time_dependent),
    pending: bool(v.pending),
    provisional: bool(v.provisional),
  };
}

function parsePerson(v: unknown): MatchPerson {
  const o = isObj(v) ? v : {};
  return {
    moon_rashi: str(o.moon_rashi),
    nakshatra: str(o.nakshatra),
    manglik: typeof o.manglik === 'boolean' ? o.manglik : null,
    time_known: bool(o.time_known),
    moon_rashi_alternatives: strList(o.moon_rashi_alternatives),
    nakshatra_alternatives: strList(o.nakshatra_alternatives),
  };
}

export function parseMatchReport(value: unknown): MatchReportPayload | null {
  if (!isObj(value) || value.type !== 'match_report') return null;
  const kootas = (Array.isArray(value.kootas) ? value.kootas : [])
    .map(parseKoota)
    .filter((k): k is MatchKoota => k !== null);
  if (kootas.length === 0) return null;
  const verdict = str(value.verdict);
  const firmTotal = num(value.firm_total);
  const firmMax = num(value.firm_max);
  // The band is the engine's, always. A scorecard with no verdict has nothing
  // honest to put in the ring, so it is not rendered at all rather than
  // labelled by the client (INV-5 / ASTRAL-16).
  if (!verdict || firmTotal === null || firmMax === null) return null;

  return {
    type: 'match_report',
    groom: parsePerson(value.groom),
    bride: parsePerson(value.bride),
    kootas,
    time_known: bool(value.time_known),
    total: num(value.total),
    max_total: num(value.max_total),
    firm_total: firmTotal,
    firm_max: firmMax,
    pending_max: num(value.pending_max) ?? 0,
    pending_reasons: strList(value.pending_reasons),
    verdict,
    doshas: (Array.isArray(value.doshas) ? value.doshas : [])
      .map((d): MatchDosha | null => {
        if (!isObj(d)) return null;
        const name = str(d.name);
        if (!name) return null;
        return { name, detail: str(d.detail) ?? '', provisional: bool(d.provisional) };
      })
      .filter((d): d is MatchDosha => d !== null),
  };
}

// ── muhurta_results ────────────────────────────────────────────────────────

function parseWindow(v: unknown): MuhurtaWindow | null {
  if (!isObj(v)) return null;
  const start = str(v.start);
  const end = str(v.end);
  if (!start || !end) return null;
  return {
    start,
    end,
    score: num(v.score),
    lagna: str(v.lagna),
    lagna_lord: str(v.lagna_lord),
    moon_sign: str(v.moon_sign),
    nakshatra: str(v.nakshatra),
    pada: num(v.pada),
    tithi: str(v.tithi),
    yoga: str(v.yoga),
    karana: str(v.karana),
    vara: str(v.vara),
    rahu_kaal: bool(v.rahu_kaal),
    benefics: strList(v.benefics),
    malefics: strList(v.malefics),
    naming_letter: str(v.naming_letter),
  };
}

export function parseMuhurtaResults(value: unknown): MuhurtaResultsPayload | null {
  if (!isObj(value) || value.type !== 'muhurta_results') return null;
  const windows = (Array.isArray(value.windows) ? value.windows : [])
    .map(parseWindow)
    .filter((w): w is MuhurtaWindow => w !== null);
  if (windows.length === 0) return null;
  return {
    type: 'muhurta_results',
    location: str(value.location),
    date_range: str(value.date_range),
    total_evaluated: num(value.total_evaluated),
    windows,
  };
}
