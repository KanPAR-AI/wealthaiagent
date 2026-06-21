import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ChatHeader } from '../../src/components/chat/ChatHeader';
import { MessageList } from '../../src/components/chat/MessageList';
import { ChatInput } from '../../src/components/chat/ChatInput';
import { useChat } from '../../src/hooks/useChat';
import { useChatStore } from '../../src/store/chat';
import { useThemeColors } from '../../src/hooks/useThemeColors';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const navigation = useNavigation();
  const router = useRouter();
  const { messages, isStreaming, sendMessage, loadHistory } = useChat();
  const { setCurrentSession, sessions } = useChatStore();

  const session = sessions.find((s) => s.id === id);

  useEffect(() => {
    if (id) {
      setCurrentSession(id);
      loadHistory(id);
    }
  }, [id, setCurrentSession, loadHistory]);

  const handleMenuPress = useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);

  const handleNewChat = useCallback(() => {
    setCurrentSession(null);
    router.push('/');
  }, [router, setCurrentSession]);

  const handleSend = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.chatBg }]} edges={['top']}>
      <ChatHeader
        title={session?.title || 'Chat'}
        onMenuPress={handleMenuPress}
        onNewChat={handleNewChat}
      />
      <View style={[styles.chatArea, { backgroundColor: colors.chatBg }]}>
        <MessageList messages={messages} />
        <ChatInput onSend={handleSend} isLoading={isStreaming} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatArea: {
    flex: 1,
  },
});
