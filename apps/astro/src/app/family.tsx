// Your family — the Circle (docs/71 PH-33, ASTRAL-282/286/287/288/289).
//
// ONE READ SERVES THIS SCREEN. `GET /people` carries every row's kinship,
// whether it puts them in the circle, their `tob_known` and the STAMPED
// summary of their chart — status and the date it was cast. There is no
// second read per row, nothing is computed here, and no chart is cast to
// draw a row (ASTRAL-135/282).
//
// WHAT THIS SCREEN MAY NOT DO:
//  · create a person. The engine mints them, through the chat carrier into
//    `reconcile` (INV-1, F24). "+ Add" opens the SHIPPED details flow.
//  · write a birth fact. The only write here is the kinship LABEL PATCH and
//    the Forget DELETE — neither names a date, a time or a place.
//  · decide who is family. `in_circle` is the engine's answer, including
//    for the partner a link names but no document labels yet (ASTRAL-283).
//  · say "everything about them is removed". Palm images are not in the
//    cascade (F7 / ASTRAL-43) and the confirmation says so.
//
// Every rule above lives in `lib/family-view.ts`, which is pure and tested
// at the workspace root. What is left here is layout.

import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChevronLeft } from '@/components/glyphs';
import { SignInGateCard } from '@/components/sign-in-gate';
import { track } from '@/lib/analytics';
import {
  CIRCLE_MAX,
  KINSHIPS,
  KINSHIP_LABEL,
  addMemberRoute,
  circleMembers,
  circleRoom,
  forgetConfirmation,
  pendingAddOutcome,
  type PendingAdd,
  type CircleMemberView,
  type Kinship,
} from '@/lib/family-view';
import {
  deletePerson,
  fetchPeople,
  setKinship,
  type PersonView,
} from '@/lib/people';
import { turnForPerson } from '@/lib/subject-view';
import { routeIsLive } from '@/lib/tabs';
import { useReadingBlocked } from '@/lib/use-account';
import { tokens } from '@/theme';

