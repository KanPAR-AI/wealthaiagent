// Authenticated app group. Chat is the full-bleed root screen —
// deliberately NO floating tab bar: a bottom tab pill collides with a
// bottom-docked chat input, and the ChatGPT/Claude-class pattern this app
// is held to uses a header-driven drawer for history/settings instead
// (arrives with chat history in a later Phase 3 slice).

import { Redirect } from 'expo-router';
import { Stack } from 'expo-router';

import { useAuth } from '@/hooks/use-auth';

export default function AppLayout() {
  const { user, isAuthLoading } = useAuth();

  // The animated splash overlay (rendered by the root layout) covers this
  // window — returning null avoids a login flash before Firebase restores
  // the persisted session from AsyncStorage.
  if (isAuthLoading) return null;

  // No user at all → login. Anonymous users pass: like web, anonymous is
  // the app's default usable tier and upgrading to a real account happens
  // from within the app.
  if (!user) return <Redirect href="/login" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
