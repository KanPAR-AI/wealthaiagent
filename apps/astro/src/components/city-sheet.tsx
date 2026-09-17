// "Where are you today?" — the typed-city half of docs/49 AMB-25 (owner
// 2026-09-17). Shown when the app has no location permission (or no
// location module in this binary) and the person's place is unknown or
// older than a week. Every suggestion comes from the server's gazetteer
// read (`GET /people/self/places`); tapping one PATCHes `self` and the
// daily card re-keys itself on the new place. Nothing here is a birth fact.

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text,
  TextInput, View,
} from 'react-native';

import { track } from '@/lib/analytics';
import { setCurrentPlace, suggestPlaces, type PlaceSuggestion } from '@/lib/people';
import { tokens } from '@/theme';

export function CitySheet({
  visible, reason, onClose, onSaved,
}: {
  visible: boolean;
  reason: 'no_place' | 'stale_place' | 'change';
  onClose: () => void;
  onSaved: () => void;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PlaceSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!visible) { setQ(''); setHits([]); setError(null); return; }
    track('city_sheet_open', { reason });
  }, [visible, reason]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setHits([]); return; }
    const mine = ++seq.current;
    const t = setTimeout(() => {
      suggestPlaces(query)
        .then((res) => { if (mine === seq.current) setHits(res.places); })
        .catch(() => { if (mine === seq.current) setHits([]); });
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (p: PlaceSuggestion) => {
    setBusy(true);
    setError(null);
    track('city_sheet_pick', { reason });
    setCurrentPlace({ source: 'manual', name: `${p.name}${p.country ? ', ' + p.country : ''}` })
      .then(() => { setBusy(false); onSaved(); })
      .catch((e: unknown) => {
        setBusy(false);
        setError(String((e as Error)?.message ?? e) || 'That city could not be saved.');
      });
  };

  const title = reason === 'stale_place' ? 'Still in the same city?' : 'Where are you today?';
  const body = reason === 'stale_place'
    ? 'Your day is cast for where you are. Pick your city if it has changed.'
    : 'Your day — sunrise, Rahu Kaal, the golden hours — is cast for where you are, not where you were born.';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.scrim}>
        <View style={s.sheet}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.body}>{body}</Text>
          <TextInput
            style={s.input}
            value={q}
            onChangeText={setQ}
            placeholder="Start typing your city"
            placeholderTextColor={tokens.palette.ink.muted}
            autoFocus
            autoCorrect={false}
            autoCapitalize="words"
            accessibilityLabel="Your city"
          />
          {hits.length ? (
            <FlatList
              data={hits}
              keyExtractor={(p) => `${p.name}|${p.country}|${p.latitude}`}
              keyboardShouldPersistTaps="handled"
              style={s.list}
              renderItem={({ item }) => (
                <Pressable
                  style={s.hit}
                  onPress={() => pick(item)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${item.country}`}
                >
                  <Text style={s.hitName}>{item.name}</Text>
                  <Text style={s.hitMeta}>{item.country}{item.timezone ? ` · ${item.timezone}` : ''}</Text>
                </Pressable>
              )}
            />
          ) : q.trim().length >= 2 && !busy ? (
            <Text style={s.hitMeta}>No city starts with that — try another spelling.</Text>
          ) : null}
          {busy ? <ActivityIndicator color={tokens.palette.accent.interactive} /> : null}
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Pressable style={s.later} onPress={onClose} accessibilityRole="button" accessibilityLabel="Not now">
            <Text style={s.laterText}>{reason === 'change' ? 'Cancel' : 'Not now'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const t = tokens;
const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: t.palette.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: t.palette.paper.base,
    borderTopLeftRadius: t.radius.card,
    borderTopRightRadius: t.radius.card,
    padding: t.space(5),
    gap: t.space(3),
    maxHeight: '80%',
  },
  title: { ...t.type.scale.title, ...t.type.display, color: t.palette.ink.primary },
  body: { ...t.type.scale.sub, color: t.palette.ink.secondary },
  input: {
    ...t.type.scale.body,
    color: t.palette.ink.primary,
    backgroundColor: t.palette.paper.card,
    borderWidth: 1,
    borderColor: t.palette.paper.line,
    borderRadius: t.radius.input,
    paddingVertical: t.space(3),
    paddingHorizontal: t.space(4),
  },
  list: { maxHeight: 260 },
  hit: { paddingVertical: t.space(3), borderBottomWidth: 1, borderBottomColor: t.palette.paper.line },
  hitName: { ...t.type.scale.lead, color: t.palette.ink.primary },
  hitMeta: { ...t.type.scale.caption, color: t.palette.ink.muted },
  error: { ...t.type.scale.caption, color: t.palette.danger },
  later: { alignSelf: 'center', paddingVertical: t.space(2) },
  laterText: { ...t.type.scale.sub, color: t.palette.accent.interactive, fontWeight: '600' },
});
