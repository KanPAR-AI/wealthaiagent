/**
 * The local biodata parser (docs/73 ASTRAL-325 / ASTRAL-326).
 *
 * PURE and OFFLINE, and both words are load-bearing. This module imports
 * nothing that can reach the network, contains no `fetch`, no `chrome.*` and
 * no date library; it runs in the panel document and its output NEVER leaves
 * the browser. What leaves is the object the user confirmed at the review
 * screen (`confirmed.ts`), which is a different type with a different brand.
 *
 * ── the three states, and the one that costs the most to get wrong ─────────
 *
 * A field that is not visible is `missing` — never guessed. "Not found" and
 * "found but read with a guess" are different risks, and the review screen
 * shows them differently. So every reading that required a judgement comes
 * back `inferred` WITH the basis in words, and the two that this parser makes
 * most often are:
 *
 *   - `03/04/1989` is the 3rd of April to half the world and the 4th of
 *     March to the other half. It is returned `inferred`, carrying the
 *     Indian convention's reading and NAMING the other one. The review screen
 *     then refuses to pre-fill it at all (B3): two chips, in words, and the
 *     control stays empty until the user picks.
 *   - a "Location" or "Lives in" row is where somebody LIVES. It may be
 *     where they were born and usually is not. `inferred`, with that
 *     sentence as the basis, so the user can correct it in one tap.
 *
 * ── the CHIMERA, and why every field carries its line ─────────────────────
 *
 * B2, found in review. A matrimonial page is usually a page about a FAMILY:
 * the candidate, then a brother, then the father. Four independent
 * first-row-wins scans over that text will happily return the candidate's
 * name with her brother's date of birth, every field marked `stated`, and
 * cast a chart for a person who does not exist. That is the worst failure
 * this file can have, because every part of it looks right.
 *
 * So there are two defences and they are both here:
 *
 *   1. **A record boundary.** A repeated label, a name after a date, or a
 *      relation header ends the first record. Candidates come from the first
 *      block ONLY.
 *   2. **Doubt travels.** When more than one person is detected, every field
 *      that has a value is degraded to `inferred` with a basis naming the
 *      problem — the user is told to check, not reassured. A `missing` field
 *      stays `missing`: `inferred` means "a value reached by reasoning", and
 *      an `inferred` with nothing in it would be a fourth state.
 *
 * And `sourceLine` carries the LINE each value was read from, which the
 * review screen shows under the control. "Where did this come from?" is the
 * question a chimera makes a user ask, and it should have an answer that is
 * not a re-read of the page.
 *
 * ── the corpus ────────────────────────────────────────────────────────────
 *
 * `parse-profile.test.ts`'s cases are SYNTHETIC biodata text written for the
 * test. No text is copied from any live profile and no real person's details
 * are in this repository.
 */

import type { Candidate, ParsedProfile, PersonFieldKey } from './confirmed';

const MISSING: Candidate = { state: 'missing', value: null, confidence: 0 };

/** Words a biodata uses for "we don't know" — read as `missing`, not as a name. */
const UNKNOWN_WORDS = /^(not\s*known|unknown|not\s*available|n\/?a|none|-{1,2}|—|\?)$/i;

/**
 * Label → field. Order matters inside each group: the FIRST match on a line
 * wins, so `Date of Birth` is tried before `Birth`.
 *
 * Devanagari labels are here because they are on real Indian biodatas, and a
 * parser that only reads English silently drops half of them (which is a
 * `missing` that should have been a `stated`).
 */
const LABELS: Array<{ key: PersonFieldKey | 'residence'; pattern: RegExp }> = [
  { key: 'dob', pattern: /^(date\s*of\s*birth|birth\s*date|d\.?o\.?b\.?|जन्म\s*तिथि|जन्मतिथि|जन्म\s*दिनांक)$/i },
  { key: 'tob', pattern: /^(time\s*of\s*birth|birth\s*time|t\.?o\.?b\.?|जन्म\s*समय|जन्मसमय)$/i },
  { key: 'pob', pattern: /^(place\s*of\s*birth|birth\s*place|p\.?o\.?b\.?|जन्म\s*स्थान|जन्मस्थान)$/i },
  { key: 'name', pattern: /^(name|full\s*name|candidate\s*name|नाम|पूरा\s*नाम)$/i },
  // NOT a birth place. See the header.
  { key: 'residence', pattern: /^(location|lives\s*in|city|current\s*city|residence|based\s*in|निवास|शहर)$/i },
];

