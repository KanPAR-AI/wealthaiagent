/**
 * The four block payloads the astrology graph puts on the wire, and the
 * parsers that decide whether a block is renderable at all.
 *
 * Field-for-field sources (chatservice, read-only for this phase):
 *   natal_chart      graph.py `chart_data` (~:1819) + natal.py NatalChart/
 *                    PlanetPosition/HouseCusp/DashaPeriod
 *   match_report     matching.py `compute_gun_milan` return (~:492)
 *   muhurta_results  graph.py `widget_data` (~:4028) + models.py MuhurtaWindow
 *   palm_analysis    graph.py `widget_data` (~:5026) = combine_hand_analyses
 *                    + palm.reading_headline + palm_rules.classical_rules
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
  /**
   * The degree WITHIN the sign, 0..30 — the number a reader means when they
   * say "degree", and the only one that may be shown beside a sign name.
   * Null on a chart cast before the engine carried it (natal_chart v3 and
   * earlier); show no degree at all in that case, never `degree`.
   */
  sign_degree: number | null;
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
  /** The cusp's degree within its sign, 0..30. Null on a pre-v4 chart. */
  sign_degree: number | null;
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

/**
 * One graha in one CALCULATED chart (docs/49 ASTRAL-173/230).
 *
 * `sign` and `rashi_number` are the ENGINE's labels, on the wire since
 * natal_chart v7. They exist so that no renderer ever indexes a SIGNS table
 * or writes `sign_index + 1` — the one derivation a chart surface reaches
 * for, and the one the ASTRAL-19/183 greps did not catch (F83).
 */
export interface ChartPlacement {
  body: string;
  /** Aries = 0. Carried for identity; the LABELS above are what is drawn. */
  sign_index: number;
  /** whole-sign house counted from THIS chart's own ascendant */
  house: number;
  sign: string;
  /** Aries = 1 … Pisces = 12 — the convention the PDF prints (AMB-36(a)) */
  rashi_number: number;
}

/** One cell of a drawn diamond — the twelve the engine hands over, in house
 *  order. Built by `natal.divisional_chart_cells`, the same function the
 *  Kundli PDF prints from, so the two surfaces cannot disagree. */
export interface ChartCell {
  house: number;
  rashi_number: number;
  rashi: string;
  /** graha abbreviations, plus `As` in the first house */
  tokens: string[];
}

/**
 * A calculated chart: D1 (Lagna/Rashi), MOON (Chandra Lagna) or D9 (Navamsa).
 *
 * Three keys and no more — no fourth varga is computed on any path, and the
 * engine's grounding check (p) treats a claim about one as a violation. A
 * model whose key is not one of the three is DROPPED at the parser rather
 * than drawn under a heading nobody computed.
 */
export interface DivisionalChart {
  key: 'D1' | 'MOON' | 'D9';
  /** the engine's own title, rendered verbatim (ASTRAL-187) */
  title: string;
  ascendant_sign_index: number;
  ascendant_sign: string;
  ascendant_rashi_number: number;
  placements: ChartPlacement[];
  /** present on the chart READ; absent on the chat block */
  cells: ChartCell[] | null;
}

