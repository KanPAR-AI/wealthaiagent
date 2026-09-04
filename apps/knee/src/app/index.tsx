// The entry redirect: into the first tab this build can serve. When the
// user_progress store ships and `today` flips true, this lands on Today
// without this file changing — the tab list is the authority.

import { Redirect } from 'expo-router';

import { visibleTabs } from '@/lib/tabs';

export default function Index() {
  const first = visibleTabs()[0];
  return <Redirect href={`/${first?.route ?? 'library'}` as never} />;
}
