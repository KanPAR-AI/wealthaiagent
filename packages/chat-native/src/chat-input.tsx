// The ONE composer (docs/49 ASTRAL-105).
//
// Moved out of `apps/mobile/src/components/chat/chat-input.tsx`. ChatGPT-
// parity behaviours (the quality bar), all preserved:
//   - The field is NEVER disabled (disabling a focused TextInput dismisses
//     the keyboard). Compose while the reply streams.
//   - While streaming, send becomes STOP, wired to the SSE abort.
//   - Attach uploads immediately to POST /files/upload (same contract as
//     web) and shows removable thumbnails above the field. MysticAI's palm
//     reading is exactly this path: attach palm photo → send.
//
// ── capabilities, not styles (the owner's ruling) ──────────────────────────
//
// An affordance this app cannot honour is ABSENT, not hidden. `apps/astro`
// installs no `upload` and no `transcribe` — it has no native multipart path
// yet (that move is ASTRAL-110) — so it gets no attach button and no mic,
// and the board's frame 04 composer is what remains: a pill, a placeholder
// and a round send disc. Hiding them with a style would leave the code paths
// live and the difference invisible to a grep.

import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState, type ReactNode } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { type MessageFile } from '@wealthai/core';

import { getChatHost, type ChatUploadAsset } from './host';
import { ChatText } from './message-bubble';
import type { ChatTheme } from './theme';

export interface ChatInputProps {
  onSend: (text: string, files: MessageFile[]) => void;
  onStop: () => void;
  busy: boolean;
  theme: ChatTheme;
  /** (a) brand copy. */
  placeholder?: string;
  /** (a) brand artwork for the send disc — a drawn glyph where the brand has
   *  one, the shipped text characters where it does not. */
  renderSendIcon?: (busy: boolean, color: string, size: number) => ReactNode;
}

