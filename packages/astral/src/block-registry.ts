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
