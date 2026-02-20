import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useThemeStore } from '../../store/theme';
import { useChatStore } from '../../store/chat';
import { colors as themeColors, spacing, fontSize, borderRadius } from '../../theme';
import { api } from '../../services/api';
import { ChatSession } from '../../types';

interface DrawerContentProps {
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onClose: () => void;
}

export function DrawerContent({ onSelectChat, onNewChat, onClose }: DrawerContentProps) {
  const colors = useThemeColors();
  const isDark = useThemeStore((s) => s.isDark);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const { sessions, setSessions, currentSessionId } = useChatStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await api.getChatSessions();
      setSessions(data);
    } catch {
      // Sessions will be empty
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => {
    if (mode === 'light') setMode('dark');
    else if (mode === 'dark') setMode('system');
    else setMode('light');
  };

  const renderSession = ({ item }: { item: ChatSession }) => {
    const isActive = item.id === currentSessionId;
    return (
      <TouchableOpacity
        style={[
          styles.sessionItem,
          {
            backgroundColor: isActive ? colors.surfaceVariant : 'transparent',
          },
        ]}
        onPress={() => {
          onSelectChat(item.id);
          onClose();
        }}
        activeOpacity={0.6}
      >
        <Ionicons
          name={item.isFavorite ? 'star' : 'chatbubble-outline'}
          size={18}
          color={item.isFavorite ? themeColors.whatsappGreen : colors.icon}
        />
        <View style={styles.sessionText}>
          <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title || 'New Chat'}
          </Text>
          <Text style={[styles.sessionDate, { color: colors.textMuted }]}>
            {new Date(item.updatedAt).toLocaleDateString()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
        },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? colors.headerBg : themeColors.primaryDark }]}>
        <Text style={styles.headerTitle}>WealthWise AI</Text>
        <Text style={styles.headerSubtitle}>Chat History</Text>
      </View>

      {/* New Chat button */}
      <TouchableOpacity
        style={[styles.newChatBtn, { backgroundColor: themeColors.primary }]}
        onPress={() => {
          onNewChat();
          onClose();
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.newChatText}>New Chat</Text>
      </TouchableOpacity>

      {/* Sessions list */}
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {loading ? 'Loading...' : 'No conversations yet'}
            </Text>
          </View>
        }
      />

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.footerBtn} onPress={toggleTheme} activeOpacity={0.6}>
          <Ionicons
            name={isDark ? 'sunny-outline' : mode === 'system' ? 'phone-portrait-outline' : 'moon-outline'}
            size={20}
            color={colors.icon}
          />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            {mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    paddingTop: spacing.xxxl,
  },
  headerTitle: {
    color: '#fff',
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  newChatText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.sm,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: 2,
  },
  sessionText: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  sessionDate: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  emptyState: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.sm,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  footerText: {
    fontSize: fontSize.sm,
  },
});
