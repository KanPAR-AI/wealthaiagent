// Frame 2's three row glyphs (docs/astral-board/02-birth-details.png).
//
// The board draws a calendar, a clock and a pin INSIDE each field box at its
// trailing edge. They live here, in the app, for the reason `@wealthai/astral`
// has no icons at all: an icon set is a brand asset, and a shared component
// that shipped one would be choosing a look for every brand that renders it.
// The shared widget takes them as nodes and puts them where that host's
// chrome has room (docs/49 ASTRAL-104).
//
// Keyed by the ENGINE's field `kind`, so one map covers every date, time and
// place field the engine can ask for — the birth-details screen, the birth-
// time ask mid-chat, and a partner's three fields in matching — rather than
// being hand-listed per ask and going stale when a new one appears.

import type { ReactNode } from 'react';

import { SymbolIcon } from '@/components/glyphs';
import { tokens } from '@/theme';

export const FIELD_ICONS: Record<string, ReactNode> = {
  date: <SymbolIcon name="calendar" color={tokens.palette.ink.muted} />,
  time: <SymbolIcon name="clock" color={tokens.palette.ink.muted} />,
  place: <SymbolIcon name="mappin.and.ellipse" color={tokens.palette.ink.muted} />,
};