export function ChatInput({
  onSend,
  onStop,
  busy,
  theme,
  placeholder = 'Ask me anything…',
  renderSendIcon,
}: ChatInputProps) {
  const host = getChatHost();
  const { colors, metrics } = theme;
  const styles = stylesFor(theme);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<MessageFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Voice input — record with expo-audio, transcribe on the backend
  // (whisper-1 via /audio/transcribe, same as web). Tap mic to start,
  // tap again to stop; the transcript appends to whatever is typed.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const toggleVoice = async () => {
    const transcribe = host.transcribe;
    if (!transcribe || transcribing) return;
    if (!recording) {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone access needed', 'Enable microphone access in Settings to use voice input.');
        return;
      }
      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        setRecording(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (e: any) {
        Alert.alert('Could not start recording', e?.message || 'Try again.');
      }
      return;
    }
    // stop → transcribe → append
    setRecording(false);
    setTranscribing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording captured');
      const token = await host.getToken();
      if (!token) throw new Error('Not signed in');
      const transcript = await transcribe(token, uri);
      if (transcript) setText((prev) => (prev ? prev + ' ' : '') + transcript);
    } catch (e: any) {
      Alert.alert('Transcription failed', e?.message || 'Try again.');
    } finally {
      setTranscribing(false);
    }
  };

  const canSend = !busy && !uploading && (text.trim().length > 0 || files.length > 0);

  const uploadAsset = async (asset: ChatUploadAsset) => {
    const upload = host.upload;
    if (!upload) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const token = await host.getToken();
      if (!token) throw new Error('Not signed in');
      // Downscale large photos before uploading. A full-res palm/X-ray photo
      // is several MB, and uploads can take "forever" on a slow / LAN
      // connection (bug af85427f). Cap the width at 1600px + JPEG 0.7 — vision
      // models downscale internally anyway, so no analysis quality is lost.
      // Non-images (PDFs) and any failure fall back to the original.
      let up = asset;
      if (asset.type.startsWith('image/') && (!asset.width || asset.width > 1600)) {
        try {
          const r = await manipulateAsync(
            asset.uri,
            [{ resize: { width: 1600 } }],
            { compress: 0.7, format: SaveFormat.JPEG },
          );
          up = { ...asset, uri: r.uri, type: 'image/jpeg' };
        } catch {
          /* keep the original on any manipulation failure */
        }
      }
      // Native streaming upload — see the host's `upload` for why FormData
      // approaches are dead ends on SDK 57.
      // Time-box it: if the native upload task never settles (stalled
      // connection), `uploading` would stay true forever — a perpetual
      // spinner "blank image" tile with the send button stuck disabled
      // (bug d4e66e82). Fail after 60s so the user can retry.
      const uploaded = await Promise.race([
        upload(token, up, setUploadProgress),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Upload timed out — check your connection and try again.')),
            60000,
          ),
        ),
      ]);
      // Preview from the LOCAL file uri: the uploaded URL is behind auth
      // on prod (401 for a bare <Image>), which rendered blank thumbnails
      // on-device. localUri never leaves this component; the message
      // itself carries the backend URL.
      setFiles((fs) => [...fs, { ...uploaded, localUri: up.uri } as any]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Try again.');
    } finally {
      setUploading(false);
    }
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.85,
    });
    const asset = res.assets?.[0];
    if (!asset) return;
    await uploadAsset({
      uri: asset.uri,
      name: asset.fileName || `photo_${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
      size: asset.fileSize,
      width: asset.width,
    });
  };

  const takePhoto = async () => {
    // Palm readings / X-rays are usually shot in the moment — going via
    // the library forces a detour through the Camera app. Ask lazily for
    // permission; simulators have no camera, so fail soft with a hint.
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Camera access needed',
        'Enable camera access in Settings to take a photo.',
      );
      return;
    }
    try {
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        quality: 0.85,
      });
      const asset = res.assets?.[0];
      if (!asset) return;
      await uploadAsset({
        uri: asset.uri,
        name: asset.fileName || `camera_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
        size: asset.fileSize,
        width: asset.width,
      });
    } catch (e: any) {
      Alert.alert('Camera unavailable', e?.message || 'Try the photo library instead.');
    }
  };

  const pickDocument = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    const asset = res.assets?.[0];
    if (!asset) return;
    await uploadAsset({
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType || 'application/octet-stream',
      size: asset.size,
    });
  };

  const handleAttach = () => {
    if (busy || uploading) return;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Photo Library', 'Document'], cancelButtonIndex: 0 },
        (i) => {
          if (i === 1) takePhoto();
          if (i === 2) pickImage();
          if (i === 3) pickDocument();
        },
      );
    } else {
      Alert.alert('Attach', undefined, [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Document', onPress: pickDocument },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handlePress = () => {
    if (busy) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onStop();
      return;
    }
    if (!canSend) return;
    const value = text.trim();
    const outgoing = files;
    setText('');
    setFiles([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(value, outgoing);
  };

  const sendActive = busy || canSend;

  return (
    <View style={styles.bar}>
      {(files.length > 0 || uploading) && (
        <View style={styles.previews}>
          {files.map((f, i) => (
            <View key={`${f.url}-${i}`} style={styles.preview}>
              {f.type.startsWith('image/') ? (
                <Image source={{ uri: (f as any).localUri || f.url }} style={styles.previewImage} />
              ) : (
                <View style={styles.previewDoc}>
                  <ChatText theme={theme} step="small" numberOfLines={2}>📄 {f.name}</ChatText>
                </View>
              )}
              <Pressable
                onPress={() => setFiles((fs) => fs.filter((_, j) => j !== i))}
                hitSlop={8}
                style={styles.previewRemove}>
                <ChatText theme={theme} step="smallBold" style={styles.previewRemoveText}>×</ChatText>
              </Pressable>
            </View>
          ))}
          {uploading && (
            <View style={[styles.previewDoc, styles.uploadingTile]}>
              <ActivityIndicator size="small" color={colors.accent} />
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.max(6, Math.round(uploadProgress * 100))}%` },
                  ]}
                />
              </View>
            </View>
          )}
        </View>
      )}
      <View style={styles.field}>
        {host.upload ? (
          <Pressable
            onPress={handleAttach}
            disabled={busy || uploading}
            hitSlop={8}
            accessibilityLabel="Attach file"
            style={styles.attachButton}>
            <ChatText theme={theme} step="body" tone="muted" style={styles.attachGlyph}>+</ChatText>
          </Pressable>
        ) : null}
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          multiline
          style={styles.input}
          submitBehavior="newline"
        />
        {host.transcribe ? (
          <Pressable
            onPress={toggleVoice}
            disabled={busy || uploading}
            hitSlop={16}
            accessibilityLabel={recording ? 'Stop recording' : 'Voice input'}
            style={styles.micButton}>
            {transcribing ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : recording ? (
              // A clear, large stop target — the small red-dot glyph was hard
              // to tap to stop (bug 49c7b247). A filled square in a 40x40
              // button.
              <View style={styles.stopRecording} />
            ) : (
              <ChatText theme={theme} step="body" tone="muted" style={styles.micGlyph}>🎙</ChatText>
            )}
          </Pressable>
        ) : null}
        <Pressable
          onPress={handlePress}
          disabled={!sendActive}
          hitSlop={8}
          accessibilityLabel={busy ? 'Stop response' : 'Send message'}
          style={({ pressed }) => [
            styles.sendButton,
            {
              backgroundColor: sendActive ? colors.primary : colors.sendDisabled,
              opacity: pressed ? 0.7 : sendActive ? 1 : metrics.sendDisabledOpacity,
            },
          ]}>
          {renderSendIcon ? (
            renderSendIcon(busy, colors.onPrimary, Math.round(metrics.sendSize * 0.52))
          ) : (
            <ChatText theme={theme} step="smallBold" tone="onPrimary" style={styles.sendGlyph}>
              {busy ? '■' : '↑'}
            </ChatText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function stylesFor(theme: ChatTheme) {
  const { colors, metrics, radius } = theme;
  return StyleSheet.create({
    micButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 2,
    },
    micGlyph: { fontSize: 20, lineHeight: 24 },
    stopRecording: { width: 18, height: 18, borderRadius: 5, backgroundColor: colors.danger },
    uploadingTile: { justifyContent: 'center', alignItems: 'center', gap: 6 },
    progressTrack: {
      width: '70%',
      height: 3,
      borderRadius: 1.5,
      overflow: 'hidden',
      backgroundColor: colors.surfaceStrong,
    },
    progressFill: { height: '100%', borderRadius: 1.5, backgroundColor: colors.primary },
    bar: {
      backgroundColor: colors.background,
      borderTopWidth: metrics.composerBarBorderTop ? StyleSheet.hairlineWidth : 0,
      borderTopColor: colors.surface,
      paddingHorizontal: metrics.composerPaddingX,
      paddingTop: metrics.composerPaddingY,
      paddingBottom: metrics.composerPaddingY,
    },
    previews: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: metrics.widgetGap,
      paddingBottom: metrics.widgetGap,
    },
    preview: { position: 'relative' },
    previewImage: { width: 56, height: 56, borderRadius: 8 },
    previewDoc: {
      minWidth: 56,
      maxWidth: 120,
      height: 56,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: metrics.widgetGap,
      backgroundColor: colors.surface,
    },
    previewRemove: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#00000099',
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewRemoveText: { color: '#fff', lineHeight: 16, fontSize: 12 },
    field: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: colors.surface,
      borderRadius: radius.input,
      borderWidth: metrics.composerFieldBorder ? StyleSheet.hairlineWidth : 0,
      borderColor: colors.line,
      paddingLeft: metrics.fieldPaddingStart,
      paddingRight: 6,
      paddingVertical: metrics.fieldPaddingY,
    },
    attachButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 2,
      marginBottom: 2,
    },
    attachGlyph: { fontSize: 22, lineHeight: 24 },
    input: {
      flex: 1,
      ...(theme.type.input as object),
      color: colors.text,
      maxHeight: metrics.maxInputHeight,
      paddingTop: 6,
      paddingBottom: 6,
    },
    sendButton: {
      width: metrics.sendSize,
      height: metrics.sendSize,
      borderRadius: metrics.sendSize / 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: metrics.widgetGap,
      marginBottom: 2,
    },
    sendGlyph: { lineHeight: 18 },
  });
}
