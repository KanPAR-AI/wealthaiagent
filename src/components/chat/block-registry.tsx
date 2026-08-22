/**
 * The web block registry (docs/49 ASTRAL-20 — the "null -> registry" change).
 *
 * What it replaces, verbatim, from `response.tsx`:
 *
 *     // Hide muhurta_results, natal_chart JSON blocks for now (rendered as
 *     // formatted markdown below the block; raw JSON is noise).
 *     if (lang && ["muhurta_results","natal_chart","match_report"].includes(lang))
 *       return null;
 *
 * The comment was wrong and stayed wrong for months: the markdown below the
 * block does not contain the chart, so the client was discarding a full
 * computed artifact and there was no way to tell that from having no artifact
 * at all. A registry makes the difference visible — an unregistered data block
 * still renders nothing, but it names itself once in the console.
 *
 * Scope note: this registry governs FENCED DATA BLOCKS in assistant markdown.
 * `readDataBlock` only treats a fence as data when the fence language equals
 * the JSON body's own `type` field, which is the backend's convention, so an
 * ordinary ```json or ```python fence still renders as code.
 */

import type { ReactNode } from 'react';
import { createBlockRegistry, readDataBlock } from '@wealthai/astral';

import { BedtimeVideoWidget, tryParseBedtimePayload } from '@/components/widgets/bedtime-video-widget';
import {
  PalmPredictionsCard,
  PalmReadingWidget,
  tryParsePalmPayload,
  tryParsePalmPredictionsPayload,
} from '@/components/widgets/palm-reading-widget';
import { PalmScanningWidget, tryParsePalmScanningPayload } from '@/components/widgets/palm-scanning-widget';
import { AstralBlock } from '@/components/astral/astral-block';

export interface BlockContext {
  /** false on a history reload — suppresses streaming-only placeholders */
  isStreaming: boolean;
}

type BlockHandler = (raw: string, value: unknown, ctx: BlockContext) => ReactNode;

const handlers: Record<string, BlockHandler> = {
  bedtime_video: (raw) => {
    const payload = tryParseBedtimePayload(raw);
    return payload ? <BedtimeVideoWidget payload={payload} /> : null;
  },

  // Cinematic placeholder while Gemini Vision runs. Suppressed on history:
  // a saved message also carries the analysis block that supersedes it, and
  // otherwise the "Compiling reading…" animation loops forever after reload.
  palm_scanning: (raw, _value, ctx) => {
    if (!ctx.isStreaming) return null;
    const payload = tryParsePalmScanningPayload(raw);
    return payload ? <PalmScanningWidget payload={payload} /> : null;
  },

  palm_analysis: (raw) => {
    const payload = tryParsePalmPayload(raw);
    return payload ? <PalmReadingWidget payload={payload} /> : null;
  },

  palm_predictions: (raw) => {
    const payload = tryParsePalmPredictionsPayload(raw);
    return payload ? <PalmPredictionsCard payload={payload} /> : null;
  },

  // The three blocks PH-3 stops discarding.
  // docs/49 ASTRAL-83: the engine asks, the client collects. Registered here
  // so the ask is a widget rather than an unrendered fence — the exact
  // failure ASTRAL-20 built this registry to make visible.
  input_request: (_raw, value) => <AstralBlock type="input_request" value={value} />,

  natal_chart: (_raw, value) => <AstralBlock type="natal_chart" value={value} />,
  match_report: (_raw, value) => <AstralBlock type="match_report" value={value} />,
  muhurta_results: (_raw, value) => <AstralBlock type="muhurta_results" value={value} />,
};

export const responseBlockRegistry = createBlockRegistry<BlockHandler>(handlers, {
  surface: 'response',
});

export interface BlockOutcome {
  /** true when the fence was recognised as a data block and consumed */
  handled: boolean;
  node: ReactNode;
}

/**
 * Decide what a fenced code block becomes.
 *
 * `handled: false` means "this is ordinary code, render it as code". Every
 * other path returns `handled: true` and a node that is either the widget or
 * null — a data block never reaches the user as text.
 */
export function renderCodeBlock(
  lang: string | undefined,
  raw: string,
  ctx: BlockContext,
): BlockOutcome {
  const block = readDataBlock(lang, raw);
  if (!block) {
    // A fence whose language IS a known block type but whose body did not
    // parse: malformed, truncated mid-stream, or a model-invented fence.
    // Swallowed rather than shown — "an unparseable payload renders nothing,
    // never raw JSON" (ASTRAL-15, PH-3 gate).
    if (lang && responseBlockRegistry.has(lang)) return { handled: true, node: null };
    return { handled: false, node: null };
  }

  const handler = responseBlockRegistry.get(block.type);
  if (!handler) {
    responseBlockRegistry.reportUnknown(block.type);
    return { handled: true, node: null };
  }
  return { handled: true, node: handler(raw, block.value, ctx) };
}
