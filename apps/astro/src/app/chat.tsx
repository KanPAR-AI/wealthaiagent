// Screen 4 — AI Chat as the board draws it (docs/astral-board/04-ai-chat.png):
// a WORKING surface per AMB-22(a) — warm paper ground, dark ink, the serif
// wordmark centered over "Your cosmic advisor", the user's words in a violet
// bubble, the reply on a light card, and a rounded composer with the violet
// send disc. Same engine path as before the restyle: anonymous auth →
// chatservice → the PINNED astrology agent, streaming.
//
// Still one exchange at a time (the shared message lifecycle lands with
// ASTRAL-105); widget blocks are still counted, not rendered (ASTRAL-99).

import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchBalance } from '@/lib/credits';
import { ask, type AskHandle } from '@/lib/reading';
import { tokens } from '@/theme';

export default function Chat() {
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [unlimited, setUnlimited] = useState(false);
  const chatIdRef = useRef<string | null>(null);
  const handleRef = useRef<AskHandle | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  // Asking for the balance triggers the server's one-time welcome grant —
  // without this call a fresh account sits at zero and the first reading is
  // refused (the build-3 defect).
  useEffect(() => {
    fetchBalance()
      .then((b) => { setCredits(b.balance); setUnlimited(b.unlimited); })
      .catch((e) => console.warn('[credits]', String(e?.message ?? e)));
  }, []);

  const send = useCallback(async () => {
    const text = question.trim();
    if (!text || busy) return;
    setQuestion('');
    setAsked(text);
    setAnswer('');
    setError(null);
    setBusy(true);
    try {
      const handle = await ask(text, {
        chatId: chatIdRef.current,
        onDelta: setAnswer,
        onCredits: (_charged, balance) => setCredits(balance),
      });
      handleRef.current = handle;
      chatIdRef.current = handle.chatId;
      await handle.done;
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'The reading did not come through.');
    } finally {
      handleRef.current = null;
      setBusy(false);
    }
  }, [question, busy]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        <View style={s.header}>
          <Pressable
            onPress={() => router.push('/settings')}
            style={s.headerSide}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={10}
          >
            <Text style={s.headerAction}>
              {credits === null ? '☰' : unlimited ? '∞' : credits.toLocaleString()}
            </Text>
          </Pressable>
          <View style={s.headerMid}>
            <Text style={s.headerTitle}>{tokens.wordmark}</Text>
            <Text style={s.headerSub}>Your cosmic advisor</Text>
          </View>
          <View style={s.headerSide} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={s.fill}
          contentContainerStyle={s.body}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {asked ? (
            <View style={s.userBubble}>
              <Text style={s.userText}>{asked}</Text>
            </View>
          ) : null}
          {answer ? (
            <View style={s.replyCard}>
              <Text style={s.replyText}>{answer}</Text>
            </View>
          ) : busy ? (
            <ActivityIndicator color={tokens.palette.accent.interactive} style={s.spinner} />
          ) : !asked ? (
            <Text style={s.hint}>
              Ask anything — start with your birth date, time and place.
            </Text>
          ) : null}
          {error ? <Text style={s.error}>{error}</Text> : null}
        </ScrollView>

        <View style={s.composer}>
          <TextInput
            style={s.input}
            value={question}
            onChangeText={setQuestion}
            placeholder={`Message ${tokens.wordmark}...`}
            placeholderTextColor={tokens.palette.ink.muted}
            multiline
            editable={!busy}
            onSubmitEditing={send}
          />
          <Pressable
            style={[s.send, !question.trim() && !busy && s.sendOff]}
            onPress={busy ? () => handleRef.current?.stop() : send}
            accessibilityRole="button"
            accessibilityLabel={busy ? 'Stop the reading' : 'Send'}
          >
            <Text style={s.sendGlyph}>{busy ? '◼' : '↑'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const t = tokens;
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.palette.paper.base },
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: t.space(4),
    paddingVertical: t.space(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.palette.paper.line,
  },
  headerSide: { width: 64 },
  headerAction: {
    ...t.type.scale.sub,
    color: t.palette.accent.interactive,
    fontVariant: ['tabular-nums'],
  },
  headerMid: { flex: 1, alignItems: 'center', gap: 1 },
  headerTitle: {
    ...t.type.scale.title,
    ...t.type.display,
    color: t.palette.ink.primary,
  },
  headerSub: { ...t.type.scale.caption, color: t.palette.ink.muted },
  body: { padding: t.space(4), gap: t.space(3), paddingBottom: t.space(6) },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    backgroundColor: t.palette.accent.interactive,
    borderRadius: t.radius.card,
    borderBottomRightRadius: t.radius.tail,
    paddingHorizontal: t.space(4),
    paddingVertical: t.space(3),
  },
  userText: { ...t.type.scale.body, color: t.palette.accent.interactiveInk },
  replyCard: {
    backgroundColor: t.palette.paper.card,
    borderRadius: t.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.palette.paper.line,
    padding: t.space(4),
  },
  replyText: { ...t.type.scale.body, color: t.palette.ink.primary },
  spinner: { marginTop: t.space(4) },
  hint: { ...t.type.scale.sub, color: t.palette.ink.muted, marginTop: t.space(2) },
  error: { ...t.type.scale.sub, color: t.palette.danger },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: t.space(2.5),
    paddingHorizontal: t.space(4),
    paddingVertical: t.space(3),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.palette.paper.line,
    backgroundColor: t.palette.paper.base,
  },
  input: {
    ...t.type.scale.body,
    flex: 1,
    maxHeight: t.space(30),
    color: t.palette.ink.primary,
    backgroundColor: t.palette.paper.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.palette.paper.line,
    borderRadius: t.radius.input,
    paddingHorizontal: t.space(4),
    paddingVertical: t.space(3),
  },
  send: {
    width: t.size.disc,
    height: t.size.disc,
    borderRadius: t.radius.pill,
    backgroundColor: t.palette.accent.interactive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.35 },
  sendGlyph: { ...t.type.scale.lead, color: t.palette.accent.interactiveInk, fontWeight: '700' },
});