export interface NatalChartPayload {
  type: 'natal_chart';
  /** null when `time_known` is false (ASTRAL-9). */
  ascendant: string | null;
  ascendant_degree: number | null;
  /** The ascendant's degree within its sign, 0..30. Null on a pre-v4 chart. */
  ascendant_sign_degree: number | null;
  moon_sign: string | null;
  sun_sign: string | null;
  planets: NatalPlanet[];
  /** EMPTY when `time_known` is false. */
  houses: NatalHouse[];
  dasha_periods: NatalDashaPeriod[];
  yogas: string[];
  /**
   * D1 · MOON · D9, as CALCULATED models (docs/49 ASTRAL-173).
   *
   * EMPTY when `time_known` is false, dropped at the parser: a divisional
   * chart is a rotation of the lagna, so a backend regression that started
   * shipping one on a time-less chart still could not be drawn (INV-6 at
   * the edge, the same rule `houses` already follows).
   */
  divisional_charts: DivisionalChart[];
  zodiac_mode: string | null;
  ayanamsa: string | null;
  house_system: string | null;
  /** "mean" | "true", as actually resolved. Rahu moves ~1 degree between
   *  the two, which at a boundary moves a rashi — so a chart that cannot
   *  say which it used cannot be reproduced (ASTRAL-167/237). */
  node_model: string | null;
  /** e.g. "kerykeion/5.12.9" (ASTRAL-168/237) */
  engine_version: string | null;
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
  /**
   * docs/49 ASTRAL-148/149/150 — the emphasis, and it is a SIBLING of the
   * artifact rather than part of it.
   *
   * Present only when the user has set partner priorities. It carries an
   * ORDER, a rule sentence and the stated absences — and it carries no
   * points, no total and no band, because a priority may not reach one. Every
   * number above is byte-identical with and without it.
   */
  emphasis?: MatchEmphasis;
}

export interface MatchEmphasis {
  /** every koota name, prioritised ones first — a display order, nothing more */
  koota_order: string[];
  /** the prioritised kootas that this report actually has */
  leading: string[];
  /** "Ordered by Nadi, then Gana" — generated by the engine from its mapping */
  rule: string;
  /** deterministic ENGINE text; never model prose */
  lines: string[];
  /** ASTRAL-148: what gun milan does not score, said plainly */
  unscored: { key: string; sentence: string }[];
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

// ── palm_analysis ──────────────────────────────────────────────────────────
//
// Source: `graph.py` `widget_data` (~:5026) — `combine_hand_analyses(...)`
// spread whole, plus `hand_label` from `palm.reading_headline`, plus the
// image reference. The analysis itself is `palm.py`'s two-pass vision output
// with `palm_rules.classical_rules_payload` attached at `palm.py:661`.
//
// This is the ONE payload in this file whose numbers come from a model rather
// than from an ephemeris, and the shape reflects that: every reading carries
// how its hand was established, because `adjudication.py:57` discounts a
// model-guessed hand by 0.65 and a reader who cannot see that is reading a
// weaker claim than they think they are.

export interface PalmLine {
  /** "Heart Line", "Jeevan Rekha" — the engine's own name, rendered verbatim */
  name: string;
  description: string | null;
  interpretation: string | null;
  /** 0..1 as the vision pass emitted it. NEVER a percentage (ASTRAL-19). */
  confidence: number | null;
}

export interface PalmMount {
  name: string;
  /** "flat" | "moderate" | "prominent" — the engine's vocabulary, not ours */
  prominence: string | null;
  interpretation: string | null;
}

/**
 * One classical rule that FIRED, with the citation that licenses it
 * (`palm_rules.py:582`). The citation is the point: a palmistry claim with a
 * page number behind it is a different object from one a model wrote.
 */
export interface PalmClassicalRule {
  rule_id: string;
  claim: string;
  /** "career", "marriage_family", "character", … — the engine's domain key */
  domain: string | null;
  /** "favorable" | "unfavorable" | … — verbatim */
  polarity: string | null;
  /** "major_line" | "mount" | "mark" — how much weight the rule carries */
  strength: string | null;
  citation: string;
  /** the derived features that matched, e.g. `mount:jupiter=prominent` */
  matched: string[];
}

export interface PalmClassicalRules {
  /** the edition the rules were read out of, printed as given */
  source: string | null;
  fired: PalmClassicalRule[];
  /** how many rules had no opinion on this hand — the honesty margin */
  abstained_count: number | null;
  /** how many matches policy withheld */
  suppressed_matches: number | null;
}

/** One hand of a two-hand reading, as `combine_hand_analyses` files it. */
export interface PalmHand {
  /** "left" | "right" | "unknown" — IDENTITY only. Never a heading: use
   *  `hand_label`, which is the only string licensed to name a hand. */
  hand: string | null;
  /** "dominant" | "non_dominant" | null */
  hand_role: string | null;
  hand_shape: string | null;
  overall_reading: string | null;
  confidence_score: number | null;
  lines: PalmLine[];
  mounts: PalmMount[];
  special_markings: string[];
}

export interface PalmAnalysisPayload {
  type: 'palm_analysis';
  /**
   * The heading, computed by the engine in the one place that knows how the
   * side was obtained (`palm.reading_headline`, stamped at `graph.py:5025`).
   *
   * A client that titles a reading off the raw `hand` field prints "Left
   * hand" for a reading whose side was never established — which is exactly
   * what the shipped mobile palm card did, and exactly what was reported.
   * So `hand` is carried above for identity and this is what is DRAWN.
   */
  hand_label: string | null;
  hand: string | null;
  hand_role: string | null;
  /** "declared" | "thumb_geometry" | "thumb_geometry_unverified" |
   *  "model_guess" — the exit contract stamps one of these (GR-12a). */
  hand_source: string | null;
  hand_shape: string | null;
  dominant_element: string | null;
  /** true when two hands were filed as a PAIR rather than as a re-shoot */
  both_hands: boolean;
  hands: PalmHand[];
  lines: PalmLine[];
  mounts: PalmMount[];
  special_markings: string[];
  /** the 1-3 sentence answer to a question the user actually asked, or null */
  direct_answer: string | null;
  overall_reading: string | null;
  confidence_score: number | null;
  classical_rules: PalmClassicalRules | null;
  /** the analysed photo, for a host that can fetch an authorised file */
  image_file_id: string | null;
  image_url: string | null;
}

export type AstralPayload =
  | NatalChartPayload
  | MatchReportPayload
  | MuhurtaResultsPayload
  | PalmAnalysisPayload;

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
    sign_degree: num(v.sign_degree),
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
  return {
    house, sign, degree: num(v.degree),
    sign_degree: num(v.sign_degree), lord: str(v.lord),
  };
}

