// Screen 4 — AI Chat (docs/astral-board/04-ai-chat.png; docs/49 ASTRAL-106),
// and it is now the yourfinadvisor chat wearing this brand.
//
// ── what this file is, after ASTRAL-105 ───────────────────────────────────
//
// The owner's ruling, verbatim: "is chat page same as yourfinadvisor app, it
// should be — just some branding details, and memory extraction and widget…
// with routing disabled." So the conversation — the lifecycle, the
// transcript, the bubble, the composer, the interactive widgets — is
// `<ChatSurface>` from `@wealthai/chat-native`, the same component
// `apps/mobile` renders. What is left in this file is the CHROME the board
// draws around it: the paper ground, the back chevron and the dot-grid menu
// either side of the serif wordmark over "Your cosmic advisor", and the
// cosmic wash bleeding out of the top-right corner.
//
// The three things this app is allowed to differ in, and where each lives:
//   (a) brand    → `lib/chat-theme.ts` (values) and the copy below
//   (b) widgets  → `lib/chat-widgets.tsx` (the astral blocks)
//   (c) routing  → `lib/chat-host.ts`: routing off, agent pinned, no picker
// Memory extraction needs nothing: it is server-side and already runs on
// every turn this app sends.
//
// ── what it replaces ──────────────────────────────────────────────────────
//
// One `asked` string and one `answer` string — so the previous turn vanished
// the moment the next one began, and a relaunch showed an empty screen even
// though the conversation was safe on the server. There is a real transcript
// now, hydrated from history on mount, which is the point of the slice:
// close the app mid-reading, come back, and the reading is still there.
//
// `lib/reading.ts` is gone. Its own header said it was "NOT a second chat
// client" and that the real lifecycle would move here; it did, and its §12
// funnel counters moved with it into the lifecycle rather than being left
// behind in a screen.

import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { ActionSheetIOS, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CHAT_RETRY_EVENT,
  CHAT_SEND_EVENT,
  ChatSurface,
  loadChatIntoStore,
  useSendMessage,
} from '@wealthai/chat-native';
import { getPlatform, useChatStore, type Message } from '@wealthai/core';
import { stripInputResponse } from '@wealthai/astral';

import { maskedAssistantText, maskedUserBubbleText } from '@/lib/birth-privacy-view';
import { useBirthPrivacy } from '@/lib/birth-privacy';

import { ArrowUp, ChevronLeft, DotGrid, StopSquare } from '@/components/glyphs';
import { CornerWash } from '@/components/sky';
import { useReportProblem } from '@/lib/bug-report';
import { handoffAction } from '@/lib/chat-handoff';
import { useReadingBlocked } from '@/lib/use-account';
import { disownChat, forgetChat, isOwnChat, lastChatId, rememberChat, rememberOwnChat } from '@/lib/chat-session';
import { astroChatTheme } from '@/lib/chat-theme';
import { ASTRO_DATA_LANGUAGES, AstroWidget } from '@/lib/chat-widgets';
import { track } from '@/lib/analytics';
import { fetchPeople } from '@/lib/people';
import type { PersonView } from '@/lib/people-shapes';
import { chipLabel, subjectStore, type ReadingSubject } from '@/lib/subject-view';
// docs/71 PH-34 (owner 2026-09-19, looking at the shipped one-person sheet:
// "Modify this to have a picker for the group that I want to do reading
// for"). The rows and the sentences are `lib/group-view.ts`; the SENTENCES
// are the engine's own cues and the member set lives on the ENGINE, so this
// screen sends words and renders what comes back. It keeps no member set.
import {
  canSelectMore,
  pickable,
  subjectSheetWithGroups,
  turnForSelection,
} from '@/lib/group-view';
import { fetchBalance } from '@/lib/credits';
import { tokens } from '@/theme';
import { fetchChatMessageCount } from '@/lib/chat-meta';
import { chatNudge } from '@/lib/chat-nudge';