/**
 * Who a biodata talks about besides the candidate.
 *
 * Used three ways below, and the difference between them is the whole of B2's
 * second and third rounds:
 *
 *   `Name of Father: Ramesh`  introduces a PERSON  → boundary
 *   `Brother` (a bare line)   introduces a PERSON  → boundary, IF labelled
 *                                                    birth rows follow it
 *   `Mother Tongue: Marathi`  is an ATTRIBUTE      → not a boundary at all
 *
 * Getting the third one wrong is not a safety bug but it is a bad one: every
 * ordinary Indian biodata carries `Mother Tongue`, `Family Type`, `Father's
 * Occupation` and `Brothers: 1`, and treating those as record boundaries
 * threw away the candidate's own birth rows when they came further down.
 */
const RELATION_WORDS =
  'father|mother|brother|sister|sibling|siblings|brothers|sisters|spouse|husband|wife|' +
  'son|daughter|uncle|aunt|grand\\s*father|grand\\s*mother|guardian|parent|parents|' +
  'पिता|माता|भाई|बहन|पति|पत्नी';

/** `Name of Father`, `Father's Name`, `Brother Name`, `नाम पिता` — a PERSON. */
const RELATION_NAME_LABEL = new RegExp(
  `^(name\\s*of\\s*(the\\s*)?(${RELATION_WORDS})|(${RELATION_WORDS})'?s?\\s*name)$`,
  'i',
);

/** A label that is EXACTLY a relation, singular: `Father: Ramesh Iyer`. */
const BARE_RELATION_LABEL = new RegExp(`^(${RELATION_WORDS})$`, 'i');

/**
 * A heading with no value, in two kinds — and the difference decides how
 * easily it becomes a boundary.
 *
 * `Brother` names a PERSON: the rows under it are his, so the first birth row
 * after it ends the candidate's record.
 *
 * `Family Details` names a SECTION, and on a real biodata that section
 * usually holds attributes — type, income, how many brothers — with the
 * candidate's own rows continuing below it. Treating it like `Brother` threw
 * those rows away. So a group heading is only a boundary once somebody is
 * NAMED under it, or a label repeats.
 */
const PERSON_HEADING_LINE = new RegExp(
  `^(elder|younger)?\\s*(${RELATION_WORDS})\\s*:?\\s*$`,
  'i',
);

const GROUP_HEADING_LINE =
  /^(family(\s*(details?|background|information))?|about\s*(the\s*)?family|parents?|परिवार)\s*:?\s*$/i;

/** Mentions a relation but is an ATTRIBUTE of the family, not a person:
 *  `Mother Tongue`, `Family Income`, `Father's Occupation`, `No. of Brothers`. */
const RELATION_ATTRIBUTE_LABEL = new RegExp(
  `(tongue|income|occupation|profession|job|business|status|type|values?|native|` +
    `count|number|no\\.?\\s*of|details?|background|residing|location|contact)`,
  'i',
);

/** A value that counts rather than names: `1`, `2 (married)`, `None`. */
const COUNTING_VALUE = /^(\d+|none|nil|no)\b/i;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Devanagari month names, so `१४ मई १९९४` is read rather than dropped.
 *
 * Dropping it is not neutral: it turns a legible date into a `missing`, and
 * the user re-types something the page already said.
 */
