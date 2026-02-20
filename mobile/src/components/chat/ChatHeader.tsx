import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors as themeColors, spacing, fontSize } from '../../theme';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useThemeStore } from '../../store/theme';

interface ChatHeaderProps {
  title?: string;
  onMenuPress?: () => void;
  onNewChat?: () => void;
}

export function ChatHeader({ title = 'WealthWise AI', onMenuPress, onNewChat }: ChatHeaderProps) {
  const colors = useThemeColors();
  const isDark = useThemeStore((s) => s.isDark);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? colors.headerBg : themeColors.primaryDark,
          paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + spacing.sm : spacing.sm,
        },
      ]}
    >
      <View style={styles.left}>
        <TouchableOpacity onPress={onMenuPress} style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="menu" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle}>Financial Advisor</Text>
        </View>
      </View>

      <View style={styles.right}>
        <TouchableOpacity onPress={onNewChat} style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleBlock: {
    marginLeft: spacing.xs,
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.xs,
  },
});
