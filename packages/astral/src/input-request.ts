/**
 * The `input_request` block and its answer (docs/49 ASTRAL-83/85/89, AMB-17).
 *
 * ── the carrier, and the anti-pattern it exists to avoid ───────────────────
 *
 * AMB-17 was resolved (a): a structured answer travels as the human-readable
 * ECHO plus a fenced `input_response` block, parsed deterministically in the
 * engine's `node_ingest` (GR-6: no LLM, no I/O, no writes). This is
 * `readDataBlock`'s convention run in reverse — the fence language equals the
 * JSON body's own `type` — so nothing in the platform message schema, the
 * stored document, the history projection or either client's send signature
 * changes.
 *
 * The thing NOT to copy is two directories away and has a comment declaring
 * itself: `apps/mobile/src/components/chat/onboarding-form.tsx:63-70` collects
 * typed values, flattens them to `"Age: 34, Sex: male"` and posts that so an
 * LLM can parse them back out — "backend slot extractor depends on it". A
 * picker that stringifies its own answer for a model to re-read has removed
 * nothing; the parse step is still there, just moved.
 *
 * So the split here is exact:
 *   `echoFor`                   — presentation. A sentence a human reads in
 *                                 their own transcript, so the answer is
 *                                 visible, disputable and correctable.
 *   `buildInputResponseMessage` — the CARRIER. Typed JSON in a fence.
 *
 * The property that makes the split real, and the one the tests pin: delete
 * the fence and NOTHING is recoverable. The engine reads no value out of the
 * echo, ever.
 */

import { formatClockTime, formatIsoDate } from './format';

export type InputFieldKind =
  | 'date'
  | 'time'
  | 'place'
  | 'choice'
  | 'text'
  | 'image'
  /**
   * docs/49 ASTRAL-152 (F42): the first kind whose answer is a LIST, and the
   * first with a cardinality contract. The client returns an ORDERED list of
   * option `value`s — order IS the answer, because rank is position — and
   * the engine refuses an off-menu value, a duplicate or a list over `max`
   * by name rather than fixing it up.
   */
  | 'multi';

/**
 * The bare file id out of an upload response URL (bug 8dc95a6a).
 *
 * Both hosts' upload paths hand back `/api/v1/files/{id}/download` (absolute
 * on the web, absolute on RN). The engine's `image` field takes the ID and
 * REFUSES anything with a slash in it — it will not coerce a URL into an id,
 * because a value the engine cannot vouch for must not be stored and then
 * discovered as a 404 inside a reading. So the extraction happens here,
 * once, rather than in each adapter.
 *
 * Returns '' when there is no id to find, which the caller treats as a
 * failed upload rather than sending something unusable.
 */
export function fileIdFromUrl(url: string): string {
  if (!url) return '';
  const match = /\/files\/([^/?#]+)/.exec(url);
  if (match) return match[1];
  return url.indexOf('/') === -1 ? url : '';
}

export interface InputOption {
  value: string;
  /** DISPLAY ONLY. The engine refuses a label submitted as a value. */
  label: string;
  sublabel?: string;
}

export interface InputField {
  /** the belief field this answers — the engine declares it, never the client */
  key: string;
  /** may be a kind this build does not know: render `text`, warn once */
  kind: string;
  label: string;
  required: boolean;
  /** ASTRAL-87: a `time` field always carries a way out */
  allowUnknown: boolean;
  options: InputOption[];
  hint?: string;
  /** `multi` only — the engine's cardinality, carried so the client can stop
   *  a user at the maximum rather than letting them meet a refusal. The
   *  refusal still exists and is still the authority; this is the courtesy. */
  min?: number;
  max?: number;
  /** `multi` only — whether the ORDER of the picks is part of the answer */
  ordered?: boolean;
}

export interface InputRequestPayload {
  type: 'input_request';
  /** which ask this is, echoed back on the answer so the engine can bind it */
  ask: string;
  /** one sentence, shown once at the top — never repeated per field */
  reason: string;
  fields: InputField[];
}

/** A field's answer: a value, an ORDERED LIST of values (`multi`), or `null`
 *  meaning an explicit "I don't know". */
export type InputValue = string | string[] | null;

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseOption(raw: unknown): InputOption | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const value = str(o.value);
  const label = str(o.label);
  if (!value || !label) return null;
  const sublabel = str(o.sublabel);
  return sublabel ? { value, label, sublabel } : { value, label };
}

function parseField(raw: unknown): InputField | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const f = raw as Record<string, unknown>;
  const key = str(f.key);
  const kind = str(f.kind);
  const label = str(f.label);
  if (!key || !kind || !label) return null;
  const options = Array.isArray(f.options)
    ? (f.options.map(parseOption).filter(Boolean) as InputOption[])
    : [];
  // A `choice` or a `multi` with no options is not a question — it is a dead
  // card, which is the one outcome ASTRAL-91 exists to prevent.
  if ((kind === 'choice' || kind === 'multi') && options.length === 0) return null;
  const hint = str(f.hint);
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return {
    key,
    kind,
    label,
    required: f.required !== false,
    allowUnknown: f.allow_unknown === true,
    options,
    ...(hint ? { hint } : {}),
    ...(kind === 'multi'
      ? {
          min: num(f.min, 0),
          // A `multi` whose max the engine did not state takes everything it
          // offered — never 1, which would silently turn an ordered pick into
          // a single choice and lose ranks 2 and 3 without saying so.
          max: num(f.max, options.length),
          ordered: f.ordered === true,
        }
      : {}),
  };
}