/**
 * The board's three chips.
 *
 * They are a STAND-IN and nothing more: the engine writes contextual
 * follow-ups for every reply (`widget_action_tiles`) and those render inline
 * in the transcript, through the shared widget path, exactly where the board
 * draws them once you are at the foot of the conversation. Rendering the
 * static three beside the engine's own was the "suggestion is not proper"
 * the owner saw on-device, so the surface shows these only when a settled
 * reply carried none.
 *
 * Copy, so it belongs to the brand — it should become a `copy.*` token in
 * ASTRAL-124's sweep, alongside the hint below.
 */
// docs/64 W-4: the timing question as a tile — the engine's cue grammar
// reads it and ranks the days (generic purpose; the chips name specific ones).
const FALLBACK_SUGGESTIONS = ['Yes, please', 'Tell me more', 'When should I…?', 'Another question'];

const WASH_HEIGHT = 132;
/** how far across the header the corner bleed reaches — it must not touch the
 *  wordmark, which is what a full-width wash did */
const WASH_WIDTH = 0.45;

/**
 * Owner 2026-09-19 — the birth-details lock reaches the TRANSCRIPT.
 *
 * A widget answer is persisted as its ASTRAL-89 echo plus a typed
 * `input_response` fence, and the echo of a birth-details answer IS the
 * user's own exact date, time and place ("Date of birth: <their date> ·
 * Birth time: <their time> · …"), scrollable forever. Masked ON RENDER — the
 * stored message is untouched, the fence is still the carrier the engine
 * parsed — and only for the bubbles identified STRUCTURALLY by their carrier
 * keys. `stripInputResponse` is handed in because the fence's own module owns
 * that suppression (AMB-17 (a)).
 *
 * Module scope, not a `useCallback`: it depends on nothing but the message,
 * and `useBirthPrivacy.getState()` is read at paint time so an expiry that
 * happened while the list was idle re-masks on the next frame.
 *
 * ⚠ ONE THING TO KNOW BEFORE ADDING A REVEAL CONTROL TO THIS SCREEN.
 * `MessageBubble` is `memo`'d and both of these read the unlock imperatively
 * at paint, so a bubble PAINTED while revealed would stay revealed past the
 * 60 seconds — nothing re-renders it. That is unreachable today (this screen
 * has no reveal control, and leaving Profile or the chart re-locks before
 * anyone can get here unlocked), but a Show button here would make it real:
 * the fix then is to subscribe the list to the unlock so an expiry
 * re-renders the rows, not to read it harder.
 */
function userBubbleText(message: Message): string {
  return maskedUserBubbleText(
    message.message ?? '',
    useBirthPrivacy.getState().revealed(),
    stripInputResponse,
  );
}

/**
 * …and the ASSISTANT's side of the same lock (F345).
 *
 * The engine's correction receipt — "Your birth time is now **15:20**." —
 * is a permanent bot bubble, so masking it only on the Profile banner was
 * cosmetic. Identified STRUCTURALLY: the bubble whose PREVIOUS turn is a
 * `field_correction` answer carrying a locked self key. Never a regex over
 * the reply. `undefined` means "draw it exactly as before", which is every
 * other bubble in the transcript.
 */
function assistantBubbleText(message: Message, previous: Message | undefined): string | undefined {
  return maskedAssistantText({
    message: message.message ?? '',
    previous: previous?.message,
    revealed: useBirthPrivacy.getState().revealed(),
  });
}

