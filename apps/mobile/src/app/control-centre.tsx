// Control Centre — mobile surface of the Memory OS (read-only v1).
// Overview counts + hybrid search + browse over the caller's OWN memory,
// all values verbatim from the engine (the screen labels, never computes).
// Mutations (correct/forget) stay on the web Control Centre for now.

import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import {
  getOverview, listMemories, searchMemories,
  type MemoryOverview, type MemoryRecord, type MemoryStatus, type SourceType,
} from '@/services/memory-service';

type Palette = ReturnType<typeof useTheme>;

// Display labels only — semantics stay the engine's (memory-spec).
const SOURCE_LABEL: Record<SourceType, string> = {
  user_explicit: 'Explicit',
  user_observed: 'Observed',
  tool_verified: 'Tool-verified',
  document_verified: 'Doc-verified',
  agent_inference: 'Inferred',
  episode_consolidation: 'Consolidated',
  system: 'System',
};

const STATUS_GLYPH: Record<MemoryStatus, string> = {
  active: '●', superseded: '↻', expired: '◌', disputed: '⚠', deleted: '✕',
};

// Spec buckets: High ≥.90, Medium .70–.89, Low <.70 — label only, no reranking.
function confidenceBucket(c: number): string {
  if (c >= 0.9) return 'High';
  if (c >= 0.7) return 'Medium';
  return 'Low';
}

function asText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function memoryLabel(m: MemoryRecord): string {
  if (m.text) return m.text;
  const composed = [m.subject?.text, m.predicate].filter(Boolean).join(' ');
  return composed || m.namespace;
}

function shortDate(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(); } catch { return ''; }
}

interface Row {
  memory: MemoryRecord;
  matchReason?: string;
}

/**
 * Turn a thrown error into something a person should read.
 *
 * `e.message` here is whatever the network layer threw, and on iOS that is
 * "UnexpectedException: Could not connect to the server. (at
 * ExpoModulesCore/Promise.swift:56)" — a Swift source path, shown to a user
 * who wanted to look at their memories. The raw text still goes to the log,
 * where it is useful; the screen gets the sentence that tells them what to do.
 */
function humanError(e: any, fallback: string): string {
  const raw = String(e?.message ?? e ?? '');
  console.warn('[control-centre]', raw);
  if (/could not connect|network request failed|timeout|timed out/i.test(raw)) {
    return "Can't reach the server — check your connection and try again.";
  }
  return fallback;
}

