// This app's WIDGET SET — allowance (b) of the owner's one-surface ruling
// (docs/49 ASTRAL-105) — dispatched through a REGISTRY keyed by type
// (docs/49 ASTRAL-20).
//
// Short, because that is the point: the surface is shared, and what this
// brand adds to it is the ASTRAL BLOCKS. They are not listed here either —
// they are DERIVED from the shared React Native binding's own registry, so a
// block type added to `@wealthai/astral-native` is drawn by this app the day
// it exists rather than the day somebody remembers to add a line.
//
// Three outcomes, and the third is why this file exists at all: a registered
// type draws its view; an unparseable payload draws NOTHING; an UNREGISTERED
// type draws nothing and says so once, by name. What never happens is raw
// JSON on a user's screen — which is what shipped for months when the client
// dropped three computed block types silently (§5a-0).

import { createBlockRegistry } from '@wealthai/astral';
import { AstralBlock, astralBlockRegistry } from '@wealthai/astral-native';
import {
  sharedWidgetHandlers,
  type ChatTheme,
  type ChatWidgetHandler,
} from '@wealthai/chat-native';
import type { Widget } from '@wealthai/core';

/** natal_chart, match_report, muhurta_results, input_request, … — whatever
 *  the one binding can draw. */
const astralHandlers: Record<string, ChatWidgetHandler> = Object.fromEntries(
  astralBlockRegistry.types().map((type) => [
    type,
    ((data) => <AstralBlock type={type} data={data} />) as ChatWidgetHandler,
  ]),
);

export const astroWidgetRegistry = createBlockRegistry<ChatWidgetHandler>(
  {
    // The three any chat has — the engine's follow-up chips among them, from
    // the shared surface rather than special-cased in this app's screen the
    // way they were in build 7.
    ...sharedWidgetHandlers,
    ...astralHandlers,
  },
  { surface: 'astro-chat' },
);

/** The block types this build can draw, asked for rather than restated.
 *
 *  Handed to the transcript so a TRAILING half-written fence is withheld
 *  until it closes: the seconds between "```natal_chart" and its closing
 *  fence are not seconds of raw JSON scrolling past the reader. */
export const ASTRO_DATA_LANGUAGES = astroWidgetRegistry.types();

export function AstroWidget({ widget, theme }: { widget: Widget; theme: ChatTheme }) {
  const type = (widget.type || '').replace(/^widget_/, '');
  const data: any = widget.data ?? widget;

  const handler = astroWidgetRegistry.get(type);
  if (handler) return handler(data, widget, theme);

  // No "coming soon" chip here: this app has no deferred set, and a friendly
  // label for a type nobody declared is how an unknown block stops being
  // noticed.
  astroWidgetRegistry.reportUnknown(type);
  return null;
}
