// Profile — `self`, read from the People store (docs/49 ASTRAL-135/136/137/138).
//
// THE FIRST USER-SCOPED READ IN THIS PRODUCT (F23). Until `GET /people` there
// was no way to show a user their own chart outside the turn that computed
// it: `/chats/{id}/state` is chat-scoped and self-described as a debug panel,
// and derived values die with the 24-hour envelope. This screen opens with no
// chat at all.
//
// ── three things this screen may not do ────────────────────────────────────
//
//  1. COMPUTE. Opening it spends no ephemeris second, no model call and no
//     credit (ASTRAL-135). A stale chart is drawn stale WITH the date it was
//     cast (AMB-31 interim (a)); there is no refresh control because there is
//     no recompute endpoint, and a control that cannot do anything is the
//     dead affordance ASTRAL-102 forbids.
//  2. DERIVE. Every value on screen is a field of the stamped artifact
//     (ASTRAL-19). The frame it was cast in is NAMED, because a sidereal
//     value and a tropical one are the same word three signs apart
//     (ASTRAL-118).
//  3. WRITE A FACT. There is no profile-write endpoint and there must not be
//     one (F24). The edit control states what a correction would invalidate
//     and then hands over to the CHAT carrier — `input_request` in, typed
//     `input_response` out, `reconcile` the only writer (INV-1).
//
// Everything the screen decides lives in `lib/profile-view.ts`, which is pure
// and unit-tested at the workspace root. What is left here is layout.

import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChevronLeft, ChevronRight, SymbolIcon } from '@/components/glyphs';
import { track } from '@/lib/analytics';
import {
  fetchEditImpact,
  fetchPriorities,
  fetchSelf,
  type EditImpact,
  type PersonView,
  type PrioritiesResponse,
} from '@/lib/people';
import { summary as prioritySummary } from '@/lib/priorities-view';
import {
  TIME_UNKNOWN_OFFER,
  TIME_UNKNOWN_STATEMENT,
  chartIsReadable,
  chartLines,
  chartState,
  correctionTurn,
  editDisclosure,
  factRows,
  frameLine,
  shouldRecordOffer,
  timeAskState,
  undeterminedNotes,
  type FactRow,
} from '@/lib/profile-view';
import { rememberTimeAskOffered, timeAskAlreadyOffered } from '@/lib/profile-prefs';
import { tokens } from '@/theme';

type Load =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'absent'; reason: string }
  | { phase: 'ready'; person: PersonView };

/** The turn that opens the birth-details arc for a user who has none yet. */
const ESTABLISH_TURN = "I'd like my birth chart.";

