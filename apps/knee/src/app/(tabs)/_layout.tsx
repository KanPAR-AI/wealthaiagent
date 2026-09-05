// The five-tab shell, DERIVED — the astro mechanism verbatim (see its
// (tabs)/_layout.tsx): `visibleTabs()` returns what this build's capability
// map declares, and an absent capability REMOVES its tab — no bar item, and
// through `href: null` no route to it either.

import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { TabIcon } from '@/components/tab-icons';
import { getLang, subscribeLang, t } from '@/lib/i18n';
import { DECLARED_TABS, visibleTabs } from '@/lib/tabs';
import { tokens } from '@/theme';

export default function TabsLayout() {
  // Tab labels follow the language setting like every other label.
  const [lang, setLangState] = useState(getLang());
  useEffect(() => subscribeLang(setLangState), []);
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
                  title: t(`tab.${tab.id}`, lang),
                  tabBarIcon: ({ color, size }) => (
                    <TabIcon
                      id={tab.id}
                      color={typeof color === 'string' ? color : tokens.palette.ink.muted}
                      size={size}
                    />
                  ),
                }
              : { href: null }
          }
        />
      ))}
    </Tabs>
  );
}
