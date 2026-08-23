// The app's first working surface: ask a question, watch the astrology
// agent answer. The product screens (docs/49 PH-3's renderers, the chart
// and palm results) land on top of this; what it proves today is the path —
// anonymous auth → chatservice → the PINNED agent → a streamed reply.

import { useCallback, useRef, useState } from 'react';
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

import { ask, type AskHandle } from '@/lib/reading';

export default function Index() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatIdRef = useRef<string | null>(null);
  const handleRef = useRef<AskHandle | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  const send = useCallback(async () => {
    const text = question.trim();
    if (!text || busy) return;
    setQuestion('');
    setAnswer('');
    setError(null);
    setBusy(true);
    try {
      const handle = await ask(text, {
        chatId: chatIdRef.current,
        onDelta: setAnswer,
      });
      handleRef.current = handle;
      chatIdRef.current = handle.chatId;
      await handle.done;
    } catch (e: any) {
      // Surfaced, never swallowed: a reading that quietly returns nothing is
      // indistinguishable from one the agent refused to give.
      setError(e?.message ? String(e.message) : 'The reading did not come through.');
    } finally {
      handleRef.current = null;
      setBusy(false);
    }
  }, [question, busy]);

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        <View style={s.header}>
          <Text style={s.title}>Astral AI</Text>
          <Text style={s.tag}>Your birth chart, explained.</Text>
        </View>

        <ScrollView
          ref={scrollRef}
          style={s.fill}
          contentContainerStyle={s.body}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {answer ? (
            <Text style={s.answer}>{answer}</Text>
          ) : busy ? (
            <ActivityIndicator color="#9aa4b2" />
          ) : (
            <Text style={s.hint}>
              Ask anything — start with your birth date, time and place.
            </Text>
          )}
          {error ? <Text style={s.error}>{error}</Text> : null}
        </ScrollView>

        <View style={s.composer}>
          <TextInput
            style={s.input}
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask about your chart"
            placeholderTextColor="#6b7480"
            multiline
            editable={!busy}
            onSubmitEditing={send}
          />
          <Pressable
            style={[s.send, (!question.trim() || busy) && s.sendOff]}
            onPress={busy ? () => handleRef.current?.stop() : send}
            accessibilityRole="button"
            accessibilityLabel={busy ? 'Stop the reading' : 'Send'}
          >
            <Text style={s.sendText}>{busy ? 'Stop' : 'Ask'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0e1116' },
  fill: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 4 },
  title: { color: '#f4efe6', fontSize: 26, fontWeight: '600', letterSpacing: 0.3 },
  tag: { color: '#9aa4b2', fontSize: 14 },
  body: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  hint: { color: '#6b7480', fontSize: 15, lineHeight: 22 },
  answer: { color: '#e8e3da', fontSize: 16, lineHeight: 24 },
  error: { color: '#e0736d', fontSize: 14, lineHeight: 20 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#222933',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    color: '#f4efe6',
    fontSize: 16,
    backgroundColor: '#161b22',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  send: {
    backgroundColor: '#c9a227',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  sendOff: { opacity: 0.4 },
  sendText: { color: '#0e1116', fontSize: 15, fontWeight: '600' },
});