const HINDI_MONTHS: Record<string, number> = {
  'जनवरी': 1, 'फरवरी': 2, 'फ़रवरी': 2, 'मार्च': 3, 'अप्रैल': 4, 'मई': 5, 'जून': 6,
  'जुलाई': 7, 'अगस्त': 8, 'सितंबर': 9, 'सितम्बर': 9, 'अक्टूबर': 10, 'अक्तूबर': 10,
  'नवंबर': 11, 'नवम्बर': 11, 'दिसंबर': 12, 'दिसम्बर': 12,
};

const RESIDENCE_BASIS =
  'this row says where they live, which may not be where they were born';

export const MULTI_PERSON_BASIS_PREFIX =
  'this text seems to describe more than one person';

/** One labelled row, with the line it came from. */
interface Row {
  key: PersonFieldKey | 'residence';
  value: string;
  /** the raw line, shown back to the user under the control */
  line: string;
}

export interface ParseDiagnostics {
  /** more than one person's rows were found in this text */
  multiPerson: boolean;
  /** the line that ended the first record, when one did */
  boundaryLine: string | null;
}

export function parseProfileText(
  text: string,
  source: ParsedProfile['source'] = 'paste',
): ParsedProfile {
  const { rows, diagnostics } = firstRecord(text);

  const fields: Record<PersonFieldKey, Candidate> = {
    name: MISSING,
    dob: MISSING,
    tob: MISSING,
    pob: MISSING,
  };
  let residence: Candidate | null = null;

  for (const row of rows) {
    const value = row.value.trim();
    if (!value || UNKNOWN_WORDS.test(value)) {
      // An explicit "Not known" is the field's answer, and it is `missing` —
      // a different sentence from "the row was not there", but the same
      // state: we do not have it and we did not guess it.
      continue;
    }
    if (row.key === 'residence') {
      if (!residence) {
        residence = withLine(
          { state: 'inferred', value, confidence: 0.4, basis: RESIDENCE_BASIS },
          row.line,
        );
      }
      continue;
    }
    if (fields[row.key] !== MISSING) continue; // first labelled row in the block wins
    const read =
      row.key === 'dob' ? readDate(value)
        : row.key === 'tob' ? readTime(value)
          : { state: 'stated' as const, value, confidence: 0.9 };
    fields[row.key] = withLine(read, row.line);
  }

  // A residence row fills the birth place ONLY when no birth-place row was
  // found, and then it is `inferred` and says why.
  if (fields.pob === MISSING && residence) fields.pob = residence;

  if (diagnostics.multiPerson) {
    for (const key of Object.keys(fields) as PersonFieldKey[]) {
      fields[key] = doubted(fields[key], fields.name.value, diagnostics.boundaryLine);
    }
  }

  return { kind: 'parsed', source, fields };
}

/** The same parse, with what it noticed — for a caller that wants to say so. */
export function parseProfileWithDiagnostics(
  text: string,
  source: ParsedProfile['source'] = 'paste',
): { profile: ParsedProfile; diagnostics: ParseDiagnostics } {
  return {
    profile: parseProfileText(text, source),
    diagnostics: firstRecord(text).diagnostics,
  };
}

function withLine(candidate: Candidate, line: string): Candidate {
  return { ...candidate, sourceLine: line };
}

/**
 * Doubt, applied to one field.
 *
 * A field with a value becomes `inferred` and says why. A `missing` field is
 * left alone — there is nothing to doubt, and an `inferred` with a null value
 * would be a fourth state smuggled in through a null.
 */
function doubted(candidate: Candidate, name: string | null, boundary: string | null): Candidate {
  if (candidate.value === null) return candidate;
  const who = name ? ` to ${name}` : '';
  const where = boundary ? ` (another person's details start at "${boundary}")` : '';
  return {
    ...candidate,
    state: 'inferred',
    confidence: Math.min(candidate.confidence, 0.4),
    basis:
      `${MULTI_PERSON_BASIS_PREFIX} — check that this belongs${who}${where}` +
      (candidate.basis ? `; ${candidate.basis}` : ''),
  };
}

