// Chat input bar — auto-growing multiline field + send/stop button.
//
// ChatGPT-parity behaviors (the quality bar):
//   - The field is NEVER disabled. Setting editable={false} on a focused
//     TextInput dismisses the keyboard — which is exactly what users
//     don't want after hitting send. Keyboard stays up; the user can
//     compose their next message while the reply streams.
//   - While streaming, the send button becomes a STOP button (ChatGPT
//     pattern) wired to the AbortController behind the SSE reader.
//
// Keyboard inset animation comes from react-native-keyboard-controller's
// KeyboardAvoidingView wrapping this bar in the screen.

import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

const MAX_INPUT_HEIGHT = 120;

export function ChatInput({
  onSend,
  onStop,
  busy,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  busy: boolean;
}) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const [text, setText] = useState('');

  const canSend = !busy && text.trim().length > 0;

  const handlePress = () => {
    if (busy) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onStop();
      return;
    }
    if (!canSend) return;
    const value = text.trim();
    setText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(value);
  };

  return (
    <View style={[styles.bar, { backgroundColor: colors.background, borderTopColor: colors.backgroundElement }]}>
      <View style={[styles.field, { backgroundColor: colors.backgroundElement }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Ask me anything…"
          placeholderTextColor={colors.textSecondary}
          multiline
          style={[styles.input, { color: colors.text }]}
          submitBehavior="newline"
        />
        <Pressable
          onPress={handlePress}
          disabled={!busy && !canSend}
          hitSlop={8}
          accessibilityLabel={busy ? 'Stop response' : 'Send message'}
          style={({ pressed }) => [
            styles.sendButton,
            {
              backgroundColor: busy || canSend ? colors.text : colors.backgroundSelected,
              opacity: pressed ? 0.7 : 1,
            },
          ]}>
          <ThemedText type="smallBold" style={{ color: colors.background, lineHeight: 18 }}>
            {busy ? '■' : '↑'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one + 2,
    paddingVertical: Spacing.one + 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: MAX_INPUT_HEIGHT,
    paddingTop: 6,
    paddingBottom: 6,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.two,
    marginBottom: 2,
  },
});
