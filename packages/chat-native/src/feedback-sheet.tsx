/**
 * The thumbs-down sheet (docs/78 §9) — "what went wrong?", in the user's own
 * words, as reason CHIPS plus an optional line of text.
 *
 * WHY CHIPS AND NOT STARS. A 1–5 on an answer the user just disliked is noise
 * nobody acts on. A chip is a closed label the backend maps onto its failure
 * taxonomy, so the first tap is already learnable — and the second chip,
 * "Asked for details I already gave", is the product's commonest complaint in
 * the words users actually use.
 *
 * THE CHIPS ARE SERVED, NOT HARDCODED. `GET /chats/feedback-reasons` returns
 * the keys with both labels; this sheet renders what it is given and derives
 * nothing (astral doctrine 9). Until the fetch answers — or if it never does —
 * the sheet still works with free text alone, because a thumbs-down that
 * cannot be explained is still a thumbs-down and is already recorded before
 * this sheet opens.
 *
 * NEVER REQUIRED, NEVER BLOCKING. Dismissing the sheet untouched keeps the
 * thumbs-down; there is no "you must pick a reason". The free text goes to
 * the user's own message record on the backend and to nothing else.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  fetchFeedbackReasons,
  submitFeedback,
  type FeedbackReason,
} from '@wealthai/core';

import { ChatText } from './message-bubble';
import { getChatHost } from './host';
import type { ChatTheme } from './theme';

export interface FeedbackSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The conversation and the answer being rated. */
  chatId: string;
  messageId: string;
  theme: ChatTheme;
  /** 'hi' renders the Hindi twin of each chip; anything else the English. */
  language?: 'en' | 'hi';
  /** Called after a reason and/or text has been sent — so the host can mark
   *  the bubble. The thumbs-down itself was sent before this sheet opened. */
  onSent?: (reason: string | null) => void;
}

// One module-level cache: the chips do not change between answers, and a
// sheet that refetched them on every thumbs-down would flash empty each time.
let _reasons: FeedbackReason[] | null = null;

export function FeedbackSheet({
  visible,
  onClose,
  chatId,
  messageId,
  theme,
  language = 'en',
  onSent,
}: FeedbackSheetProps) {
  const { colors } = theme;
  const styles = useMemo(() => stylesFor(theme), [theme]);
  const [reasons, setReasons] = useState<FeedbackReason[]>(_reasons ?? []);
  const [picked, setPicked] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPicked(null);
      setText('');
      setSending(false);
      return;
    }
    if (_reasons) return;
    let alive = true;
    (async () => {
      try {
        const token = await getChatHost().getToken();
        if (!token) return;
        const got = await fetchFeedbackReasons(token);
        if (!alive || !got.length) return;
        _reasons = got;
        setReasons(got);
      } catch {
        // Free text still works; the chips are a convenience, not a gate.
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible]);

  const ready = (picked !== null || text.trim().length >= 3) && !sending;

  const send = async () => {
    if (!ready) return;
    setSending(true);
    try {
      const token = await getChatHost().getToken();
      if (token) {
        await submitFeedback(token, chatId, {
          feedback_type: 'thumbs_down',
          message_id: messageId,
          reason: picked,
          comment: text.trim() || null,
        });
      }
      onSent?.(picked);
    } finally {
      setSending(false);
      onClose();
    }
  };

  const label = (r: FeedbackReason) => (language === 'hi' ? r.label_hi : r.label_en);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ChatText theme={theme} step="title">
            {language === 'hi' ? 'क्या गड़बड़ हुई?' : 'What went wrong?'}
          </ChatText>
          <ChatText theme={theme} step="small" tone="muted">
            {language === 'hi'
              ? 'यह हमें ठीक करने में मदद करता है। कुछ भी चुनना ज़रूरी नहीं।'
              : 'This helps us fix it. Nothing here is required.'}
          </ChatText>

          {reasons.length ? (
            <View style={styles.chips}>
              {reasons.map((r) => {
                const on = picked === r.key;
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => setPicked(on ? null : r.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[
                      styles.chip,
                      { backgroundColor: on ? colors.primary : colors.surface },
                    ]}>
                    <ChatText theme={theme} step="small" tone={on ? 'onPrimary' : 'default'}>
                      {label(r)}
                    </ChatText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={language === 'hi' ? 'और बताएँ (वैकल्पिक)' : 'Tell us more (optional)'}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
            style={styles.input}
          />

          <Pressable
            onPress={send}
            disabled={!ready}
            accessibilityRole="button"
            style={[
              styles.submit,
              { backgroundColor: ready ? colors.primary : colors.surfaceStrong },
            ]}>
            {sending ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <ChatText theme={theme} step="smallBold" tone="onPrimary">
                {language === 'hi' ? 'भेजें' : 'Send'}
              </ChatText>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function stylesFor(theme: ChatTheme) {
  const { colors, metrics } = theme;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: metrics.rowPaddingX,
      paddingBottom: metrics.rowPaddingX + metrics.widgetGap,
      gap: metrics.bubblePaddingX,
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(128,128,128,0.4)',
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: metrics.widgetGap,
    },
    chip: {
      borderRadius: 999,
      paddingHorizontal: metrics.bubblePaddingX,
      paddingVertical: metrics.bubblePaddingY,
    },
    input: {
      minHeight: 64,
      maxHeight: 140,
      borderRadius: 14,
      padding: metrics.bubblePaddingX,
      backgroundColor: colors.surface,
      color: colors.text,
      ...(theme.type.input as object),
      textAlignVertical: 'top',
    },
    submit: {
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
