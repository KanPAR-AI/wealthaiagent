// The ONE bug-report sheet (docs/49 ASTRAL-163).
//
// Moved out of `apps/mobile/src/components/bug-report-sheet.tsx`. A modal
// with a description field and ONE optional image, sourced either from a
// screenshot of the screen the user was just looking at — captured BEFORE
// this sheet opens, so the sheet is never in its own shot — or from the
// photo library.
//
// Upload path: the backend takes multipart POST /bug-reports with a
// `screenshot` file part. RN FormData {uri} parts are rejected by expo/fetch
// ("Unsupported FormDataPart implementation"), so when an image is attached
// we post the WHOLE report via expo-file-system uploadAsync — its
// `parameters` map carries description/chat_id/context as ordinary form
// fields. With no image we use the shared `submitBugReportCore`. Neither
// path is a second report route: both land in the same /admin/bugs queue.
//
// ── what the two apps differ in ───────────────────────────────────────────
//
// The token comes from the installed chat host; the API base comes from the
// platform adapter's `getApiUrl`, which each app already owns (mobile's
// honours its runtime backend switcher, astro's is its own). The CONTEXT —
// route, build, brand — is the caller's, because only the app knows which
// product it is; it is merged over the platform facts collected here so
// /admin/bugs triage can tell the products apart.

import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { getPlatform, submitBugReportCore } from '@wealthai/core';

import { getChatHost } from './host';
import { ChatText } from './message-bubble';
import type { ChatTheme } from './theme';

export interface BugReportSheetProps {
  visible: boolean;
  onClose: () => void;
  /** file:// URI of the screen captured just before the sheet opened.
   *  null is a real state: a capture can fail, and the report matters more
   *  than the picture, so the sheet still opens. */
  screenShotUri: string | null;
  chatId: string | null;
  theme: ChatTheme;
  /** (a) which product this report came from. It prefixes the user agent AND
   *  travels as its own context field, so /admin/bugs triage can tell two
   *  products over one backend apart at a glance. */
  brand: string;
  /**
   * What this app knows about where the report came from — route, build,
   * brand, selected agent. Merged OVER the platform facts collected here.
   */
  context?: Record<string, unknown>;
  /** (a) one line of brand copy under the title. */
  subtitle?: string;
}

