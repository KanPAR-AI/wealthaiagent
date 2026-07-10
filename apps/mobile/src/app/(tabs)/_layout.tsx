import { Redirect } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { useAuth } from '@/hooks/use-auth';

export default function TabsLayout() {
  const { user, isAuthLoading } = useAuth();

  // The animated splash overlay (rendered by the root layout) covers this
  // window — returning null avoids a login flash before Firebase restores
  // the persisted session from AsyncStorage.
  if (isAuthLoading) return null;

  // No user at all → login. Anonymous users pass: like web, anonymous is
  // the app's default usable tier and upgrading to a real account happens
  // from within the app.
  if (!user) return <Redirect href="/login" />;

  return <AppTabs />;
}
