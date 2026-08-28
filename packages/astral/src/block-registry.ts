/**
 * The "null -> registry" change (docs/49 ASTRAL-20).
 *
 * What this replaces, verbatim, on both clients:
 *
 *   web    response.tsx:91-94   if (lang && ["muhurta_results","natal_chart",
 *                               "match_report"].includes(lang)) return null;
 *   mobile widget-view.tsx:183  if (type === 'natal_chart' || ...) return null;
 *
 * Both carried a comment explaining that the prose below already covered the
 * block. The prose did not cover it — the server computed a full chart and the
 * client threw it away, and it stayed that way for months because dropping a
 * block is indistinguishable from having no block. That is the mechanism this
 * registry removes: an unregistered type still renders NOTHING to the user,
 * but it says so once, by name, in the console.
 *
 * Once per type per session, not once per render: a streaming message
 * re-renders on every chunk, and a warning per chunk is a warning nobody
 * reads.
 */

export interface BlockRegistry<T> {
  /** the handler for `type`, or undefined */
  get(type: string): T | undefined;
  /** true when `type` has a handler */
  has(type: string): boolean;
  /**
   * Record that an unregistered block type arrived. Warns at most once per
   * type. Returns true if this call emitted the warning.
   */
  reportUnknown(type: string): boolean;
  /** test seam — forget which types have already been warned about */
  resetWarnings(): void;
  /** every registered type, for the structural tests and for diagnostics */
  types(): string[];
}

export interface BlockRegistryOptions {
  /** where the surface's name appears in the warning, e.g. "response" */
  surface: string;
  /**
   * Injected so a test can assert the warning without spying on the global.
   * Defaults to `console.warn`.
   */
  warn?: (message: string, ...rest: unknown[]) => void;
  /**
   * The wording, for a surface where "rendering nothing" would be a LIE.
   *
   * ASTRAL-20's rule is block-level: an unknown BLOCK renders nothing. The
   * input widget deliberately differs (ASTRAL-91) — an unknown FIELD KIND
   * renders a working text input, because an unrenderable field silently
   * removes a question the engine is waiting on. Same once-per-type
   * bookkeeping, honest sentence.
   */
  unknownMessage?: (type: string) => string;
}

export function createBlockRegistry<T>(
  handlers: Record<string, T>,
  options: BlockRegistryOptions,
): BlockRegistry<T> {
  const warned = new Set<string>();
  const warn = options.warn ?? ((...args: unknown[]) => {
    console.warn(...(args as [string]));
  });

  return {
    get: (type) => handlers[type],
    has: (type) => Object.prototype.hasOwnProperty.call(handlers, type),
    types: () => Object.keys(handlers),
    resetWarnings: () => warned.clear(),
    reportUnknown(type: string): boolean {
      const key = String(type);
      if (warned.has(key)) return false;
      warned.add(key);
      warn(
        options.unknownMessage
          ? options.unknownMessage(key)
          : `[astral/${options.surface}] unregistered block type "${key}" — ` +
            'rendering nothing. If the backend now emits this block, add a ' +
            'renderer to the registry (docs/49 ASTRAL-20).',
      );
      return true;
    },
  };
}

/**
 * Is this fenced code block a DATA block rather than source code a user is
 * meant to read?
 *
 * The backend's convention is exact and narrow: the fence language equals the
 * JSON body's own `type` field — ```natal_chart {"type":"natal_chart", ...}.
 * Requiring both means an ordinary ```json or ```python fence is untouched,
 * while a hallucinated ```kundli fence (which `prompts.py:27` says out loud
 * the model sometimes emits, and which used to reach the user as raw JSON)
 * is recognised as a data block and suppressed.
 *
 * Returns the parsed value on a match, otherwise null.
 */
export function readDataBlock(lang: string | undefined, raw: string): { type: string; value: unknown } | null {
  if (!lang) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const type = (parsed as Record<string, unknown>).type;
  if (typeof type !== 'string' || type !== lang) return null;
  return { type, value: parsed };
}

/**
 * One text run, or one data block, in the order the engine streamed them.
 *
 * `value` is `null` for a block whose fence has not closed yet — see
 * `splitDataBlocks`. Every renderer already treats an unparseable payload as
 * "render nothing", so a not-yet-complete block needs no special case
 * downstream: it simply draws nothing until the closing fence arrives.
 */