export default function Family() {
  const { blocked, resolved } = useReadingBlocked();
  const [people, setPeople] = useState<PersonView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  // Capability law: a build without `family` has no route here, so a deep
  // link or a stale push leaves rather than rendering a screen this build
  // cannot serve (the `chart.tsx` pattern).
  useEffect(() => {
    if (!routeIsLive('/family')) router.replace('/home');
  }, []);

  const read = useCallback(() => {
    if (blocked) { setBusy(false); return; }
    setBusy(true);
    setError(null);
    fetchPeople()
      .then((res) => {
        setPeople(res.people);
        track('family_shown', { members: circleMembers(res.people).length });
      })
      // "Nobody in your circle" and "the read failed" are different
      // sentences, and this screen says the right one because this throws.
      .catch((e: any) => setError(String(e?.message ?? e)))
      .finally(() => setBusy(false));
     
  }, [blocked]);

  useEffect(read, [read]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (resolved && !blocked) read(); }, [resolved, blocked]);

  const members = people ? circleMembers(people) : [];
  const room = circleRoom(members);

  /**
   * The kinship label, on the SHIPPED `PATCH /people/{id}`.
   *
   * The server refuses a kinship on `self`, an unknown term and a fifth
   * member — each with 422 and a sentence. This screen shows that sentence
   * rather than pre-empting it with a rule of its own.
   */
  const label = useCallback((personId: string, kinship: Kinship) => {
    setRowBusy(personId);
    setKinship(personId, kinship)
      .then(() => { track('family_kinship_set', { kinship }); read(); })
      .catch((e: any) => setError(String(e?.message ?? e)))
      .finally(() => setRowBusy(null));
  }, [read]);

  /**
   * "+ Add a family member" — the shipped details flow, plus one label.
   *
   * The opening sentence is the engine's own adhoc cue; the arc collects
   * the birth details through `input_request` → `input_response` →
   * `reconcile` and OFFERS to keep the person, and the person it mints is
   * a `friend` (F115). Coming back here, the screen finds the one new
   * kinship-less person and sends the single label PATCH.
   */
  const add = useCallback((kinship: Kinship) => {
    setPicking(false);
    track('family_add_opened', { kinship });
    const known = (people ?? []).map((p) => p.id);
    pendingAdd = { kinship, known, at: Date.now() };
    router.push(addMemberRoute(kinship) as never);
  }, [people]);

  // On return from the details flow: label whoever the engine just minted —
  // and, just as importantly, DROP the intent when the flow was abandoned.
  // The decision is pure (`pendingAddOutcome`) so the abandon path has a test;
  // this screen only carries it out. Gated on a SETTLED read (`!busy`), or a
  // half-loaded list would read as "abandoned".
  useEffect(() => {
    const outcome = pendingAddOutcome(pendingAdd, people, !busy, Date.now());
    if (outcome.action === 'wait') return;
    pendingAdd = null;
    if (outcome.action === 'discard') {
      track('family_add_dropped', { reason: outcome.reason });
      return;
    }
    label(outcome.personId, outcome.kinship);
  }, [people, busy, label]);

  /** ASTRAL-287: the shipped cascade, and the sentence about its gap. */
  const forget = useCallback((m: CircleMemberView) => {
    Alert.alert('Forget this person?', forgetConfirmation(m.name), [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Forget',
        style: 'destructive',
        onPress: () => {
          setRowBusy(m.personId);
          deletePerson(m.personId)
            .then((res) => {
              track('family_forget');
              // The engine's own sentence about what it did NOT remove.
              if (res.not_covered) Alert.alert('Forgotten', res.not_covered);
              read();
            })
            .catch((e: any) => setError(String(e?.message ?? e)))
            .finally(() => setRowBusy(null));
        },
      },
    ]);
  }, [read]);

  return (
    <View style={s.fill}>
      <StatusBar style="light" />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
            style={s.back}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={10}
          >
            <ChevronLeft size={tokens.size.icon} color={tokens.palette.ink.onCosmic} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={busy && !!people} onRefresh={read} />}
        >
          <Text style={s.title}>Your family</Text>

          {resolved && blocked ? <SignInGateCard /> : null}

          {blocked ? null : busy && !people ? (
            <ActivityIndicator color={tokens.palette.accent.ceremonial} />
          ) : error ? (
            <View style={s.gap}>
              <Text style={s.sentence}>I could not read your circle just now. {error}</Text>
              <Pressable style={s.cta} onPress={read} accessibilityRole="button" accessibilityLabel="Try again">
                <Text style={s.ctaText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.gap}>
              {members.length === 0 ? (
                <Text style={s.sentence}>
                  Nobody is in your circle yet. Add the people you actually ask
                  about — their day sits beside yours on Home.
                </Text>
              ) : null}

              {members.map((m) => (
                <View key={m.personId} style={s.card}>
                  <View style={s.cardBody}>
                    <View style={s.rowHead}>
                      <View style={s.rowName}>
                        <Text style={s.name}>{m.name}</Text>
                        <Text style={s.kin}>
                          {m.kinshipLabel}
                          {m.kinshipSource === 'link' ? ' · from your partner link' : ''}
                        </Text>
                      </View>
                      {rowBusy === m.personId ? (
                        <ActivityIndicator color={tokens.palette.accent.ceremonial} />
                      ) : null}
                    </View>

                    {/* Every row says its honest chart state — never a
                        blank, never a spinner standing in for a sentence. */}
                    <Text style={s.sentence}>{m.chartLine}</Text>
                    {m.timeKnown ? null : (
                      <Text style={s.muted}>Their birth time is not on file.</Text>
                    )}

                    <View style={s.chips}>
                      {m.needsChart ? (
                        <Pressable
                          style={s.chip}
                          accessibilityRole="button"
                          accessibilityLabel={`Cast ${m.name}'s chart`}
                          onPress={() => {
                            track('family_cast_chart');
                            router.push({
                              pathname: '/chat',
                              params: { pending: turnForPerson(m.name), fresh: '1',
                                        handoffKey: String(Date.now()) },
                            });
                          }}
                        >
                          <Text style={s.chipText}>Cast their chart</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={s.chip}
                          accessibilityRole="button"
                          accessibilityLabel={`Ask about ${m.name}`}
                          onPress={() => {
                            track('family_ask_about');
                            router.push({
                              pathname: '/chat',
                              params: { pending: turnForPerson(m.name), fresh: '1',
                                        handoffKey: String(Date.now()) },
                            });
                          }}
                        >
                          <Text style={s.chipText}>Ask about {m.name}</Text>
                        </Pressable>
                      )}
                      <Pressable
                        style={s.chip}
                        accessibilityRole="button"
                        accessibilityLabel={`Forget ${m.name}`}
                        onPress={() => forget(m)}
                      >
                        <Text style={s.chipDanger}>Forget</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}

              {room > 0 ? (
                picking ? (
                  <View style={s.card}>
                    <View style={s.cardBody}>
                      <Text style={s.sentence}>Who are they to you?</Text>
                      <View style={s.chips}>
                        {KINSHIPS.map((k) => (
                          <Pressable
                            key={k}
                            style={s.chip}
                            accessibilityRole="button"
                            accessibilityLabel={KINSHIP_LABEL[k]}
                            onPress={() => add(k)}
                          >
                            <Text style={s.chipText}>{KINSHIP_LABEL[k]}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={s.cta}
                    accessibilityRole="button"
                    accessibilityLabel="Add a family member"
                    onPress={() => setPicking(true)}
                  >
                    <Text style={s.ctaText}>+ Add a family member</Text>
                  </Pressable>
                )
              ) : (
                <Text style={s.muted}>
                  Your circle holds {CIRCLE_MAX} people besides you. Forget
                  someone to make room.
                </Text>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** What the user chose before the details flow, who was already on file when
 *  they chose it, and WHEN. Module-level because the screen unmounts while the
 *  flow runs; it holds no birth fact and no person id. The timestamp is what
 *  stops an abandoned intent from labelling a stranger days later — see
 *  `pendingAddOutcome`. */
let pendingAdd: PendingAdd | null = null;

const t = tokens;

const s = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, backgroundColor: t.palette.cosmic.deep },
  header: { flexDirection: 'row', alignItems: 'center' },
  back: { paddingHorizontal: t.space(4), paddingVertical: t.space(2) },
  body: {
    paddingHorizontal: t.space(5),
    paddingTop: t.space(2),
    paddingBottom: t.space(10),
    gap: t.space(3),
  },
  gap: { gap: t.space(2.5) },
  title: { ...t.type.scale.hero, ...t.type.display, color: t.palette.ink.onCosmic },
  sentence: { ...t.type.scale.body, color: t.palette.ink.onCosmic },
  muted: { ...t.type.scale.sub, color: t.palette.ink.onCosmicMuted },
  card: {
    backgroundColor: t.palette.cosmic.card,
    borderRadius: t.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.palette.cosmic.line,
  },
  cardBody: { padding: t.space(4), gap: t.space(2) },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: t.space(3) },
  rowName: { flex: 1, gap: t.space(0.5) },
  name: { ...t.type.scale.lead, color: t.palette.ink.onCosmic },
  kin: { ...t.type.scale.caption, color: t.palette.ink.onCosmicMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space(2) },
  chip: {
    borderRadius: t.radius.chip,
    backgroundColor: t.palette.cosmic.deep,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.palette.cosmic.line,
    paddingHorizontal: t.space(3),
    paddingVertical: t.space(1.5),
  },
  chipText: { ...t.type.scale.label, color: t.palette.ink.onCosmic },
  chipDanger: { ...t.type.scale.label, color: t.palette.accent.ceremonial },
  cta: {
    alignSelf: 'flex-start',
    borderRadius: t.radius.pill,
    backgroundColor: t.palette.accent.interactive,
    paddingHorizontal: t.space(5),
    paddingVertical: t.space(2.5),
  },
  ctaText: { ...t.type.scale.label, color: t.palette.accent.interactiveInk, fontWeight: '700' },
});
