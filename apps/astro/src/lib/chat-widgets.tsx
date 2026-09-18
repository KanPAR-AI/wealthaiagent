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
import { useEffect } from 'react';

import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { track } from '@/lib/analytics';
import { parseReadingHandoff } from '@/lib/chat-handoff';
import { parseSubjectBlock, subjectStore } from '@/lib/subject-view';
import { tokens } from '@/theme';

/** natal_chart, match_report, muhurta_results, input_request, … — whatever
 *  the one binding can draw. */
const astralHandlers: Record<string, ChatWidgetHandler> = Object.fromEntries(
  astralBlockRegistry.types().map((type) => [
    type,
    ((data) => <AstralBlock type={type} data={data} />) as ChatWidgetHandler,
  ]),
);

// docs/60 SL-4: the engine ends every astrology turn with its reading
// subject. The block draws NOTHING — it feeds the chip on the chat screen
// through the subject store, so the chip renders engine state, never a
// client guess (the client derives nothing).
function SubjectSink({ data }: { data: unknown }) {
  useEffect(() => {
    const s = parseSubjectBlock(data);
    if (s) subjectStore.set(s);
  }, [data]);
  return null;
}

// Bug bcadc9f2 (owner 2026-09-18): "read for them in a new chat". The
// engine held a stranger's details in a chat that already has history and
// handed over the sentence; the tap opens a FRESH conversation and sends
// it there (the same handoff the match door uses). A tap, not an auto-jump:
// the transcript re-renders this block every time the old chat is opened,
// and a card that navigated on its own would keep dragging the reader out.
function ReadingHandoffCard({ data }: { data: unknown }) {
  const h = parseReadingHandoff(data);
  if (!h) return null;
  return (
    <View style={hs.card}>
      <Text style={hs.title}>Read for {h.who} in a new chat</Text>
      <Text style={hs.body}>This chat stays yours. Their reading starts fresh, from the details you just gave.</Text>
      <Pressable
        style={hs.cta}
        accessibilityRole="button"
        accessibilityLabel={`Start a new chat for ${h.who}`}
        onPress={() => {
          track('chat_reading_handoff', { who: h.who === 'that person' ? 'unnamed' : 'named' });
          router.push({ pathname: '/chat', params: { pending: h.turn, fresh: '1', handoffKey: String(Date.now()), ...(h.standalone ? { standalone: '1' } : {}) } });
        }}
      >
        <Text style={hs.ctaText}>Start their reading</Text>
      </Pressable>
    </View>
  );
}

const hs = StyleSheet.create({
  card: {
    marginVertical: tokens.space(2),
    padding: tokens.space(4),
    borderRadius: tokens.radius.card,
    backgroundColor: tokens.palette.cosmic.card,
    borderWidth: 1,
    borderColor: tokens.palette.cosmic.line,
    gap: tokens.space(2),
  },
  title: { ...tokens.type.scale.label, color: tokens.palette.ink.onCosmic, fontWeight: '700' },
  body: { ...tokens.type.scale.sub, color: tokens.palette.ink.onCosmicMuted },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.palette.accent.ceremonial,
    borderRadius: tokens.radius.button,
    paddingVertical: tokens.space(2.5),
    paddingHorizontal: tokens.space(5),
  },
  ctaText: { ...tokens.type.scale.sub, color: tokens.palette.accent.ceremonialInk, fontWeight: '700' },
});

export const astroWidgetRegistry = createBlockRegistry<ChatWidgetHandler>(
  {
    // The three any chat has — the engine's follow-up chips among them, from
    // the shared surface rather than special-cased in this app's screen the
    // way they were in build 7.
    ...sharedWidgetHandlers,
    ...astralHandlers,
    reading_subject: ((data) => <SubjectSink data={data} />) as ChatWidgetHandler,
    reading_handoff: ((data) => <ReadingHandoffCard data={data} />) as ChatWidgetHandler,
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
