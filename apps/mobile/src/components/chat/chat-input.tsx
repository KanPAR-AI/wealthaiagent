// Chat input bar — attach button, auto-growing field, send/stop button.
//
// ChatGPT-parity behaviors (the quality bar):
//   - Field is NEVER disabled (disabling a focused TextInput dismisses
//     the keyboard). Compose while the reply streams.
//   - While streaming, send becomes STOP (■), wired to the SSE abort.
//   - “+” attaches images (photo library) or documents; files upload
//     immediately to POST /files/upload (same contract as web) and show
//     as removable thumbnails above the field. MysticAI's palm reading
//     is exactly this path: attach palm photo → send.

import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { type MessageFile } from '@wealthai/core';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { getToken } from '@/lib/auth';
import { uploadFileNative } from '@/lib/upload';

const MAX_INPUT_HEIGHT = 120;

export function ChatInput({
  onSend,
  onStop,
  busy,
}: {
  onSend: (text: string, files: MessageFile[]) => void;
  onStop: () => void;
  busy: boolean;
}) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const [text, setText] = useState('');
  const [files, setFiles] = useState<MessageFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const canSend = !busy && !uploading && (text.trim().length > 0 || files.length > 0);

  const uploadAsset = async (asset: { uri: string; name: string; type: string; size?: number }) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not signed in');
      // Native streaming upload — see lib/upload.ts for why FormData
      // approaches are dead ends on SDK 57.
      const uploaded = await uploadFileNative(token, asset, setUploadProgress);
      // Preview from the LOCAL file uri: the uploaded URL is behind auth
      // on prod (401 for a bare <Image>), which rendered blank thumbnails
      // on-device. localUri never leaves this component; the message
      // itself carries the backend URL.
      setFiles((fs) => [...fs, { ...uploaded, localUri: asset.uri } as any]);
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

  return (
    <View style={[styles.bar, { backgroundColor: colors.background, borderTopColor: colors.backgroundElement }]}>
      {(files.length > 0 || uploading) && (
        <View style={styles.previews}>
          {files.map((f, i) => (
            <View key={`${f.url}-${i}`} style={styles.preview}>
              {f.type.startsWith('image/') ? (
                <Image source={{ uri: (f as any).localUri || f.url }} style={styles.previewImage} />
              ) : (
                <View style={[styles.previewDoc, { backgroundColor: colors.backgroundElement }]}>
                  <ThemedText type="small" numberOfLines={2}>📄 {f.name}</ThemedText>
                </View>
              )}
              <Pressable
                onPress={() => setFiles((fs) => fs.filter((_, j) => j !== i))}
                hitSlop={8}
                style={styles.previewRemove}>
                <ThemedText type="smallBold" style={styles.previewRemoveText}>×</ThemedText>
              </Pressable>
            </View>
          ))}
          {uploading && (
            <View style={[styles.previewDoc, styles.uploadingTile, { backgroundColor: colors.backgroundElement }]}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <View style={[styles.progressTrack, { backgroundColor: colors.backgroundSelected }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.text,
                      width: `${Math.max(6, Math.round(uploadProgress * 100))}%`,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </View>
      )}
      <View style={[styles.field, { backgroundColor: colors.backgroundElement }]}>
        <Pressable
          onPress={handleAttach}
          disabled={busy || uploading}
          hitSlop={8}
          accessibilityLabel="Attach file"
          style={styles.attachButton}>
          <ThemedText type="title" style={{ color: colors.textSecondary, fontSize: 22, lineHeight: 24 }}>
            +
          </ThemedText>
        </Pressable>
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
  uploadingTile: { justifyContent: 'center', alignItems: 'center', gap: 6 },
  progressTrack: {
    width: '70%',
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 1.5 },
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  previews: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
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
    paddingHorizontal: Spacing.two,
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
    borderRadius: 24,
    paddingLeft: Spacing.two,
    paddingRight: Spacing.one + 2,
    paddingVertical: Spacing.one + 2,
  },
  attachButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
    marginBottom: 2,
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