export default function Profile() {
  const [load, setLoad] = useState<Load>({ phase: 'loading' });
  const [askOffered, setAskOffered] = useState(true);
  const [pendingEdit, setPendingEdit] = useState<EditImpact | null>(null);
  // Read alongside the profile so the row can say what is set BEFORE the
  // user opens it. A failure here is not fatal: the row falls back to its
  // own label rather than taking the screen down for a preference.
  const [priorities, setPriorities] = useState<PrioritiesResponse | null>(null);
  const [editBusy, setEditBusy] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  const read = useCallback(() => {
    setLoad({ phase: 'loading' });
    fetchSelf()
      .then(async (res) => {
        if (!res.person) {
          track('profile_not_established');
          setLoad({ phase: 'absent', reason: res.reason ?? '' });
          return;
        }
        setAskOffered(await timeAskAlreadyOffered(res.person.id));
        track('profile_shown', { chart: res.person.chart?.status ?? 'absent' });
        setLoad({ phase: 'ready', person: res.person });
      })
      // Named, never swallowed into an empty profile: "we could not read your
      // profile" and "you have no profile" are different sentences.
      .catch((e: any) => setLoad({ phase: 'error', message: String(e?.message ?? e) }));
  }, []);

  useEffect(read, [read]);

  useEffect(() => {
    fetchPriorities()
      .then(setPriorities)
      .catch((e: any) => console.warn('[priorities]', String(e?.message ?? e)));
  }, []);

  // ASTRAL-138: the disclosure is fetched BEFORE anything is offered, and it
  // is computed server-side from the derived contract's own dependency edges.
  const openEdit = useCallback((person: PersonView, row: FactRow) => {
    if (!row.editable) {
      setBlocked(row.notEditableBecause ?? null);
      return;
    }
    setEditBusy(row.key);
    fetchEditImpact(person.id, row.key)
      .then((impact) => setPendingEdit(impact))
      .catch((e: any) => setBlocked(`I could not work out what changing that would affect (${String(e?.message ?? e)}).`))
      .finally(() => setEditBusy(null));
  }, []);

  // …and the edit itself leaves through the CHAT. Screen 2 renders the
  // engine's `input_request` full-screen and hands the typed answer to the
  // chat screen, which owns the one send path. Nothing is written here.
  const continueEdit = useCallback((impact: EditImpact) => {
    track('profile_edit_handoff', { field: impact.field });
    setPendingEdit(null);
    router.push({ pathname: '/birth-details', params: { opening: correctionTurn(impact.label) } });
  }, []);

  return (
    <View style={s.fill}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
            style={s.back}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={10}
          >
            <ChevronLeft size={tokens.size.icon} color={tokens.palette.ink.primary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={s.body}>
          {load.phase === 'loading' ? (
            <ActivityIndicator color={tokens.palette.accent.interactive} />
          ) : load.phase === 'error' ? (
            <View style={s.gap}>
              <Text style={s.title}>Your profile</Text>
              <Text style={s.sentence}>I could not read your profile just now. {load.message}</Text>
              <Pressable style={s.cta} onPress={read} accessibilityRole="button" accessibilityLabel="Try again">
                <Text style={s.ctaText}>Try again</Text>
              </Pressable>
            </View>
          ) : load.phase === 'absent' ? (
            <NotEstablished reason={load.reason} />
          ) : (
            <Established
              person={load.person}
              priorities={priorities}
              askOffered={askOffered}
              editBusy={editBusy}
              onEdit={(row) => openEdit(load.person, row)}
              onOffered={() => {
                rememberTimeAskOffered(load.person.id);
                setAskOffered(true);
              }}
              onOfferTime={() => {
                track('profile_time_ask');
                router.push({
                  pathname: '/birth-details',
                  params: { opening: 'I know my birth time now — I want to add it.' },
                });
              }}
            />
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ASTRAL-138's disclosure, on the same screen as the action it
          describes — the cascade is stated BEFORE the correction begins. */}
      <Modal visible={!!pendingEdit} transparent animationType="fade" onRequestClose={() => setPendingEdit(null)}>
        <View style={s.scrim}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Change your {pendingEdit?.label}</Text>
            <Text style={s.sentence}>{pendingEdit ? editDisclosure(pendingEdit) : ''}</Text>
            <Text style={s.caption}>
              I will ask you for the new value in chat, so the correction goes through the
              same check every other detail does.
            </Text>
            <Pressable
              style={s.cta}
              onPress={() => pendingEdit && continueEdit(pendingEdit)}
              accessibilityRole="button"
              accessibilityLabel="Continue in chat"
            >
              <Text style={s.ctaText}>Continue in chat</Text>
            </Pressable>
            <Pressable style={s.ghost} onPress={() => setPendingEdit(null)} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={s.ghostText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!blocked} transparent animationType="fade" onRequestClose={() => setBlocked(null)}>
        <View style={s.scrim}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Not from this screen</Text>
            <Text style={s.sentence}>{blocked}</Text>
            <Pressable style={s.ghost} onPress={() => setBlocked(null)} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={s.ghostText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** ASTRAL-135's designed state: a fresh user opening Profile before their
 *  first reading gets a screen, not a 404 and not an empty card. */
function NotEstablished({ reason }: { reason: string }) {
  return (
    <View style={s.gap}>
      <Text style={s.title}>Your profile</Text>
      <Text style={s.sentence}>
        {reason || 'No birth details have been established for you yet.'}
      </Text>
      <Text style={s.caption}>
        Birth details are collected in the conversation, where each one can be checked
        with you before anything is cast.
      </Text>
      <Pressable
        style={s.cta}
        onPress={() => router.push({ pathname: '/birth-details', params: { opening: ESTABLISH_TURN } })}
        accessibilityRole="button"
        accessibilityLabel="Add your birth details"
      >
        <Text style={s.ctaText}>Add your birth details</Text>
      </Pressable>
    </View>
  );
}

function Established({
  person, priorities, askOffered, editBusy, onEdit, onOfferTime, onOffered,
}: {
  person: PersonView;
  priorities: PrioritiesResponse | null;
  askOffered: boolean;
  editBusy: string | null;
  onEdit: (row: FactRow) => void;
  onOfferTime: () => void;
  onOffered: () => void;
}) {
  const rows = factRows(person);
  const state = chartState(person.chart);
  const readable = chartIsReadable(state);
  const lines = readable ? chartLines(person.chart) : [];
  const frame = readable ? frameLine(person.chart) : null;
  const notes = undeterminedNotes(person.chart);
  const ask = timeAskState(person, askOffered);

  // Spent on SHOWING, not on tapping (ASTRAL-137). `onOffered` records it;
  // the effect is here rather than in the parent so the rule sits next to
  // the thing it is about.
  useEffect(() => {
    if (shouldRecordOffer(ask)) onOffered();
  }, [ask, onOffered]);

  return (
    <View style={s.gap}>
      <Text style={s.title}>{person.display_name || 'Your profile'}</Text>
      <Text style={s.caption}>This is you — the person every reading is cast for.</Text>

      <Text style={s.section}>Birth details</Text>
      <View style={s.card}>
        {rows.map((row, i) => (
          <View key={row.key}>
            <Pressable
              style={s.row}
              onPress={() => onEdit(row)}
              accessibilityRole="button"
              accessibilityLabel={`${row.label}: ${row.value}`}
            >
              <View style={s.rowText}>
                <Text style={s.rowLabel}>{row.label}</Text>
                <Text style={s.rowValue}>{row.value}</Text>
                {/* ASTRAL-35 — where this value came from, said gently and
                    never as "you told us" when it was seeded. */}
                <Text style={s.caption}>{row.provenance}</Text>
              </View>
              {editBusy === row.key ? (
                <ActivityIndicator color={tokens.palette.ink.muted} />
              ) : row.editable ? (
                <ChevronRight size={tokens.size.icon} color={tokens.palette.ink.muted} />
              ) : null}
            </Pressable>
            {i < rows.length - 1 ? <View style={s.divider} /> : null}
          </View>
        ))}
      </View>

      {ask !== 'none' ? (
        <View style={s.note}>
          <Text style={s.sentence}>{TIME_UNKNOWN_STATEMENT}</Text>
          {ask === 'offer' ? (
            <Pressable style={s.cta} onPress={onOfferTime} accessibilityRole="button" accessibilityLabel={TIME_UNKNOWN_OFFER}>
              <Text style={s.ctaText}>{TIME_UNKNOWN_OFFER}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Text style={s.section}>Your chart</Text>
      <View style={s.card}>
        <View style={s.cardBody}>
          {frame ? (
            <View style={s.frameRow}>
              <SymbolIcon name="circle.hexagongrid" color={tokens.palette.ink.muted} />
              <Text style={s.caption}>{frame}</Text>
            </View>
          ) : null}
          {lines.map((line) => (
            <View key={line.key} style={s.line}>
              <Text style={s.lineLabel}>{line.label}</Text>
              <Text style={s.lineValue}>{line.value}</Text>
            </View>
          ))}
          <Text style={s.caption}>{state.sentence}</Text>
        </View>
      </View>

      {/* docs/49 PH-19 (ASTRAL-152/154) — the owner's question, answered in
          the place they would look for it: what matters to YOU, beside the
          chart it is read alongside. The row is a READ; the edit happens on
          its own screen, through the chat carrier (F24). */}
      <Text style={s.section}>What matters to you</Text>
      <View style={s.card}>
        <Pressable
          style={s.row}
          onPress={() => {
            track('profile_preferences');
            router.push('/preferences');
          }}
          accessibilityRole="button"
          accessibilityLabel="What matters to you in a partner"
        >
          <View style={s.rowText}>
            <Text style={s.rowLabel}>Partner preferences</Text>
            <Text style={s.rowValue}>{prioritySummary(priorities)}</Text>
            {/* the sentence that teaches the invariant, on the row that
                leads to the thing it is about (ASTRAL-154) */}
            <Text style={s.caption}>
              Changes what your reports lead with and how matches are ordered.
              No score changes.
            </Text>
          </View>
          <ChevronRight size={tokens.size.icon} color={tokens.palette.ink.muted} />
        </Pressable>
      </View>

      {notes.length ? (
        <>
          <Text style={s.section}>What this chart cannot say</Text>
          <View style={s.card}>
            <View style={s.cardBody}>
              {notes.map((note) => (
                <View key={note.field} style={s.gapTight}>
                  <Text style={s.rowLabel}>{note.title}</Text>
                  <Text style={s.sentence}>{note.reason}</Text>
                  {note.alternatives.length ? (
                    <Text style={s.caption}>It is one of: {note.alternatives.join(' or ')}.</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

const t = tokens;

const s = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, backgroundColor: t.palette.paper.base },
  header: { flexDirection: 'row', alignItems: 'center' },
  back: { paddingHorizontal: t.space(4), paddingVertical: t.space(2) },
  body: { paddingHorizontal: t.space(5), paddingTop: t.space(2), paddingBottom: t.space(10) },
  gap: { gap: t.space(3) },
  gapTight: { gap: t.space(1) },
  title: { ...t.type.scale.hero, ...t.type.display, color: t.palette.ink.primary },
  section: {
    ...t.type.scale.caption,
    color: t.palette.ink.muted,
    letterSpacing: 1,
    marginTop: t.space(3),
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: t.palette.paper.card,
    borderRadius: t.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.palette.paper.line,
    overflow: 'hidden',
  },
  cardBody: { padding: t.space(4), gap: t.space(2.5) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space(3),
    paddingHorizontal: t.space(4),
    paddingVertical: t.space(3.5),
  },
  rowText: { flex: 1, gap: t.space(0.5) },
  rowLabel: { ...t.type.scale.caption, color: t.palette.ink.muted },
  rowValue: { ...t.type.scale.lead, color: t.palette.ink.primary },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.palette.paper.line,
    marginLeft: t.space(4),
  },
  frameRow: { flexDirection: 'row', alignItems: 'center', gap: t.space(2) },
  line: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: t.space(3) },
  lineLabel: { ...t.type.scale.sub, color: t.palette.ink.secondary },
  lineValue: { ...t.type.scale.lead, color: t.palette.ink.primary },
  note: {
    gap: t.space(3),
    padding: t.space(4),
    borderRadius: t.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.palette.paper.line,
    backgroundColor: t.palette.paper.card,
  },
  sentence: { ...t.type.scale.sub, color: t.palette.ink.secondary },
  caption: { ...t.type.scale.caption, color: t.palette.ink.muted },
  cta: {
    backgroundColor: t.palette.accent.interactive,
    borderRadius: t.radius.button,
    paddingVertical: t.space(3.5),
    alignItems: 'center',
  },
  ctaText: { ...t.type.scale.label, color: t.palette.accent.interactiveInk, fontWeight: '600' },
  ghost: {
    borderRadius: t.radius.button,
    paddingVertical: t.space(3.5),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.palette.paper.line,
  },
  ghostText: { ...t.type.scale.label, color: t.palette.ink.primary },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: t.palette.scrim,
  },
  sheet: {
    backgroundColor: t.palette.paper.base,
    borderTopLeftRadius: t.space(6),
    borderTopRightRadius: t.space(6),
    padding: t.space(5),
    gap: t.space(3),
  },
  sheetTitle: { ...t.type.scale.title, ...t.type.display, color: t.palette.ink.primary },
});