export type StreamSegment =
  | { kind: 'text'; text: string }
  | { kind: 'block'; type: string; value: unknown };

const FENCE_RE = /```([a-z_][a-z0-9_]*)[ \t]*\r?\n([\s\S]*?)```/g;
/** an opening fence with no closer after it — the tail of a live stream */
const OPEN_FENCE_RE = /```([a-z_][a-z0-9_]*)[ \t]*\r?\n([\s\S]*)$/;

/**
 * Split assistant text into its text runs and its DATA blocks, in stream
 * order (docs/49 ASTRAL-20, ASTRAL-106).
 *
 * Which fences are data is `readDataBlock`'s rule and only that rule: the
 * fence language must equal the JSON body's own `type`. An ordinary ```json
 * or ```python fence is left in the text where it belongs.
 *
 * ── the second clause, and why it is not cosmetic ──────────────────────────
 *
 * A block arrives one chunk at a time, so for the seconds between the opening
 * fence and the closing one the body is a half-written JSON object sitting at
 * the end of the text. Rendered as markdown, that is raw JSON scrolling past
 * the user — which is the exact defect this function exists to remove, just
 * during the stream instead of after it.
 *
 * `dataLanguages` closes that window. A TRAILING unterminated fence whose
 * language is one of them is emitted as a block with a null value, so it
 * draws nothing until it closes. Callers that pass nothing get the settled
 * behaviour unchanged, which is why the existing host can adopt this function
 * without a behaviour change.
 *
 * The list is asked for rather than restated here: a second hand-kept list of
 * block types is how one of them goes stale.
 */
export function splitDataBlocks(
  text: string,
  dataLanguages: readonly string[] = [],
): StreamSegment[] {
  if (!text) return [];
  const out: StreamSegment[] = [];
  let last = 0;
  FENCE_RE.lastIndex = 0;
  for (const m of text.matchAll(FENCE_RE)) {
    const [whole, lang, body] = m;
    const start = m.index ?? 0;
    const data = readDataBlock(lang, body.trim());
    if (!data) continue;
    if (start > last) out.push({ kind: 'text', text: text.slice(last, start) });
    out.push({ kind: 'block', type: data.type, value: data.value });
    last = start + whole.length;
  }
  const tail = text.slice(last);
  if (tail) {
    const open = dataLanguages.length ? OPEN_FENCE_RE.exec(tail) : null;
    if (open && dataLanguages.indexOf(open[1]) !== -1) {
      const before = tail.slice(0, open.index);
      if (before) out.push({ kind: 'text', text: before });
      out.push({ kind: 'block', type: open[1], value: null });
    } else {
      out.push({ kind: 'text', text: tail });
    }
  }
  return out;
}

/**
 * Partition a stream into what came BEFORE the first data block and what came
 * AFTER the last one (docs/49 ASTRAL-17 / ASTRAL-48).
 *
 * A native result surface needs this and a chat transcript does not, which is
 * why it is a function rather than a rule inside `splitDataBlocks`. In a
 * transcript every run of text is read in order and the progress line is part
 * of the story. On a screen whose whole subject IS the computed artifact,
 * the two runs mean different things:
 *
 *   `before`  progress — "Casting your chart… 🪐", "Calculating auspicious
 *             windows… 🔮". Written to be read WHILE waiting, and stale the
 *             moment the result lands. Measured on the simulator on
 *             2026-08-28: shown after the fact it reads as though the screen
 *             is still working, above a result that has already arrived.
 *   `after`   the reading — the sentences the engine wrote ABOUT the artifact.
 *
 * A stream with no data block has no result to be before or after, so all of
 * its text is returned as `after`: on those turns the engine is asking or
 * refusing, and that is the thing to read.
 */
export function partitionAroundBlocks(segments: StreamSegment[]): {
  before: string;
  after: string;
} {
  const firstBlock = segments.findIndex((s) => s.kind === 'block');
  const lastBlock = segments.map((s) => s.kind).lastIndexOf('block');
  const text = (from: number, to: number) =>
    segments
      .slice(from, to)
      .map((s) => (s.kind === 'text' ? s.text : ''))
      .join('')
      .trim();
  if (firstBlock === -1) return { before: '', after: text(0, segments.length) };
  return {
    before: text(0, firstBlock),
    after: text(lastBlock + 1, segments.length),
  };
}
