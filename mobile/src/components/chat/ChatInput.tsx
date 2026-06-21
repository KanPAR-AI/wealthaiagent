import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { colors as themeColors, spacing, fontSize, borderRadius } from '../../theme';
import * as Haptics from 'expo-haptics';

interface ChatInputProps {
  onSend: (text: string) => void;
  onAttach?: () => void;
  isLoading?: boolean;
}

export function ChatInput({ onSend, onAttach, isLoading }: ChatInputProps) {
  const colors = useThemeColors();
  const [text, setText] = useState('');

  const canSend = text.trim().length > 0 && !isLoading;

  const handleSend = () => {
    if (!canSend) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(text.trim());
    setText('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.container, { backgroundColor: colors.inputBg, borderTopColor: colors.border }]}>
        {/* Attachment button */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onAttach}
          disabled={isLoading}
          activeOpacity={0.6}
        >
          <Ionicons name="add-circle-outline" size={26} color={colors.icon} />
        </TouchableOpacity>

        {/* Text input */}
        <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceVariant, borderColor: colors.inputBorder }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Message"
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={4000}
            editable={!isLoading}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
        </View>

        {/* Send / Mic button */}
        {canSend ? (
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: themeColors.primary }]}
            onPress={handleSend}
            activeOpacity={0.7}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.6} disabled={isLoading}>
            <Ionicons name="mic-outline" size={26} color={colors.icon} />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    borderRadius: borderRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    maxHeight: 120,
  },
  input: {
    fontSize: fontSize.md,
    lineHeight: 20,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