export function BugReportSheet({
  visible,
  onClose,
  screenShotUri,
  chatId,
  theme,
  brand,
  context: appContext,
  subtitle = 'The current chat transcript is attached automatically.',
}: BugReportSheetProps) {
  const { colors } = theme;
  const styles = stylesFor(theme);

  const [description, setDescription] = useState('');
  // Default to the captured screen — "attach what I'm looking at" is the
  // 90% case for a bug report.
  const [attachmentUri, setAttachmentUri] = useState<string | null>(screenShotUri);
  const [usedCapture, setUsedCapture] = useState(Boolean(screenShotUri));
  const [sending, setSending] = useState(false);

  // Re-sync when a fresh capture arrives for a new open.
  const [lastShot, setLastShot] = useState(screenShotUri);
  if (screenShotUri !== lastShot) {
    setLastShot(screenShotUri);
    setAttachmentUri(screenShotUri);
    setUsedCapture(Boolean(screenShotUri));
  }

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      setAttachmentUri(res.assets[0].uri);
      setUsedCapture(false);
    }
  };

  const useCapturedScreen = () => {
    if (!screenShotUri) return;
    setAttachmentUri(screenShotUri);
    setUsedCapture(true);
  };

  const reset = () => {
    setDescription('');
    setAttachmentUri(screenShotUri);
    setUsedCapture(Boolean(screenShotUri));
  };

  const submit = async () => {
    const desc = description.trim();
    if (desc.length < 3 || sending) return;
    setSending(true);
    const context = {
      // Was hardcoded to "iOS" on every platform, so an Android report came
      // in labelled iOS and platform-specific bugs could not be triaged from
      // the report itself.
      user_agent: `${brand} ${Platform.OS} ${Platform.Version} (Expo)`,
      brand,
      ...appContext,
    } as Record<string, unknown>;
    try {
      const token = await getChatHost().getToken();
      if (attachmentUri) {
        // Downscale + compress before upload. A full-resolution screen capture
        // (or library photo) is several MB, so "send report" took forever (the
        // upload was the bottleneck, not the request). Cap width at 1200px +
        // JPEG 0.6 — plenty for a legible bug screenshot. Fall back to the
        // original on any failure.
        let uploadUri = attachmentUri;
        let uploadMime = attachmentUri.endsWith('.png') ? 'image/png' : 'image/jpeg';
        try {
          const shrunk = await manipulateAsync(
            attachmentUri,
            [{ resize: { width: 1200 } }],
            { compress: 0.6, format: SaveFormat.JPEG },
          );
          uploadUri = shrunk.uri;
          uploadMime = 'image/jpeg';
        } catch {
          /* keep the original on any manipulation failure */
        }
        const result = await uploadAsync(
          getPlatform().getApiUrl('/bug-reports'),
          uploadUri,
          {
            httpMethod: 'POST',
            uploadType: FileSystemUploadType.MULTIPART,
            fieldName: 'screenshot',
            mimeType: uploadMime,
            parameters: {
              description: desc,
              ...(chatId ? { chat_id: chatId } : {}),
              context: JSON.stringify(context),
            },
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );
        if (result.status < 200 || result.status >= 300) {
          throw new Error(`Upload failed (${result.status})`);
        }
      } else {
        await submitBugReportCore(
          token ?? undefined,
          { description: desc, chatId },
          context as any,
        );
      }
      reset();
      onClose();
      Alert.alert('Thanks!', 'Your report was sent to the team.');
    } catch (e: any) {
      Alert.alert('Could not send report', e?.message || 'Try again later.');
    } finally {
      setSending(false);
    }
  };

  const ready = description.trim().length >= 3 && !sending;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        // 'height' on Android, not undefined. The manifest sets
        // adjustResize, but that applies to the ACTIVITY window — a Modal gets
        // its own window and does not inherit it, so with no behavior the
        // sheet sat underneath the keyboard and the user could not see what
        // they were typing (bug ef26fdb0).
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ChatText theme={theme} step="title">Report an issue</ChatText>
          <ChatText theme={theme} step="small" tone="muted">{subtitle}</ChatText>

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What went wrong?"
            placeholderTextColor={colors.textMuted}
            multiline
            autoFocus
            style={styles.input}
          />

          {/* Attachment preview + sources */}
          {attachmentUri ? (
            <View style={styles.previewRow}>
              <Image source={{ uri: attachmentUri }} style={styles.preview} />
              <View style={styles.previewMeta}>
                <ChatText theme={theme} step="small" tone="muted">
                  {usedCapture ? 'Screenshot of current screen' : 'Image from library'}
                </ChatText>
                <Pressable onPress={() => setAttachmentUri(null)} hitSlop={8}>
                  <ChatText theme={theme} step="small" tone="danger">Remove</ChatText>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.actions}>
            {screenShotUri && !usedCapture ? (
              <Pressable onPress={useCapturedScreen} style={styles.actionButton}>
                <ChatText theme={theme} step="small">📸 Current screen</ChatText>
              </Pressable>
            ) : null}
            <Pressable onPress={pickImage} style={styles.actionButton}>
              <ChatText theme={theme} step="small">🖼 Attach image</ChatText>
            </Pressable>
          </View>

          <Pressable
            onPress={submit}
            disabled={!ready}
            style={[
              styles.submit,
              { backgroundColor: ready ? colors.primary : colors.surfaceStrong },
            ]}>
            {sending ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <ChatText theme={theme} step="smallBold" tone="onPrimary">Send report</ChatText>
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
    input: {
      minHeight: 88,
      maxHeight: 160,
      borderRadius: 14,
      padding: metrics.bubblePaddingX,
      backgroundColor: colors.surface,
      color: colors.text,
      ...(theme.type.input as object),
      textAlignVertical: 'top',
    },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: metrics.bubblePaddingX },
    preview: {
      width: 72,
      height: 72,
      borderRadius: 10,
      backgroundColor: 'rgba(128,128,128,0.15)',
    },
    previewMeta: { gap: 4, flex: 1 },
    actions: { flexDirection: 'row', gap: metrics.widgetGap },
    actionButton: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingHorizontal: metrics.bubblePaddingX,
      paddingVertical: metrics.bubblePaddingY,
    },
    submit: {
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