export default function ControlCentreScreen() {
  const router = useRouter();
  const colors = useTheme();

  const [overview, setOverview] = useState<MemoryOverview | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const searchSeq = useRef(0);

  const browse = useCallback(async () => {
    const seq = ++searchSeq.current;
    setError(null);
    try {
      const [ov, list] = await Promise.all([getOverview(), listMemories()]);
      if (seq !== searchSeq.current) return;
      setOverview(ov);
      setRows(list.memories.map((memory) => ({ memory })));
    } catch (e: any) {
      if (seq !== searchSeq.current) return;
      setError(humanError(e, 'Could not load your memory.'));
    }
  }, []);

  const runSearch = useCallback(async (text: string) => {
    const seq = ++searchSeq.current;
    setError(null);
    try {
      const res = await searchMemories(text);
      if (seq !== searchSeq.current) return;
      const seen = new Set<string>();
      const merged: Row[] = [];
      for (const r of [...res.pinned, ...res.results]) {
        if (seen.has(r.memory.id)) continue;
        seen.add(r.memory.id);
        merged.push({ memory: r.memory, matchReason: r.retrieval_reason });
      }
      setRows(merged);
    } catch (e: any) {
      if (seq !== searchSeq.current) return;
      setError(humanError(e, 'Search failed.'));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    browse().finally(() => setLoading(false));
  }, [browse]);

  // Debounced search; empty query returns to browse mode.
  useEffect(() => {
    const text = query.trim();
    const t = setTimeout(() => {
      if (text) runSearch(text);
      else browse();
    }, 400);
    return () => clearTimeout(t);
  }, [query, runSearch, browse]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const text = query.trim();
    await (text ? runSearch(text) : browse());
    setRefreshing(false);
  }, [query, runSearch, browse]);

  const searching = query.trim().length > 0;

  const renderHeader = () => (
    <View>
      {overview && !searching && (
        <View style={styles.statsRow}>
          <Stat label="Active" value={overview.active_count} colors={colors} />
          <Stat label="Inferred" value={overview.inferred_count} colors={colors} />
          <Stat label="New this week" value={overview.new_this_week} colors={colors} />
          <Stat label="Disputed" value={overview.disputed_count} colors={colors} />
        </View>
      )}
      {error && (
        <View style={[styles.errorBox, { backgroundColor: colors.backgroundElement }]}>
          <ThemedText type="small" style={styles.errorText}>⚠ {error}</ThemedText>
          <Pressable onPress={onRefresh} hitSlop={8}>
            <ThemedText type="smallBold">Retry</ThemedText>
          </Pressable>
        </View>
      )}
      <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
        {searching ? 'MATCHES' : 'YOUR MEMORIES'}
      </ThemedText>
    </View>
  );

  const renderItem = ({ item }: { item: Row }) => {
    const m = item.memory;
    const expanded = expandedId === m.id;
    const explicit = m.source_type === 'user_explicit';
    return (
      <Pressable
        onPress={() => setExpandedId(expanded ? null : m.id)}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.backgroundElement },
          pressed && { backgroundColor: colors.backgroundSelected },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Memory: ${memoryLabel(m)}, status ${m.status}`}
      >
        <ThemedText type="smallBold" numberOfLines={expanded ? undefined : 2}>
          {memoryLabel(m)}
        </ThemedText>
        {!!asText(m.value) && asText(m.value) !== memoryLabel(m) && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={expanded ? undefined : 1}>
            {asText(m.value)}
          </ThemedText>
        )}
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.badge,
              explicit
                ? { backgroundColor: colors.backgroundSelected }
                : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.textSecondary },
            ]}
          >
            <ThemedText type="small" themeColor={explicit ? 'text' : 'textSecondary'}>
              {SOURCE_LABEL[m.source_type] ?? m.source_type}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {STATUS_GLYPH[m.status] ?? ''} {m.status}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {confidenceBucket(m.confidence)} confidence
          </ThemedText>
          {m.pinned && <ThemedText type="small" themeColor="textSecondary">📌</ThemedText>}
        </View>
        {item.matchReason && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.matchReason}>
            ↳ {item.matchReason}
          </ThemedText>
        )}
        {expanded && (
          <View style={styles.detail}>
            <DetailRow k="Domain" v={`${m.namespace} · ${m.type}`} />
            {(m.valid_from || m.valid_until) && (
              <DetailRow
                k="Valid"
                v={`${shortDate(m.valid_from) || '…'} → ${shortDate(m.valid_until) || 'now'}`}
              />
            )}
            <DetailRow k="Accessed" v={`${m.access_count}×`} />
            {!!m.updated_at && <DetailRow k="Updated" v={shortDate(m.updated_at)} />}
            {Object.entries(m.qualifiers || {}).map(([k, v]) => (
              <DetailRow key={k} k={k} v={v} />
            ))}
            <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 6 }}>
              To correct or forget this memory, use the web Control Centre.
            </ThemedText>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <ThemedText type="title" style={styles.back}>‹</ThemedText>
          </Pressable>
          <ThemedText type="subtitle">Control Centre</ThemedText>
          <View style={{ width: 24 }} />
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search your memory…"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={[
            styles.search,
            { backgroundColor: colors.backgroundElement, color: colors.text },
          ]}
          accessibilityLabel="Search your memory"
        />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlashList
            data={rows}
            keyExtractor={(r) => r.memory.id}
            renderItem={renderItem}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={
              <View style={styles.center}>
                <ThemedText type="small" themeColor="textSecondary">
                  {/* An empty list after a FAILED fetch means we could not ask,
                      not that there is nothing. Saying "nothing remembered yet"
                      there states a fact we do not have — the same shape as the
                      backend defects this project keeps finding, in UI form. */}
                  {error
                    ? 'Your memories could not be loaded.'
                    : searching
                      ? 'No memories match that search.'
                      : 'Nothing remembered yet — memories appear here as you chat.'}
                </ThemedText>
              </View>
            }
            refreshing={refreshing}
            onRefresh={onRefresh}
            contentContainerStyle={styles.listContent}
            extraData={expandedId}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function Stat({ label, value, colors }: { label: string; value: number; colors: Palette }) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.backgroundElement }]}>
      <ThemedText type="subtitle">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

function DetailRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText type="small" themeColor="textSecondary" style={{ width: 90 }}>
        {k}
      </ThemedText>
      <ThemedText type="small" style={{ flex: 1 }}>
        {v}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { width: 24, marginTop: -4 },
  search: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    fontSize: 15,
  },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  stat: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  sectionLabel: { marginTop: 18, marginBottom: 8, letterSpacing: 1 },
  card: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  matchReason: { marginTop: 6 },
  detail: { marginTop: 10, gap: 4 },
  detailRow: { flexDirection: 'row' },
  errorBox: {
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // The message must SHRINK; without this the row lays both children out at
    // their natural width and a long error pushes Retry off the screen edge,
    // which is exactly when the user most needs to press it.
    gap: 12,
  },
  errorText: { flex: 1, flexShrink: 1 },
  center: { alignItems: 'center', paddingVertical: 40 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
});