function parseDasha(v: unknown): NatalDashaPeriod | null {
  if (!isObj(v)) return null;
  const planet = str(v.planet);
  const start = str(v.start_date);
  const end = str(v.end_date);
  if (!planet || !start || !end) return null;
  return { planet, start_date: start, end_date: end, is_current: bool(v.is_current) };
}

function parsePlacement(v: unknown): ChartPlacement | null {
  if (!isObj(v)) return null;
  const body = str(v.body);
  const signIndex = num(v.sign_index);
  const house = num(v.house);
  const sign = str(v.sign);
  const rashi = num(v.rashi_number);
  // Every field or nothing. A placement missing its label cannot be drawn
  // and must not be completed here: `sign_index + 1` in this file would be
  // the exact derivation ASTRAL-230 moved into the engine.
  if (!body || signIndex === null || !Number.isInteger(signIndex)
      || house === null || !sign || rashi === null) {
    return null;
  }
  return { body, sign_index: signIndex, house, sign, rashi_number: rashi };
}

function parseCell(v: unknown): ChartCell | null {
  if (!isObj(v)) return null;
  const house = num(v.house);
  const rashiNumber = num(v.rashi_number);
  const rashi = str(v.rashi);
  if (house === null || rashiNumber === null || !rashi) return null;
  return { house, rashi_number: rashiNumber, rashi, tokens: strList(v.tokens) };
}

const DIVISIONAL_KEYS = ['D1', 'MOON', 'D9'] as const;

