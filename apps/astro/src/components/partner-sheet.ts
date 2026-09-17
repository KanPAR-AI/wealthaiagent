// The ONE "Who is your partner?" sheet (owner, 2026-09-17: "Add a partner
// is not working … it seems buried"). Profile's Relationship row, Home's
// Couple card and the Couple tab's door all open THIS: the people already
// on file to declare with one tap, or "Someone new…" — the same flow every
// birth fact rides (F24): the engine's partner ask through the structured
// carrier into reconcile, which now saves them AS the partner and declares
// the link itself (graph._declare_partner_link). Nothing here writes a
// fact; declaring an existing person is docs/60 SL-5's PATCH on self.

import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { router } from 'expo-router';

import { track } from '@/lib/analytics';
import { ADD_PARTNER_TURN } from '@/lib/daily-view';
import { fetchPeople, setPartner, type PersonView } from '@/lib/people';

export interface PartnerSheetOptions {
  /** where the tap came from — analytics only */
  source: 'home' | 'profile' | 'insights';
  /** called after a successful declare (re-read the screen) */
  onDeclared?: () => void;
}

/** The details flow, opened with the partner sentence. */
export function addNewPartner(source: PartnerSheetOptions['source']): void {
  track('partner_add_new', { source });
  router.push({ pathname: '/birth-details', params: { opening: ADD_PARTNER_TURN } });
}

/** Fetches the people on file (one read, at tap time) and shows the sheet. */
export async function openPartnerSheet(opts: PartnerSheetOptions): Promise<void> {
  track('partner_sheet_open', { source: opts.source });
  let people: PersonView[] = [];
  try {
    const res = await fetchPeople();
    people = res.people.filter((p) => p.id !== 'self');
  } catch {
    people = [];
  }
  const declare = (p: PersonView) => {
    track('relationship_set', { partner: 1, source: opts.source });
    setPartner(p.id)
      .then(() => opts.onDeclared?.())
      .catch((e: unknown) => console.warn('[partner]', String((e as Error)?.message ?? e)));
  };
  const addNew = () => addNewPartner(opts.source);

  if (!people.length) {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Add their details…'], cancelButtonIndex: 0,
          title: 'Who is your partner?' },
        (i) => { if (i === 1) addNew(); },
      );
      return;
    }
    Alert.alert('Who is your partner?', undefined, [
      { text: 'Add their details…', onPress: addNew },
      { text: 'Cancel', style: 'cancel' },
    ]);
    return;
  }
  const names = people.map((p) => p.display_name || 'Unnamed');
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Cancel', ...names, 'Someone new…'], cancelButtonIndex: 0,
        title: 'Who is your partner?' },
      (i) => {
        if (i > 0 && i <= names.length) declare(people[i - 1]);
        if (i === names.length + 1) addNew();
      },
    );
    return;
  }
  Alert.alert('Who is your partner?', undefined, [
    ...people.slice(0, 5).map((p) => ({
      text: p.display_name || 'Unnamed',
      onPress: () => declare(p),
    })),
    { text: 'Someone new…', onPress: addNew },
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
