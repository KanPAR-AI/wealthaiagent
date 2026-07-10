// Agent picker — tap the header title to open, pick an agent (or Smart
// routing) for subsequent messages. Mirrors the web header's selector:
// same GET /agents/available list, same selectedAgent slot in the SHARED
// core chat store (use-send-message already forwards it as force_agent).

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchAvailableAgents, useChatStore, type AgentOption } from '@wealthai/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { getToken } from '@/lib/auth';

const SMART_ROUTING: AgentOption = {
  id: '',
  name: 'Smart routing',
  description: 'Automatically pick the best agent for each message',
};

export default function AgentsScreen() {
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const selectedAgent = useChatStore((s) => s.selectedAgent);
  const setSelectedAgent = useChatStore((s) => s.setSelectedAgent);

  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        setAgents(await fetchAvailableAgents(token));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pick = (id: string) => {
    setSelectedAgent(id || null);
    router.back();
  };

  const data = [SMART_ROUTING, ...agents];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="link">‹ Back</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">Choose agent</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.textSecondary} />
          </View>
        ) : (
          <FlashList
            data={data}
            keyExtractor={(a) => a.id || 'auto'}
            renderItem={({ item }) => {
              const isSelected = (selectedAgent || '') === item.id;
              return (
                <Pressable
                  onPress={() => pick(item.id)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderBottomColor: colors.backgroundElement },
                    (pressed || isSelected) && { backgroundColor: colors.backgroundElement },
                  ]}>
                  <View style={styles.rowText}>
                    <ThemedText>
                      {item.icon ? `${item.icon} ` : ''}{item.name}
                      {isSelected ? '  ✓' : ''}
                    </ThemedText>
                    {item.description ? (
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {item.description}
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSpacer: { width: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { gap: 2 },
});
