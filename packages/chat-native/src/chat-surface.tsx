// THE chat surface (docs/49 ASTRAL-105, amended 2026-08-24).
//
// The owner's ruling made literal: this component is the chat page, and both
// apps render it. What each app keeps for itself is its CHROME — mobile's
// tab bar, drawer, bug-report flag, agent and model pickers; astro's board
// header and its back chevron — and nothing about the conversation itself.
//
// The three allowed differences arrive as props:
//   (a) `theme` and the copy props   — brand
//   (b) `renderWidget`/`dataLanguages` — the block set this surface draws
//   (c) routing                       — not here at all: it is a lifecycle
//       fact on the installed host, so no screen can re-decide it
//
// Anything else that differs between the two chat pages is a SPEC-DEVIATION.

import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { submitFeedback, useChatStore, type Message, type MessageFile, type Widget } from '@wealthai/core';

import { ChatInput } from './chat-input';
import type { ComposerRestore } from './composer-restore';
import { ChatText } from './message-bubble';
import { MessageList } from './message-list';
import { FeedbackSheet } from './feedback-sheet';
import { getChatHost } from './host';
import type { ChatTheme } from './theme';

export interface ChatSurfaceProps {
  /** null before the first message of a new conversation exists. */
  chatId: string | null;
  theme: ChatTheme;
  busy: boolean;
  onSend: (text: string, files: MessageFile[]) => void;
  onStop: () => void;

  /** (b) */
  renderWidget?: (widget: Widget, key: string) => ReactNode;
  dataLanguages?: string[];
  renderText?: (text: string, key: string, theme: ChatTheme) => ReactNode;
  /** (b) what a USER bubble reads as — see `MessageBubbleProps.userText`. */
  userText?: (message: Message) => string;
  /** (b) …and an ASSISTANT one, which also sees the turn before it. */
  assistantText?: (message: Message, previous: Message | undefined) => string | undefined;
  /**
   * (a) The thumbs under every settled reply (docs/78 §9). Pass it and the
   * surface draws them, sends a thumb the moment it is tapped, and on a
   * thumbs-down opens the reason sheet. Omit it and nothing is drawn — the
   * rule that a shared component never restructures a live app's tree.
   */
  feedback?: { language?: 'en' | 'hi' };

  /** (a) what fills the screen before the first turn. */
  empty?: ReactNode;
  /** (a) what replaces it while the first turn's session is being created. */
  pending?: ReactNode;
  /** (a) anything the app pins between transcript and composer. */
  belowTranscript?: ReactNode;
  /** (a) composer copy and the send glyph. */
  placeholder?: string;
  renderSendIcon?: (busy: boolean, color: string, size: number) => ReactNode;
  /** (a) words the app gives back to the composer — see `composer-restore.ts`. */
  restore?: ComposerRestore | null;

  /**
   * (a) The brand's stand-in follow-ups.
   *
   * The board draws three chips under the reply. The ENGINE also writes
   * contextual ones for every turn (`widget_action_tiles`), and those render
   * inline in the transcript through the shared widget path — which is where
   * the board draws them once you are at the foot of the conversation. These
   * only stand in when a settled reply carried none, which is the rule that
   * shipped: showing both at once is the "suggestion is not proper" the owner
   * saw on-device. A host that passes none gets none.
   */
  fallbackSuggestions?: string[];
}

/** Was the last thing on screen a settled assistant reply that offered no
 *  follow-ups of its own? Only then is a stand-in a stand-in.
 *
 *  A selector rather than a `getState()` read, so the chips appear the moment
 *  the reply settles and vanish the moment the next turn starts — a snapshot
 *  taken once would leave them on screen through the next question.
 */
function useNeedsFallbackChips(chatId: string | null): boolean {
  return useChatStore((s) => {
    if (!chatId) return false;
    const messages = s.chats[chatId]?.messages ?? [];
    const last = messages[messages.length - 1];
    if (!last || last.sender !== 'bot' || last.isStreaming || last.error) return false;
    if (!last.message?.trim() && !last.contentBlocks?.length) return false;
    const blocks = last.contentBlocks ?? [];
    return !blocks.some(
      (b) =>
        b.type === 'widget' &&
        /action_tiles|specialist_picker|multi_select/.test(String(b.widget?.type ?? '')),
    );
  });
}