function parseDivisional(v: unknown): DivisionalChart | null {
  if (!isObj(v)) return null;
  const key = str(v.key);
  const title = str(v.title);
  const ascIndex = num(v.ascendant_sign_index);
  const ascSign = str(v.ascendant_sign);
  const ascRashi = num(v.ascendant_rashi_number);
  if (!key || !(DIVISIONAL_KEYS as readonly string[]).includes(key)) return null;
  if (!title || ascIndex === null || !ascSign || ascRashi === null) return null;
  if (!Array.isArray(v.placements)) return null;
  const placements = v.placements.map(parsePlacement);
  // A model is whole or it is nothing: one unparseable placement drops the
  // MODEL, never that one graha, because a diamond quietly missing Saturn
  // is a wrong chart that looks like a chart.
  if (placements.some((p) => p === null) || placements.length === 0) return null;
  const rawCells = Array.isArray(v.cells) ? v.cells.map(parseCell) : null;
  const cells = rawCells && !rawCells.some((c) => c === null)
    ? (rawCells as ChartCell[])
    : null;
  return {
    key: key as DivisionalChart['key'],
    title,
    ascendant_sign_index: ascIndex,
    ascendant_sign: ascSign,
    ascendant_rashi_number: ascRashi,
    placements: placements as ChartPlacement[],
    cells: cells && cells.length === 12 ? cells : null,
  };
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
    ascendant_sign_degree:
      timeKnown ? num(value.ascendant_sign_degree) : null,
    moon_sign: str(value.moon_sign),
    sun_sign: str(value.sun_sign),
    planets: timeKnown ? planets : planets.map((p) => ({ ...p, house: null, nakshatra_pada: null })),
    houses: timeKnown ? houses : [],
    dasha_periods: (Array.isArray(value.dasha_periods) ? value.dasha_periods : [])
      .map(parseDasha)
      .filter((d): d is NatalDashaPeriod => d !== null),
    yogas: strList(value.yogas),
    // INV-6 at the edge, exactly as `ascendant` and `houses` above: a varga
    // is a rotation of the lagna, so a time-less chart carries none whatever
    // the wire said (the ASTRAL-183 regression shape).
    divisional_charts: timeKnown
      ? (Array.isArray(value.divisional_charts) ? value.divisional_charts : [])
        .map(parseDivisional)
        .filter((d): d is DivisionalChart => d !== null)
      : [],
    zodiac_mode: str(value.zodiac_mode),
    ayanamsa: str(value.ayanamsa),
    house_system: str(value.house_system),
    node_model: str(value.node_model),
    engine_version: str(value.engine_version),
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
    ...(parseEmphasis(value.emphasis) ? { emphasis: parseEmphasis(value.emphasis)! } : {}),
  };
}

/**
 * PARSE, DON'T TRUST — and note what is NOT read here: no points, no total,
 * no band. If the engine ever put one on this object the client would still
 * not carry it, which is one more place ASTRAL-149 cannot be broken quietly.
 */
