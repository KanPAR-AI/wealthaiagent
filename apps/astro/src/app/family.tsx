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

import { router, useFocusEffect } from 'expo-router';
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
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChevronLeft, SymbolIcon } from '@/components/glyphs';
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
  memberNameProblem,
  type CircleMemberView,
  type Kinship,
} from '@/lib/family-view';
import { useEditOutcome } from '@/lib/edit-outcome';
import {
  deletePerson,
  fetchPeople,
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
  // The add flow, in two steps on this screen: pick the relation, then type
  // the name. Both are LABELS — this screen still cannot write a birth fact,
  // and the details themselves are collected by the engine's own card.
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState<Kinship | null>(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  // The receipt the details screen leaves behind — the ENGINE's sentence,
  // never one composed here (the Profile pattern, `lib/edit-outcome.ts`).
  const outcome = useEditOutcome((s) => s.outcome);
  const outcomeFailed = useEditOutcome((s) => s.failed);
  const clearOutcome = useEditOutcome((s) => s.clear);

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
  // Coming BACK from the details flow (docs/71 §10): the member was minted
  // and labelled by the engine a moment ago, so the list on screen is one
  // read out of date. Gated on the receipt so an ordinary tab switch does
  // not re-fetch — the Profile pattern, same store, same reason.
  useFocusEffect(
    useCallback(() => {
      if (useEditOutcome.getState().outcome) read();
    }, [read]),
  );
  // The receipt is for the return trip only.
  useEffect(() => () => clearOutcome(), [clearOutcome]);

  const members = people ? circleMembers(people) : [];
  const room = circleRoom(members);

  // THE KINSHIP PATCH IS GONE FROM THIS SCREEN (docs/71 §10), and its absence
  // is the change. It existed for one caller: the add flow, which had to
  // label a person the engine had already minted without one — the guess
  // Role-3 caught mislabelling a stranger (§8). `reconcile` stamps the
  // kinship now, on the person it minted, so there is nothing here to send.
  // `PATCH /people/{id}` itself is untouched and still pinned by
  // `tests/test_people_api.py`; this screen simply no longer calls it.

  /**
   * "+ Add a family member" — docs/71 §10, and the owner's sentence it comes
   * from: "while adding a member to family it's not necessary to go to chat".
   *
   * The relation and the name are collected HERE, both labels. The route
   * carries them plus the engine's own opening sentence; the details screen
   * runs the rest and comes back. THE USER NEVER SEES A CHAT, the engine
   * stamps the kinship itself when reconcile mints the person, and this
   * screen no longer guesses who was just added.
   */
  const add = useCallback((kinship: Kinship, who: string) => {
    const problem = memberNameProblem(who);
    if (problem) { setNameError(problem); return; }
    const route = addMemberRoute(kinship, who);
    // Null means this build cannot compose a sentence the engine parses
    // back. Better to say nothing happened than to send one it cannot read.
    if (!route) { setNameError(memberNameProblem(who) ?? 'I can’t open that.'); return; }
    track('family_add_opened', { kinship });
    setAdding(null);
    setPicking(false);
    setName('');
    setNameError(null);
    router.push(route as never);
  }, []);

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

          {outcome ? (
            <View style={outcomeFailed ? s.noticeBad : s.notice}>
              <SymbolIcon
                name={outcomeFailed ? 'exclamationmark.triangle' : 'checkmark.circle'}
                size={tokens.size.icon}
                color={outcomeFailed ? tokens.palette.danger
                                     : tokens.palette.accent.ceremonial}
              />
              <Text style={s.noticeText}>{outcome}</Text>
            </View>
          ) : null}

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
                adding ? (
                  /* Step two: their NAME. Asked here, with the relation, so
                     the engine holds it from the first turn — which is what
                     lets the details screen say "Casting Aarav's chart…"
                     instead of asking for it again inside a chat. */
                  <View style={s.card}>
                    <View style={s.cardBody}>
                      <Text style={s.sentence}>
                        What should I call your {KINSHIP_LABEL[adding].toLowerCase()}?
                      </Text>
                      <TextInput
                        value={name}
                        onChangeText={(v) => { setName(v); setNameError(null); }}
                        placeholder="Their name"
                        placeholderTextColor={tokens.palette.ink.onCosmicMuted}
                        style={s.input}
                        autoFocus
                        autoCapitalize="words"
                        returnKeyType="next"
                        accessibilityLabel="Their name"
                        onSubmitEditing={() => add(adding, name)}
                      />
                      {nameError ? (
                        <Text style={s.muted}>{nameError}</Text>
                      ) : null}
                      <View style={s.chips}>
                        <Pressable
                          style={s.cta}
                          accessibilityRole="button"
                          accessibilityLabel="Add their birth details"
                          onPress={() => add(adding, name)}
                        >
                          <Text style={s.ctaText}>Next</Text>
                        </Pressable>
                        <Pressable
                          style={s.chip}
                          accessibilityRole="button"
                          accessibilityLabel="Cancel"
                          onPress={() => { setAdding(null); setName(''); setNameError(null); }}
                        >
                          <Text style={s.chipText}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ) : picking ? (
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
                            onPress={() => { setPicking(false); setAdding(k); }}
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
  input: {
    ...t.type.scale.body,
    color: t.palette.ink.onCosmic,
    backgroundColor: t.palette.cosmic.deep,
    borderRadius: t.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.palette.cosmic.line,
    paddingHorizontal: t.space(3),
    paddingVertical: t.space(3),
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.space(3),
    backgroundColor: t.palette.cosmic.card,
    borderRadius: t.radius.card,
    borderLeftWidth: 3,
    borderLeftColor: t.palette.accent.ceremonial,
    padding: t.space(4),
  },
  noticeBad: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.space(3),
    backgroundColor: t.palette.cosmic.card,
    borderRadius: t.radius.card,
    borderLeftWidth: 3,
    borderLeftColor: t.palette.danger,
    padding: t.space(4),
  },
  noticeText: { ...t.type.scale.body, color: t.palette.ink.onCosmic, flex: 1 },
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
