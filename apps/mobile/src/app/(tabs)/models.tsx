// Model tier picker — tap the header chip to choose how questions are answered.
// Auto (smart default) / Fast (cheap) / Deep (most capable, more credits).
// Sets selectedModelTier in the shared core chat store; use-send-message
// forwards it as model_tier and the backend maps it to a concrete model.

import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChatStore } from '@wealthai/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';

const TIERS = [
  { id: 'auto', name: 'Auto', hint: 'Recommended', desc: 'Smart routing — picks the best model for each question automatically.' },
  { id: 'fast', name: 'Fast', hint: '~1× credits', desc: 'Quick and economical. Great for everyday questions.' },
  { id: 'deep', name: 'Deep', hint: '~4× credits', desc: 'Most capable model, for hard or high-stakes questions. Costs noticeably more credits per answer.' },
];

export default function ModelsScreen() {
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const selected = useChatStore((s) => s.selectedModelTier) || 'auto';
  const setTier = useChatStore((s) => s.setSelectedModelTier);

  const choose = (id: string) => {
    if (id === 'deep' && selected !== 'deep') {
      Alert.alert(
        'Use Deep model?',
        'Deep uses the most capable model and consumes ~4× more credits per answer. Use it for hard questions; switch back to Auto/Fast for everyday chats.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Use Deep', onPress: () => { setTier('deep'); router.back(); } },
        ],
      );
      return;
    }
    setTier(id);
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <ThemedText type="title" style={styles.back}>‹</ThemedText>
          </Pressable>
          <ThemedText type="subtitle">Response model</ThemedText>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.list}>
          {TIERS.map((t) => {
            const active = selected === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => choose(t.id)}
                style={({ pressed }) => [
                  styles.row,
                  { borderColor: active ? colors.text : colors.backgroundElement },
                  pressed && { backgroundColor: colors.backgroundElement },
                ]}>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <ThemedText type="smallBold">{t.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">{t.hint}</ThemedText>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>{t.desc}</ThemedText>
                </View>
                {active && <ThemedText style={{ marginLeft: 10 }}>✓</ThemedText>}
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { fontSize: 30, lineHeight: 30 },
  list: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 14 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