function parseEmphasis(value: unknown): MatchEmphasis | null {
  if (!isObj(value)) return null;
  const order = strList(value.koota_order);
  if (order.length === 0) return null;
  return {
    koota_order: order,
    leading: strList(value.leading),
    rule: str(value.rule) ?? '',
    lines: strList(value.lines),
    unscored: (Array.isArray(value.unscored) ? value.unscored : [])
      .map((u): { key: string; sentence: string } | null => {
        if (!isObj(u)) return null;
        const key = str(u.key);
        const sentence = str(u.sentence);
        return key && sentence ? { key, sentence } : null;
      })
      .filter((u): u is { key: string; sentence: string } => u !== null),
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


// ── palm_analysis ──────────────────────────────────────────────────────────

function parsePalmLine(v: unknown): PalmLine | null {
  if (!isObj(v)) return null;
  const name = str(v.name);
  if (!name) return null;
  return {
    name,
    description: str(v.description),
    interpretation: str(v.interpretation),
    confidence: num(v.confidence),
  };
}

function parsePalmMount(v: unknown): PalmMount | null {
  if (!isObj(v)) return null;
  const name = str(v.name);
  if (!name) return null;
  return {
    name,
    prominence: str(v.prominence),
    interpretation: str(v.interpretation),
  };
}

function parseClassicalRule(v: unknown): PalmClassicalRule | null {
  if (!isObj(v)) return null;
  const rule_id = str(v.rule_id);
  const claim = str(v.claim);
  const citation = str(v.citation);
  // A rule without its citation is not a classical rule, it is an assertion.
  // Dropped whole rather than rendered as one (INV-3 on a screen).
  if (!rule_id || !claim || !citation) return null;
  return {
    rule_id,
    claim,
    domain: str(v.domain),
    polarity: str(v.polarity),
    strength: str(v.strength),
    citation,
    matched: strList(v.matched),
  };
}

function parseClassicalRules(v: unknown): PalmClassicalRules | null {
  if (!isObj(v)) return null;
  return {
    source: str(v.source),
    fired: (Array.isArray(v.fired) ? v.fired : [])
      .map(parseClassicalRule)
      .filter((r): r is PalmClassicalRule => r !== null),
    abstained_count: num(v.abstained_count),
    suppressed_matches: num(v.suppressed_matches),
  };
}

function parsePalmHand(v: unknown): PalmHand | null {
  if (!isObj(v)) return null;
  return {
    hand: str(v.hand),
    hand_role: str(v.hand_role),
    hand_shape: str(v.hand_shape),
    overall_reading: str(v.overall_reading),
    confidence_score: num(v.confidence_score),
    lines: (Array.isArray(v.lines) ? v.lines : [])
      .map(parsePalmLine)
      .filter((l): l is PalmLine => l !== null),
    mounts: (Array.isArray(v.mounts) ? v.mounts : [])
      .map(parsePalmMount)
      .filter((m): m is PalmMount => m !== null),
    special_markings: strList(v.special_markings),
  };
}

/**
 * Parse a `palm_analysis` block.
 *
 * The renderability bar is `hand_label` plus SOMETHING to read: a reading
 * with neither lines, mounts, markings nor prose is not a thin reading, it is
 * a failed one, and the honest render of a failed reading is nothing at all.
 *
 * `hand_label` is required rather than defaulted because the alternative —
 * falling back to `hand` — is the reported bug: a heading that names a side
 * the engine never established.
 */
export function parsePalmAnalysis(value: unknown): PalmAnalysisPayload | null {
  if (!isObj(value) || value.type !== 'palm_analysis') return null;
  const hand_label = str(value.hand_label);
  if (!hand_label) return null;
  const lines = (Array.isArray(value.lines) ? value.lines : [])
    .map(parsePalmLine)
    .filter((l): l is PalmLine => l !== null);
  const mounts = (Array.isArray(value.mounts) ? value.mounts : [])
    .map(parsePalmMount)
    .filter((m): m is PalmMount => m !== null);
  const special_markings = strList(value.special_markings);
  const overall_reading = str(value.overall_reading);
  if (
    lines.length === 0 &&
    mounts.length === 0 &&
    special_markings.length === 0 &&
    !overall_reading
  ) {
    return null;
  }
  return {
    type: 'palm_analysis',
    hand_label,
    hand: str(value.hand),
    hand_role: str(value.hand_role),
    hand_source: str(value.hand_source),
    hand_shape: str(value.hand_shape),
    dominant_element: str(value.dominant_element),
    both_hands: bool(value.both_hands),
    hands: (Array.isArray(value.hands) ? value.hands : [])
      .map(parsePalmHand)
      .filter((h): h is PalmHand => h !== null),
    lines,
    mounts,
    special_markings,
    direct_answer: str(value.direct_answer),
    overall_reading,
    confidence_score: num(value.confidence_score),
    classical_rules: parseClassicalRules(value.classical_rules),
    image_file_id: str(value.image_file_id),
    image_url: str(value.image_url),
  };
}