/**
 * The rows of the FIRST record, and whether there was a second.
 *
 * Three boundary signals, each one a shape a real family biodata has:
 *   - a label that has already been used ("Name:" twice);
 *   - a name AFTER a date of birth — the next person's block has begun even
 *     if no label has repeated yet;
 *   - a relation header ("Brother", "Father's Name: …") — everything after it
 *     is about somebody else.
 */
function firstRecord(text: string): { rows: Row[]; diagnostics: ParseDiagnostics } {
  const rows: Row[] = [];
  const used = new Set<PersonFieldKey | 'residence'>();
  let multiPerson = false;
  let boundaryLine: string | null = null;
  let sawDob = false;
  /**
   * A heading that MIGHT start another person's block.
   *
   * `Brother` on its own line is only a boundary if labelled birth rows
   * follow it — on plenty of biodatas it is a section title with attributes
   * under it and the candidate's own rows further down. So it is held, and
   * confirmed by the next person-labelled row.
   */
  let heldHeader: string | null = null;

  const boundary = (line: string) => {
    multiPerson = true;
    boundaryLine = line;
  };

  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const parsed = labelledRow(line);

    // A heading with no value — held, not acted on (see `heldHeader`).
    if (!parsed && (PERSON_HEADING_LINE.test(line) || GROUP_HEADING_LINE.test(line))) {
      heldHeader = heldHeader ?? line;
      continue;
    }
    if (!parsed) continue;

    const label = parsed.label;

    // `Name of Father: …` — this row IS another person, whatever follows.
    if (RELATION_NAME_LABEL.test(label)) {
      boundary(line);
      break;
    }

    // `Father: Ramesh Iyer` names a person; `Brothers: 1` counts them.
    if (BARE_RELATION_LABEL.test(label) && !COUNTING_VALUE.test(parsed.value.trim())) {
      boundary(line);
      break;
    }

    // Anything else that merely MENTIONS a relation is an attribute of the
    // family — `Mother Tongue`, `Father's Occupation`, `No. of Brothers`.
    // Skipped: not a boundary, and not one of the four fields either.
    if (
      (RELATION_ATTRIBUTE_LABEL.test(label) || COUNTING_VALUE.test(parsed.value.trim())) &&
      new RegExp(`(${RELATION_WORDS}|family)`, 'i').test(label)
    ) {
      continue;
    }

    const hit = LABELS.find((l) => l.pattern.test(label));
    if (!hit) continue;

    // A held heading is confirmed by what follows it. A PERSON heading
    // ("Brother") is confirmed by any birth row — they are his. A GROUP
    // heading ("Family Details") is confirmed only once somebody is NAMED
    // under it, or a label repeats; otherwise the section is attributes and
    // the candidate's own rows continue below it.
    if (heldHeader && hit.key !== 'residence') {
      // ANY of the four person rows confirms it, whether the heading named a
      // person ("Brother") or a section ("Family Details").
      //
      // The two cases are genuinely indistinguishable by shape — "Family
      // Details / Family Type: Nuclear / Place of Birth: Pune" (the
      // candidate's place, further down) and "Family Details: / DOB:
      // 12/08/1962" (her father's date) have the same skeleton. So this
      // resolves the way the whole file resolves doubt: the rows already read
      // become `inferred` with the reason, and the row under the heading is
      // not taken at all. Losing a place the user can re-type beats asserting
      // a date that belongs to somebody else.
      boundary(heldHeader);
      break;
    }

    if (used.has(hit.key) || (hit.key === 'name' && sawDob)) {
      boundary(line);
      break;
    }

    used.add(hit.key);
    if (hit.key === 'dob') sawDob = true;
    rows.push({ key: hit.key, value: parsed.value, line });
  }

  return { rows, diagnostics: { multiPerson, boundaryLine } };
}

/**
 * `Label: value`.
 *
 * A row with no separator is not a labelled row and is skipped rather than
 * being guessed at.
 */
function labelledRow(line: string): { label: string; value: string } | null {
  const m = /^\s*([^:\t|]{2,40}?)\s*[::\t|]\s*(.+?)\s*$/.exec(line);
  if (!m) return null;
  return { label: m[1].replace(/[*_•\-–]+$/, '').trim(), value: m[2] };
}