export default function Chat() {
  // Per-tab status bar, set ON FOCUS. Every tab screen stays MOUNTED, so a
  // declarative `<StatusBar style=…>` leaves whichever screen mounted last in
  // charge — measured: Home → Timeline → Home left the clock dark on the
  // night sky, where it cannot be read.
  useFocusEffect(useCallback(() => setStatusBarStyle('light'), []));

  // Screen 2 (docs/49 ASTRAL-104) opens the chat, renders the engine's
  // `input_request` full-screen, and hands the composed answer here rather
  // than sending it: this screen owns the ONE send path. `chatId` carries the
  // conversation the form already started — without it the answer would land
  // in a NEW chat, where the ask it answers never happened.
  const handoff = useLocalSearchParams<{
    chatId?: string; pending?: string; fresh?: string; handoffKey?: string;
    /** docs/67 H-2: '1' seals the fresh chat from the profile */
    standalone?: string;
  }>();
  const [chatId, setChatId] = useState<string | null>(null);
  const [washWidth, setWashWidth] = useState(0);

  const onChatCreated = useCallback((id: string) => setChatId(id), []);

  /**
   * Remember whichever conversation this screen is in — however it got here.
   *
   * MEASURED, simulator, 2026-08-24: remembering inside `onChatCreated` was
   * not enough and the failure was silent. Screen 2 starts the conversation
   * and hands its id over as a route param, so on the app's FIRST run the
   * lifecycle never creates a chat on this screen, `onChatCreated` never
   * fires, nothing is written — and the relaunch showed an empty transcript
   * while the whole reading sat safe on the server. An effect on the id
   * covers all three ways it arrives: created here, adopted from screen 2,
   * or resumed from storage.
   *
   * The optimistic local id gets written for the second or so before it
   * migrates to the backend's. A kill inside that window leaves an id the
   * server has never heard of, which the resume path below already handles
   * by forgetting it.
   */
  useEffect(() => {
    if (chatId) rememberChat(chatId);
  }, [chatId]);

  const { send: rawSend, cancel, isSending, isCreatingChat } = useSendMessage(chatId, onChatCreated);
  // Owner ruling 2026-09-12: a turn IS a reading — a guest's send routes
  // to the gate instead. `readingBlocked(null)` blocks the auth race too:
  // an unresolved send is refused, never risked.
  const { blocked: readingGated } = useReadingBlocked();

  // docs/60 SL-4: the subject chip. The chip shows what the ENGINE last
  // said the subject is (the reading_subject block feeds the store); a
  // chat switch resets it to You until the engine says otherwise.
  const [subject, setSubject] = useState<ReadingSubject>(subjectStore.get());
  useEffect(() => subjectStore.subscribe(setSubject), []);
  useEffect(() => { subjectStore.reset(); }, [chatId]);
  // The native surfaces (Palm, Muhurta) adopt the user's OWN chat — never a
  // friend's sealed reading. Only the engine's word decides which this is.
  useEffect(() => {
    if (!chatId || !subjectStore.engineSaid()) return;
    if (isOwnChat(subject.mode, true, handoff.standalone === '1')) rememberOwnChat(chatId);
    else void disownChat(chatId);
  }, [chatId, subject, handoff.standalone]);
  // The long-chat nudge. Reads the bubbles on screen; the dismissal is per
  // chat and resets when the chat changes.
  const chatMessages = useChatStore((st) => (chatId ? st.chats[chatId]?.messages : undefined));
  const [nudgeDismissedAt, setNudgeDismissedAt] = useState<number | null>(null);
  useEffect(() => { setNudgeDismissedAt(null); }, [chatId]);
  // The server's total at load + whatever this session added since.
  const [countBase, setCountBase] = useState<{ total: number; loaded: number } | null>(null);
  useEffect(() => {
    setCountBase(null);
    if (!chatId) return;
    let live = true;
    void fetchChatMessageCount(chatId).then((total) => {
      if (!live || total === null) return;
      setCountBase({ total, loaded: useChatStore.getState().chats[chatId]?.messages?.length ?? 0 });
    });
    return () => { live = false; };
  }, [chatId]);
  const nudge = useMemo(() => {
    const inHand = chatMessages?.length ?? 0;
    const total = countBase ? countBase.total + Math.max(0, inHand - countBase.loaded) : null;
    return chatNudge(chatMessages ?? [], nudgeDismissedAt, total);
  }, [chatMessages, nudgeDismissedAt, countBase]);
  const [people, setPeople] = useState<PersonView[]>([]);
  useEffect(() => {
    if (readingGated) return;
    fetchPeople().then((r) => setPeople(r.people)).catch(() => setPeople([]));
  }, [readingGated]);
  const send = useCallback((text: string, atts: unknown[]) => {
    if (readingGated) {
      router.push('/sign-in');
      return Promise.resolve();
    }
    return rawSend(text, atts as never);
  }, [readingGated, rawSend]) as typeof rawSend;

  // docs/71 PH-34: the multi-select the "Pick people…" row opens. The
  // selection is LOCAL to the sheet and dies with it — the member set that
  // matters is `reading_members` on the chat envelope, which only the
  // engine writes (F102). Nothing here is persisted.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [withMe, setWithMe] = useState(true);
  const openPicker = useCallback(() => {
    setPicked([]);
    setWithMe(true);
    setPickerOpen(true);
  }, []);
  const togglePicked = useCallback((id: string) => {
    setPicked((cur) => (cur.includes(id)
      ? cur.filter((x) => x !== id)
      : canSelectMore(cur) ? [...cur, id] : cur));
  }, []);
  const pickedTurn = useMemo(
    () => turnForSelection(people, picked, withMe),
    [people, picked, withMe],
  );
  const sendPicked = useCallback(() => {
    if (!pickedTurn) return;
    setPickerOpen(false);
    track('subject_switch', { mode: 'group' });
    // A SCOPE CHANGE STARTS A NEW READING (docs/70 §3a.1 screen 7), through
    // the same handoff the adhoc cue uses.
    router.push({ pathname: '/chat', params: { pending: pickedTurn, fresh: '1', handoffKey: String(Date.now()) } });
  }, [pickedTurn]);

  const openSubjectSheet = useCallback(() => {
    const rows = subjectSheetWithGroups(people);
    const labels = rows.map((r) => r.label);
    const pick = (i: number) => {
      const row = rows[i];
      if (!row) return;
      if (row.kind === 'pick') {
        openPicker();
        return;
      }
      track('subject_switch', { mode: row.kind });
      if (row.fresh) {
        // A clean slate: the cue opens a NEW conversation through the same
        // handoff the Matches screen uses (owner, 2026-09-17), which is
        // also what keeps one conversation from mixing two sets of people.
        router.push({ pathname: '/chat', params: { pending: row.turn, fresh: '1', handoffKey: String(Date.now()) } });
        return;
      }
      send(row.turn, []);
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', ...labels], cancelButtonIndex: 0, title: 'Who is this reading for?' },
        (i) => { if (i > 0) pick(i - 1); },
      );
      return;
    }
    Alert.alert('Who is this reading for?', undefined, [
      ...rows.slice(0, 8).map((r, i) => ({ text: r.label, onPress: () => pick(i) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }, [people, send, openPicker]);
  const busy = isSending || isCreatingChat;

  // The board draws a MENU glyph in the header's right slot, and it used to
  // push Settings directly. ASTRAL-163 needs a report entry reachable from
  // chat, and a menu icon that opens a menu costs the frame nothing — no
  // fourth control, no re-centred wordmark.
  const reportProblem = useReportProblem();

  // Owner ask (2026-09-11): "there should be an option to start new or
  // fresh" — this app was ONE running reading forever (chat-session.ts
  // documents the difference from mobile's drawer), and nothing let the
  // user leave it. Starting fresh forgets the REMEMBERED id and clears the
  // screen's own; the next send mints a new conversation through the same
  // lifecycle that made the first one. The old reading is not deleted — it
  // stays on the server (and in the account's history) — so the confirm
  // says "stays saved", never "will be lost".
  // The fresh start itself, without a confirm — for the long-chat nudge, whose
  // card has already said what happens ("this one stays saved").
  const beginFresh = useCallback(() => {
    if (busy) cancel();
    forgetChat();
    setChatId(null);
  }, [busy, cancel]);
  const startFresh = useCallback(() => {
    const begin = beginFresh;
    Alert.alert(
      'Start a new reading?',
      'Your current reading stays saved. A fresh conversation begins.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start new', onPress: begin },
      ],
    );
  }, [beginFresh]);

  const openMenu = useCallback(() => {
    const settings = () => router.push('/settings');
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Start a new reading', 'Report a problem', 'Settings'],
          cancelButtonIndex: 0,
        },
        (i) => {
          if (i === 1) startFresh();
          if (i === 2) reportProblem();
          if (i === 3) settings();
        },
      );
      return;
    }
    Alert.alert('Menu', undefined, [
      { text: 'Start a new reading', onPress: startFresh },
      { text: 'Report a problem', onPress: reportProblem },
      { text: 'Settings', onPress: settings },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [reportProblem, startFresh]);

  // Asking for the balance triggers the server's one-time welcome grant —
  // without this call a fresh account sits at zero and the first reading is
  // refused (the build-3 defect). The NUMBER lives on the settings screen,
  // where the out-of-credits message points ("Settings → Credits"), because
  // the board's header carries a chevron, the wordmark and the menu and
  // nothing else. The call stays regardless of who displays the result.
  useEffect(() => {
    fetchBalance().catch((e) => console.warn('[credits]', String(e?.message ?? e)));
  }, []);

  // ── which conversation are we in? ───────────────────────────────────────
  // Either the one screen 2 started (route param) or the one this device was
  // last in (storage). Both are hydrated from the server through the SAME
  // loader mobile's drawer uses, so a reading resumes identically on both.
  const adopted = useRef(false);
  useEffect(() => {
    if (adopted.current) return;
    adopted.current = true;
    const incoming = handoff.chatId?.trim();
    if (incoming) {
      setChatId(incoming);
      void loadChatIntoStore(incoming).catch((e) =>
        console.warn('[chat] could not load the handed-off reading', String(e?.message ?? e)),
      );
      return;
    }
    // A handoff with no chat id is a NEW conversation; resuming the previous
    // one under it would answer this question inside the last reading.
    if (handoff.pending) return;
    void lastChatId()
      .then(async (id) => {
        if (!id) return;
        setChatId(id);
        await loadChatIntoStore(id);
      })
      .catch((e) => {
        console.warn('[chat] could not resume the last reading', String(e?.message ?? e));
        forgetChat();
      });
  }, [handoff.chatId, handoff.pending]);

  // The handed-off turn. The decision — join the named chat, start fresh
  // (owner ruling 2026-09-11: a match ask ALWAYS opens a new conversation,
  // even on a mounted tab already holding one), wait for adoption, or
  // ignore a handoff already served — is `lib/chat-handoff.ts`'s, tested
  // at the root. The per-handoff key replaces the old once-ever ref, which
  // meant the SECOND "Ask AI" of an app launch silently did nothing.
  const lastHandoffKey = useRef<string | null>(null);
  useEffect(() => {
    const action = handoffAction(
      { pending: handoff.pending, chatId: handoff.chatId,
        fresh: handoff.fresh, handoffKey: handoff.handoffKey },
      chatId, lastHandoffKey.current);
    if (action.kind === 'reset') {
      setChatId(null);            // the effect re-runs at null and sends
      return;
    }
    if (action.kind !== 'send') return;
    if (readingGated) {
      // The key is NOT consumed: after signing in the same handoff sends.
      router.push('/sign-in');
      return;
    }
    lastHandoffKey.current = action.key;
    // docs/67 H-2: a hand-off for somebody NOT on the list opens a chat
    // sealed from the profile (the store's standalone flag is read when
    // the session is created); the flag is cleared once the send settles
    // so the next ordinary chat is the user's own again.
    const sealed = handoff.standalone === '1';
    if (sealed) useChatStore.getState().setStandaloneMode(true);
    Promise.resolve(send(handoff.pending as string, []))
      .finally(() => { if (sealed) useChatStore.getState().setStandaloneMode(false); });
  }, [handoff.pending, handoff.chatId, handoff.fresh, handoff.handoffKey,
      handoff.standalone, chatId, send, readingGated]);

  // A widget answer — a chip, a picker, the input widget's typed
  // `input_response` carrier — arrives on the ONE channel the shared surface
  // declares, and goes out through the ONE send path this screen owns. No
  // second send path, and nothing flattened into a sentence for the extractor
  // to re-read (F18).
  useEffect(() => {
    return getPlatform().events.on(CHAT_SEND_EVENT, (payload) => {
      const text = (payload as { text?: string } | undefined)?.text;
      if (typeof text === 'string' && text.trim()) void send(text, []);
    });
  }, [send]);

  // ↻ Retry on an errored reply: resend the last user message. Same
  // behaviour, same channel, same component as mobile — a dropped stream
  // must not mean two different things in two apps (ASTRAL-105).
  useEffect(() => {
    return getPlatform().events.on(CHAT_RETRY_EVENT, () => {
      if (!chatId) return;
      const msgs = useChatStore.getState().chats[chatId]?.messages || [];
      const lastUser = [...msgs].reverse().find((m) => m.sender === 'user');
      if (lastUser) void send(lastUser.message, lastUser.files || []);
    });
  }, [chatId, send]);

  return (
    <View style={s.fill}>
      <StatusBar style="light" />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header} onLayout={(e) => setWashWidth(e.nativeEvent.layout.width)}>
          {/* The cosmic wash the board bleeds out of the top-right corner:
              the ceremonial field, just visible, on a working surface. */}
          {washWidth ? (
            <View pointerEvents="none" style={s.wash}>
              <Svg width={washWidth * WASH_WIDTH} height={WASH_HEIGHT}>
                <CornerWash id="chat" width={washWidth * WASH_WIDTH} height={WASH_HEIGHT} />
              </Svg>
            </View>
          ) : null}

          {/* The chevron renders only when there IS somewhere to go back to.
              As a TAB (docs/49 ASTRAL-119) this screen is usually the root of
              its stack, and a chevron that does nothing is the dead
              affordance the row forbids — it used to call `undefined`. The
              header keeps its side slot either way so the wordmark stays
              optically centred. */}
          <View style={s.headerSide}>
            {router.canGoBack() ? (
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={10}
              >
                <ChevronLeft size={tokens.size.icon} color={tokens.palette.ink.onCosmic} />
              </Pressable>
            ) : null}
          </View>

          <View style={s.headerMid}>
            <Text style={s.headerTitle}>{tokens.wordmark}</Text>
            <Text style={s.headerSub}>Your cosmic advisor</Text>
          </View>

          <Pressable
            onPress={openMenu}
            style={[s.headerSide, s.headerRight]}
            accessibilityRole="button"
            accessibilityLabel="Menu"
            hitSlop={10}
          >
            <DotGrid size={tokens.size.icon} color={tokens.palette.ink.onCosmic} />
          </Pressable>
        </View>

        <ChatSurface
          chatId={chatId}
          theme={astroChatTheme}
          busy={busy}
          onSend={send}
          onStop={cancel}
          renderWidget={(widget, key) => (
            <AstroWidget key={key} widget={widget} theme={astroChatTheme} />
          )}
          dataLanguages={ASTRO_DATA_LANGUAGES}
          userText={userBubbleText}
          assistantText={assistantBubbleText}
          belowTranscript={
            <>
            {/* Owner 2026-09-18: past thirty messages — and said plainly when
                the chat has mixed several topics — suggest a fresh reading.
                One card, two honest buttons; "Keep going" buys twenty quiet
                messages (lib/chat-nudge.ts decides, tested at the root). */}
            {nudge && !busy ? (
              <View style={s.nudge}>
                <Text style={s.nudgeTitle}>{nudge.title}</Text>
                <Text style={s.nudgeBody}>{nudge.body}</Text>
                <View style={s.nudgeActions}>
                  <Pressable
                    style={s.nudgeYes}
                    onPress={() => { track('chat_nudge', { answer: 'new', reason: nudge.reason, count: nudge.count }); beginFresh(); }}
                    accessibilityRole="button"
                  >
                    <Text style={s.nudgeYesText}>Start a new reading</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { track('chat_nudge', { answer: 'keep', reason: nudge.reason, count: nudge.count }); setNudgeDismissedAt(nudge.count); }}
                    hitSlop={10}
                    accessibilityRole="button"
                  >
                    <Text style={s.nudgeLater}>Keep going</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            {/* docs/60 S3: composer-adjacent — in thumb reach, visible on
                every message. State made visible, not a new write path. */}
            <View style={s.chipRow}>
              <Pressable
                style={s.subjectChip}
                onPress={openSubjectSheet}
                disabled={readingGated}
                accessibilityRole="button"
                accessibilityLabel={`${chipLabel(subject)}. Change who this reading is for`}
              >
                <Text style={s.subjectChipText}>{chipLabel(subject)} ▾</Text>
              </Pressable>
              {/* Owner 2026-09-17: "beside reading for you add a option to
                  do new reading" — the menu's own action, one tap nearer.
                  Same confirm, same lifecycle; the old reading stays saved. */}
              <Pressable
                style={s.newChip}
                onPress={startFresh}
                accessibilityRole="button"
                accessibilityLabel="Start a new reading"
              >
                <Text style={s.newChipText}>+ New reading</Text>
              </Pressable>
            </View>
            </>
          }
          fallbackSuggestions={FALLBACK_SUGGESTIONS}
          placeholder={`Message ${tokens.wordmark}...`}
          renderSendIcon={(streaming, color, size) =>
            streaming ? <StopSquare size={size} color={color} /> : <ArrowUp size={size} color={color} />
          }
          empty={
            <View style={s.emptyBody}>
              <Text style={s.hint}>
                Ask anything — start with your birth date, time and place.
              </Text>
            </View>
          }
          pending={<View style={s.emptyBody} />}
        />
        {/* docs/71 PH-34 — "Pick people…". A multi-select over the people
            already on file, capped at the ENGINE's own cap so the sheet
            cannot promise a sixth person. Done sends one SENTENCE; the ids
            are resolved server-side from the names, because a client that
            guessed an id could name a stranger. */}
        <Modal
          visible={pickerOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setPickerOpen(false)}
        >
          <View style={s.pickerScrim}>
            <View style={s.pickerSheet}>
              <Text style={s.pickerTitle}>Who is this reading for?</Text>
              <Text style={s.pickerHint}>
                Choose up to {String(5)} people. A new reading starts so this
                one stays as it is.
              </Text>
              <ScrollView style={s.pickerList}>
                {pickable(people).map((p) => {
                  const on = picked.includes(p.id);
                  return (
                    <Pressable
                      key={p.id}
                      style={[s.pickerRow, on && s.pickerRowOn]}
                      onPress={() => togglePicked(p.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={p.display_name}
                    >
                      <Text style={s.pickerRowText}>{p.display_name}</Text>
                      <Text style={s.pickerTick}>{on ? '✓' : ''}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={s.pickerMeRow}>
                <Text style={s.pickerRowText}>…and me</Text>
                <Switch value={withMe} onValueChange={setWithMe} />
              </View>
              <View style={s.pickerActions}>
                <Pressable
                  style={s.newChip}
                  onPress={() => setPickerOpen(false)}
                  accessibilityRole="button"
                >
                  <Text style={s.newChipText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[s.subjectChip, !pickedTurn && s.pickerDoneOff]}
                  onPress={sendPicked}
                  disabled={!pickedTurn}
                  accessibilityRole="button"
                  accessibilityLabel="Read for the people I picked"
                >
                  <Text style={s.subjectChipText}>Read for them</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const t = tokens;

const s = StyleSheet.create({
  fill: { flex: 1 },
  // Owner 2026-09-17: the chat sits on the night field, like Insights.
  safe: { flex: 1, backgroundColor: t.palette.cosmic.deep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: t.space(4),
    paddingVertical: t.space(2.5),
    overflow: 'hidden',
  },
  // The wash covers the whole header box; the fade lives in the gradient
  // itself (see CornerWash), so nothing here needs an opacity.
  wash: { position: 'absolute', top: 0, right: 0, height: WASH_HEIGHT },
  headerSide: { width: t.space(11) },
  headerRight: { alignItems: 'flex-end' },
  headerMid: { flex: 1, alignItems: 'center', gap: 1 },
  headerTitle: {
    ...t.type.scale.title,
    ...t.type.display,
    color: t.palette.ink.onCosmic,
  },
  headerSub: { ...t.type.scale.caption, color: t.palette.ink.onCosmicMuted },
  emptyBody: { flex: 1, padding: t.space(4) },
  hint: { ...t.type.scale.sub, color: t.palette.ink.onCosmicMuted, marginTop: t.space(2) },
  nudge: {
    marginHorizontal: t.space(4), marginBottom: t.space(2), padding: t.space(4), gap: t.space(2),
    borderRadius: t.radius.card, borderWidth: StyleSheet.hairlineWidth,
    // SOLID: it sits over the end of the transcript, and the translucent card
    // colour let the last lines of the reading show through it.
    borderColor: t.palette.accent.ceremonial, backgroundColor: t.palette.cosmic.raised,
  },
  nudgeTitle: { ...t.type.scale.label, color: t.palette.ink.onCosmic, fontWeight: '700' },
  nudgeBody: { ...t.type.scale.sub, color: t.palette.ink.onCosmicMuted },
  nudgeActions: { flexDirection: 'row', alignItems: 'center', gap: t.space(5), marginTop: t.space(1) },
  nudgeYes: {
    backgroundColor: t.palette.accent.ceremonial, borderRadius: t.radius.button,
    paddingVertical: t.space(2), paddingHorizontal: t.space(4),
  },
  nudgeYesText: { ...t.type.scale.sub, color: t.palette.accent.ceremonialInk, fontWeight: '700' },
  nudgeLater: { ...t.type.scale.sub, color: t.palette.ink.onCosmicMuted },
  chipRow: {
    flexDirection: 'row', alignItems: 'center', gap: t.space(2),
    marginHorizontal: t.space(4), marginBottom: t.space(1.5),
  },
  subjectChip: {
    paddingHorizontal: t.space(3), paddingVertical: t.space(1.5),
    borderRadius: t.radius.button,
    backgroundColor: t.palette.accent.interactive,
  },
  subjectChipText: { ...t.type.scale.label, color: t.palette.accent.interactiveInk },
  newChip: {
    paddingHorizontal: t.space(3), paddingVertical: t.space(1.5),
    borderRadius: t.radius.button,
    borderWidth: 1, borderColor: t.palette.cosmic.line,
  },
  newChipText: { ...t.type.scale.label, color: t.palette.ink.onCosmic },
  // docs/71 PH-34 — the "Pick people…" sheet.
  pickerScrim: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: t.palette.scrim,
  },
  pickerSheet: {
    backgroundColor: t.palette.cosmic.deep,
    borderTopLeftRadius: t.radius.card, borderTopRightRadius: t.radius.card,
    padding: t.space(4), gap: t.space(2), maxHeight: '80%',
  },
  pickerTitle: { ...t.type.scale.title, color: t.palette.ink.onCosmic },
  pickerHint: { ...t.type.scale.label, color: t.palette.ink.onCosmicMuted },
  pickerList: { maxHeight: 320 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: t.space(2.5), paddingHorizontal: t.space(3),
    borderRadius: t.radius.button,
    borderWidth: 1, borderColor: t.palette.cosmic.line,
    marginBottom: t.space(1.5),
  },
  pickerRowOn: { backgroundColor: t.palette.accent.interactive },
  pickerRowText: { ...t.type.scale.body, color: t.palette.ink.onCosmic },
  pickerTick: { ...t.type.scale.body, color: t.palette.ink.onCosmic },
  pickerMeRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: t.space(3),
  },
  pickerActions: {
    flexDirection: 'row', justifyContent: 'flex-end',
    alignItems: 'center', gap: t.space(2), paddingTop: t.space(2),
  },
  pickerDoneOff: { opacity: 0.4 },
});
