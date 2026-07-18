// Report-a-bug sheet with attachments.
//
// Replaces the bare Alert.prompt: a modal with a description field and ONE
// optional image attachment, sourced either from a screenshot of the screen
// the user was just looking at (captured BEFORE this sheet opens, so the
// sheet itself is never in the shot) or from the photo library.
//
// Upload path: the backend takes multipart POST /bug-reports with a
// `screenshot` file part. RN FormData {uri} parts are rejected by
// expo/fetch ("Unsupported FormDataPart implementation"), so when an image
// is attached we post the WHOLE report via expo-file-system uploadAsync —
// its `parameters` map carries description/chat_id/context as ordinary
// form fields. With no image we use the shared submitBugReportCore.

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
  useColorScheme,
  View,
} from 'react-native';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { submitBugReportCore } from '@wealthai/core';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { getToken } from '@/lib/auth';
import { apiUrl } from '@/lib/server-config';

export interface BugReportSheetProps {
  visible: boolean;
  onClose: () => void;
  /** file:// URI of the screen captured just before the sheet opened. */
  screenShotUri: string | null;
  chatId: string | null;
  selectedAgent: string | null;
}

export function BugReportSheet({
  visible,
  onClose,
  screenShotUri,
  chatId,
  selectedAgent,
}: BugReportSheetProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

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
      url: 'app://mobile/chat',
      selected_agent: selectedAgent || undefined,
      user_agent: 'YourFinAdvisor iOS (Expo dev)',
    };
    try {
      const token = await getToken();
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
          apiUrl('/bug-reports'),
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
        await submitBugReportCore(token ?? undefined, { description: desc, chatId }, context);
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={styles.grabber} />
          <ThemedText type="subtitle">Report an issue</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            The current chat transcript is attached automatically.
          </ThemedText>

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What went wrong?"
            placeholderTextColor={colors.textSecondary}
            multiline
            autoFocus
            style={[
              styles.input,
              { backgroundColor: colors.backgroundElement, color: colors.text },
            ]}
          />

          {/* Attachment preview + sources */}
          {attachmentUri ? (
            <View style={styles.previewRow}>
              <Image source={{ uri: attachmentUri }} style={styles.preview} />
              <View style={styles.previewMeta}>
                <ThemedText type="small" themeColor="textSecondary">
                  {usedCapture ? 'Screenshot of current screen' : 'Image from library'}
                </ThemedText>
                <Pressable onPress={() => setAttachmentUri(null)} hitSlop={8}>
                  <ThemedText type="small" style={styles.remove}>Remove</ThemedText>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.actions}>
            {screenShotUri && !usedCapture ? (
              <Pressable
                onPress={useCapturedScreen}
                style={[styles.actionButton, { backgroundColor: colors.backgroundElement }]}>
                <ThemedText type="small">📸 Current screen</ThemedText>
              </Pressable>
            ) : null}
            <Pressable
              onPress={pickImage}
              style={[styles.actionButton, { backgroundColor: colors.backgroundElement }]}>
              <ThemedText type="small">🖼 Attach image</ThemedText>
            </Pressable>
          </View>

          <Pressable
            onPress={submit}
            disabled={description.trim().length < 3 || sending}
            style={[
              styles.submit,
              {
                backgroundColor:
                  description.trim().length >= 3 && !sending
                    ? colors.text
                    : colors.backgroundSelected,
              },
            ]}>
            {sending ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <ThemedText type="smallBold" style={{ color: colors.background }}>
                Send report
              </ThemedText>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
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
    padding: Spacing.three,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  preview: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
  previewMeta: { gap: 4, flex: 1 },
  remove: { color: '#e5484d' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  actionButton: {
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  submit: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