const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const NUMERIC = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{2,4})$/;
// `{2,12}` rather than `{3,12}`: मई is two code points, and requiring
// three silently dropped every May on a Devanagari biodata.
// The month word is "a run that is not a space, a digit or a separator"
// rather than a script character class: a Devanagari class trips
// `no-misleading-character-class` (matras combine), and `monthNumber`
// refuses anything that is not a month anyway. मई is two code points, so
// the lower bound is 2 — requiring three silently dropped every May on a
// Devanagari biodata.
const DAY_MONTH_NAME =
  /^(\d{1,2})(?:st|nd|rd|th)?[\s.,-]+([^\s\d.,-]{2,12})[\s.,-]+(\d{4})$/;
const MONTH_NAME_DAY = /^([A-Za-z]{3,9})[\s.,-]+(\d{1,2})(?:st|nd|rd|th)?[\s.,-]+(\d{4})$/;

/** ISO `YYYY-MM-DD`, or null when the parts are not a real calendar date. */
export function isoDate(y: number, m: number, d: number): string | null {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (y < 1800 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Month lengths, stated rather than delegated to `Date`, which happily
  // rolls the 31st of February into March and would turn a typo into a
  // different, plausible-looking birthday.
  const lengths = [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (d > lengths[m - 1]) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function leap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/**
 * Devanagari digits → ASCII.
 *
 * A transliteration of NUMERALS only. It changes no month name, no label and
 * no place — a page that writes १४ means 14 on any keyboard.
 */
export function asciiDigits(value: string): string {
  return value.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
}

/** Trailing noise a biodata puts after a date or a time. */
function trimNoise(value: string): string {
  return value
    // "(31 yrs)", "(aged 31)"
    .replace(/\s*\([^)]*\)\s*$/, '')
    // "IST", "GMT+5:30", "hrs"
    .replace(/\s+(IST|GMT[+\-\d:]*|UTC[+\-\d:]*|hrs?|hours?)\s*$/i, '')
    .trim();
}

function monthNumber(word: string): number | undefined {
  const hindi = HINDI_MONTHS[word];
  if (hindi) return hindi;
  const lower = word.toLowerCase();
  return MONTHS[lower.slice(0, 4)] ?? MONTHS[lower.slice(0, 3)];
}

export function readDate(raw: string): Candidate {
  const value = asciiDigits(trimNoise(String(raw ?? '')).trim());

  const isoMatch = ISO.exec(value);
  if (isoMatch) {
    const out = isoDate(+isoMatch[1], +isoMatch[2], +isoMatch[3]);
    return out ? { state: 'stated', value: out, confidence: 0.95 } : unreadable();
  }

  const dmn = DAY_MONTH_NAME.exec(value);
  if (dmn) {
    const month = monthNumber(dmn[2]);
    const out = month ? isoDate(+dmn[3], month, +dmn[1]) : null;
    return out ? { state: 'stated', value: out, confidence: 0.95 } : unreadable();
  }

  const mnd = MONTH_NAME_DAY.exec(value);
  if (mnd) {
    const month = monthNumber(mnd[1]);
    const out = month ? isoDate(+mnd[3], month, +mnd[2]) : null;
    return out ? { state: 'stated', value: out, confidence: 0.95 } : unreadable();
  }

  const num = NUMERIC.exec(value);
  if (num) {
    const [a, b, c] = [+num[1], +num[2], +num[3]];
    // `1994/05/14` — a four-digit leader can only be the year.
    if (num[1].length === 4) {
      const out = isoDate(a, b, c);
      return out ? { state: 'stated', value: out, confidence: 0.95 } : unreadable();
    }
    if (String(num[3]).length < 4) return unreadable(); // a 2-digit year has no century
    const asDayMonth = isoDate(c, b, a);
    const asMonthDay = isoDate(c, a, b);
    if (asDayMonth && asMonthDay && asDayMonth !== asMonthDay) {
      // BOTH readings are real dates. The value carried is the day-month
      // convention this product's users write in; the OTHER reading is
      // named, the state says a judgement was made, and the review screen
      // pre-fills NEITHER (B3).
      return {
        state: 'inferred',
        value: asDayMonth,
        confidence: 0.5,
        // B3: the screen pre-fills NEITHER reading and offers both as chips,
        // so the sentence no longer says "I read it day first" — it did not.
        basis:
          `"${value}" is two real dates — ${spell(asDayMonth)} (day first) ` +
          `or ${spell(asMonthDay)} (month first). Pick the one you mean.`,
        alternatives: [asDayMonth, asMonthDay],
      };
    }
    const only = asDayMonth ?? asMonthDay;
    return only ? { state: 'stated', value: only, confidence: 0.9 } : unreadable();
  }

  return unreadable();
}

/**
 * A row we saw and could not read.
 *
 * `missing`, deliberately — NOT `inferred` with a null value. The three
 * states are about the VALUE, and `inferred` means "a value reached by
 * reasoning"; an `inferred` with nothing in it would be a fourth state
 * smuggled in through a null, and §4's contract forbids a `basis` on
 * anything but `inferred`. We have no value, we did not guess one, and the
 * review screen asks for it — which is exactly what `missing` says.
 */
function unreadable(): Candidate {
  return { state: 'missing', value: null, confidence: 0 };
}

const MONTH_WORDS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/**
 * An ISO date, in words (B3).
 *
 * Exported because the REVIEW SCREEN needs it: `<input type="date">` renders
 * in the browser's locale, so the same `1989-04-03` reads "03/04/1989" to one
 * user and "04/03/1989" to another — which is the ambiguity this whole path
 * exists to remove, reintroduced at the last step. The words are unambiguous
 * in every locale.
 */
export function spell(isoValue: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoValue ?? '');
  if (!m) return '';
  return `${Number(m[3])} ${MONTH_WORDS[Number(m[2]) - 1]} ${m[1]}`;
}

const CLOCK = /^(\d{1,2})[:.·](\d{2})(?:\s*(a\.?m\.?|p\.?m\.?))?$/i;
const BARE_HOUR = /^(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)$/i;

export function readTime(raw: string): Candidate {
  const value = asciiDigits(trimNoise(String(raw ?? '')).trim());

  const bare = BARE_HOUR.exec(value);
  if (bare) return meridiem(+bare[1], 0, bare[2]);

  const m = CLOCK.exec(value);
  if (!m) return unreadable();
  const hour = +m[1];
  const minute = +m[2];
  if (m[3]) return meridiem(hour, minute, m[3]);

  if (minute > 59 || hour > 23) return unreadable();
  if (hour >= 13 || hour === 0) {
    // 13:00+ and 00:xx exist only on the 24-hour clock — a 12-hour clock
    // writes the latter as "12:15 am" — so neither needs a judgement.
    return { state: 'stated', value: clock(hour, minute), confidence: 0.95 };
  }
  // No am/pm, and the hour fits both halves of the day. A birth time read
  // twelve hours out moves the ascendant by six signs, so this is named, not
  // picked quietly. 12:xx is the awkward one: on a 24-hour clock it is just
  // after noon, and on a 12-hour clock without a marker it is noon or
  // midnight.
  const other = hour === 12 ? clock(0, minute) : clock(hour + 12, minute);
  return {
    state: 'inferred',
    value: clock(hour, minute),
    confidence: 0.5,
    basis:
      `"${value}" carries no am/pm — I read it as ${clock(hour, minute)}; ` +
      `the other reading is ${other}`,
    alternatives: [clock(hour, minute), other],
  };
}

function meridiem(hour: number, minute: number, marker: string): Candidate {
  if (hour < 1 || hour > 12 || minute > 59) return unreadable();
  const pm = /^p/i.test(marker);
  const h24 = pm ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;
  return { state: 'stated', value: clock(h24, minute), confidence: 0.95 };
}

function clock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