export function ChatSurface({
  chatId,
  theme,
  busy,
  onSend,
  onStop,
  renderWidget,
  dataLanguages,
  renderText,
  userText,
  assistantText,
  empty,
  pending,
  belowTranscript,
  placeholder,
  renderSendIcon,
  fallbackSuggestions,
  feedback,
  restore,
}: ChatSurfaceProps) {
  const replyWantsChips = useNeedsFallbackChips(chatId);
  const updateMessage = useChatStore((s) => s.updateMessage);
  // The answer whose thumbs-down sheet is open, if any.
  const [rating, setRating] = useState<{ messageId: string } | null>(null);

  // A thumb is sent the moment it is tapped. The sheet that follows a
  // thumbs-down only ADDS a reason — dismissing it untouched still leaves
  // the thumbs-down recorded, which is the whole "never required" rule.
  const onFeedback = useCallback(
    (message: Message, type: 'thumbs_up' | 'thumbs_down') => {
      if (!feedback || !chatId) return;
      updateMessage(chatId, message.id, { feedback: { type, reason: null } });
      void (async () => {
        const token = await getChatHost().getToken();
        if (!token) return;
        await submitFeedback(token, chatId, { feedback_type: type, message_id: message.id });
      })();
      if (type === 'thumbs_down') setRating({ messageId: message.id });
    },
    [feedback, chatId, updateMessage],
  );
  const showChips = !busy && !!fallbackSuggestions?.length && replyWantsChips;

  const styles = stylesFor(theme);

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.body}>
      {chatId ? (
        <MessageList
          chatId={chatId}
          theme={theme}
          renderWidget={renderWidget}
          dataLanguages={dataLanguages}
          renderText={renderText}
          userText={userText}
          assistantText={assistantText}
          onFeedback={feedback ? onFeedback : undefined}
        />
      ) : busy ? (
        // New-chat creation in flight — immediate feedback instead of the
        // stale suggestions screen (bug e6797e57: looked frozen).
        //
        // Rendered bare, not inside a wrapper: both hosts' empty states are
        // already `flex: 1`, and an extra view here is a layout difference
        // between what apps/mobile shipped and what it renders now. The
        // ONE-surface rule cuts both ways — the shared component must not
        // quietly restructure a live app's tree either.
        pending
      ) : (
        empty
      )}
      {belowTranscript}
      {showChips ? (
        <View style={styles.chips}>
          {fallbackSuggestions!.map((chip) => (
            <Pressable
              key={chip}
              style={styles.chip}
              onPress={() => onSend(chip, [])}
              accessibilityRole="button"
              accessibilityLabel={chip}>
              <ChatText theme={theme} step="small" tone="accent">{chip}</ChatText>
            </Pressable>
          ))}
        </View>
      ) : null}
      <ChatInput
        onSend={onSend}
        onStop={onStop}
        busy={busy}
        theme={theme}
        placeholder={placeholder}
        renderSendIcon={renderSendIcon}
        restore={restore}
      />
      {feedback && chatId && rating ? (
        <FeedbackSheet
          visible
          onClose={() => setRating(null)}
          chatId={chatId}
          messageId={rating.messageId}
          theme={theme}
          language={feedback.language}
          onSent={(reason) =>
            updateMessage(chatId, rating.messageId, {
              feedback: { type: 'thumbs_down', reason },
            })
          }
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

function stylesFor(theme: ChatTheme) {
  const { colors, metrics, radius } = theme;
  return StyleSheet.create({
    body: { flex: 1 },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: metrics.widgetGap,
      paddingHorizontal: metrics.composerPaddingX,
      paddingBottom: metrics.widgetGap,
    },
    chip: {
      borderRadius: radius.chip,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.surface,
      paddingHorizontal: metrics.bubblePaddingX,
      paddingVertical: metrics.widgetGap,
    },
  });
}
