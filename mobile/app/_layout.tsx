import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import { useAuthStore } from '../src/store/auth';
import { useThemeStore } from '../src/store/theme';
import { useThemeColors } from '../src/hooks/useThemeColors';
import { DrawerContent } from '../src/components/layout/DrawerContent';
import { useChatStore } from '../src/store/chat';
import { colors as themeColors } from '../src/theme';
import { useRouter } from 'expo-router';

export default function RootLayout() {
  const loadToken = useAuthStore((s) => s.loadToken);
  const isDark = useThemeStore((s) => s.isDark);
  const colors = useThemeColors();
  const router = useRouter();
  const setCurrentSession = useChatStore((s) => s.setCurrentSession);
  const setMessages = useChatStore((s) => s.setMessages);

  useEffect(() => {
    loadToken();
  }, [loadToken]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style={isDark ? 'light' : 'light'} backgroundColor={themeColors.primaryDark} />
      <Drawer
        screenOptions={{
          headerShown: false,
          drawerStyle: {
            width: 300,
            backgroundColor: colors.surface,
          },
        }}
        drawerContent={(props) => (
          <DrawerContent
            onSelectChat={(id) => {
              setCurrentSession(id);
              router.push(`/chat/${id}`);
            }}
            onNewChat={() => {
              setCurrentSession(null);
              setMessages([]);
              router.push('/');
            }}
            onClose={() => props.navigation.closeDrawer()}
          />
        )}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