/**
 * PARSE, DON'T TRUST — the package rule. A payload we cannot vouch for
 * returns null and the host renders nothing, never raw JSON.
 */
export function parseInputRequest(value: unknown): InputRequestPayload | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.type !== 'input_request') return null;
  if (!Array.isArray(v.fields)) return null;
  const fields = v.fields.map(parseField).filter(Boolean) as InputField[];
  if (fields.length === 0) return null;
  return {
    type: 'input_request',
    ask: str(v.ask),
    reason: str(v.reason),
    fields,
  };
}

function displayValue(field: InputField, value: InputValue): string {
  if (value === null) return "I don't know";
  if (Array.isArray(value)) {
    // The echo is what the USER reads back in their own transcript, so it is
    // the LABELS in the order they picked them — "Temperament, then health
    // and children" — and never the keys. Nothing on the server reads it.
    if (value.length === 0) return 'none';
    const labels = value.map(
      (v) => field.options.find((o) => o.value === v)?.label ?? v,
    );
    return field.ordered === false ? labels.join(', ') : labels.join(', then ');
  }
  // A file id is machine plumbing. The echo is what the USER reads back in
  // their own transcript, and "dominant_palm_file_id: 8f2c-…" tells them
  // nothing they can dispute or correct.
  if (field.kind === 'image') return 'photo attached';
  if (field.kind === 'time') return formatClockTime(value);
  // A date goes out ISO on the wire and comes back as a SENTENCE in the
  // transcript. Seen on the simulator: the echo read "Date of birth:
  // 1990-08-02", which is the machine's form of the one field this widget
  // exists to disambiguate — and the user is meant to be able to read their
  // own answer back and dispute it (ASTRAL-89).
  if (field.kind === 'date') return formatIsoDate(value) ?? value;
  if (field.kind === 'choice') {
    const hit = field.options.find((o) => o.value === value);
    return hit ? hit.label : value;
  }
  return value;
}

/**
 * The ASTRAL-89 echo — the visible user turn.
 *
 * PRESENTATION, NOT THE CARRIER. Nothing on the server reads this string:
 * it exists so the transcript stays readable and the user can see, dispute
 * and correct what they answered. `buildInputResponseMessage` below carries
 * the actual values, typed, in a fence.
 */
export function echoFor(
  request: InputRequestPayload,
  values: Record<string, InputValue>,
): string {
  const parts: string[] = [];
  for (const field of request.fields) {
    if (!(field.key in values)) continue;
    parts.push(`${field.label}: ${displayValue(field, values[field.key])}`);
  }
  return parts.join(' · ');
}

/**
 * The one place a widget answer becomes a message. There is exactly one of
 * these in the workspace and a structural test says so.
 *
 * Every send carries the fence. There is no code path that posts the echo
 * alone, which is what keeps the engine's parse deterministic rather than
 * a model's guess at a sentence.
 */
export function buildInputResponseMessage(
  request: InputRequestPayload,
  values: Record<string, InputValue>,
): string {
  const echo = echoFor(request, values);
  const payload = {
    type: 'input_response',
    ask: request.ask,
    echo,
    values,
  };
  return `${echo}\n\n\`\`\`input_response\n${JSON.stringify(payload)}\n\`\`\``;
}

const INPUT_RESPONSE_FENCE = /```input_response[ \t]*\r?\n[\s\S]*?```/g;

/**
 * Remove the answer fence from a USER bubble.
 *
 * The declared cost of AMB-17 (a): the raw block is persisted in the
 * transcript, so both clients suppress it on a user bubble exactly as they
 * already suppress data fences on an assistant one. A user must never read
 * their own JSON.
 */
export function stripInputResponse(text: string): string {
  if (!text || text.indexOf('```input_response') === -1) return text;
  return text.replace(INPUT_RESPONSE_FENCE, '').trim();
}
