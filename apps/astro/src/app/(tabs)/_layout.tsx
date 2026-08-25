// The five-tab shell (docs/49 ASTRAL-119, superseding ASTRAL-102).
//
// Home · Insights · AI Chat · Timeline · Profile, and every one of them
// renders real data on the first day — AMB-19 was ruled (a), so N1 and N2
// landed BEFORE this file existed. A shell shipping ahead of them would have
// been a sequencing violation rather than a smaller shell, and
// `lib/__tests__/tabs.test.ts` greps the engine's own node registry to keep
// that honest at build time.
//
// ── the bar is DERIVED, and that is the row ───────────────────────────────
//
// Nothing below is a hard-coded array of five. `visibleTabs()` returns the
// tabs this build's capability map declares, and a capability marked absent
// REMOVES its tab: no bar item, and — through `href: null` — no route to it
// either. Not greyed, not "coming soon". The screens still exist as files
// because expo-router is file-based; what a capability controls is whether
// anything can reach them.
//
// ── why the group is `(tabs)` ─────────────────────────────────────────────
//
// A parenthesised segment is a LAYOUT and not a URL segment, so `/chat` is
// still `/chat` and `/settings` is still `/settings`. Every existing deep
// link, the birth-details handoff, "Ask AI about this match" and the
// server's own "Settings → Credits" pointer keep working unchanged — which
// is the whole reason chat and settings were MOVED into the group rather
// than duplicated beside it.
//
// Onboarding, birth details, Profile, Matches, Preferences, Privacy, Help
// and About stay OUTSIDE the group on purpose: the first two are the arc a
// user rides before the app has anything to show them, and the rest are
// pushed over the bar the way iOS pushes a detail screen.

import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { TabIcon } from '@/components/tab-icons';
import { DECLARED_TABS, visibleTabs } from '@/lib/tabs';
import { tokens } from '@/theme';

export default function TabsLayout() {
  const live = visibleTabs();
  const isLive = (id: string) => live.some((t) => t.id === id);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.palette.accent.interactive,
        tabBarInactiveTintColor: tokens.palette.ink.muted,
        tabBarStyle: {
          backgroundColor: tokens.palette.paper.card,
          borderTopColor: tokens.palette.paper.line,
        },
        tabBarLabelStyle: { ...tokens.type.scale.caption, fontWeight: '600' },
        // Android draws the bar OVER the composer when the keyboard opens;
        // iOS floats it above the keyboard, which is the platform's own
        // behaviour and the one its users expect.
        tabBarHideOnKeyboard: Platform.OS === 'android',
      }}
    >
      {DECLARED_TABS.map((tab) => (
        <Tabs.Screen
          key={tab.id}
          name={tab.route}
          options={
            isLive(tab.id)
              ? {
                  title: tab.label,
                  tabBarIcon: ({ color, size }) => (
                    // `color` is typed `ColorValue` (it may be an opaque
                    // platform color); every value that reaches here is one
                    // of this brand's own hex tokens, so the narrowing is
                    // safe and the fallback keeps a glyph on screen if that
                    // ever stops being true.
                    <TabIcon
                      id={tab.id}
                      name={tab.icon}
                      color={typeof color === 'string' ? color : tokens.palette.ink.muted}
                      size={size}
                    />
                  ),
                }
              : // The absent form. `href: null` takes the tab off the bar AND
                // makes the route unreachable, which is what "removes rather
                // than disables" has to mean for a file-based router.
                { href: null }
          }
        />
      ))}
    </Tabs>
  );
}
