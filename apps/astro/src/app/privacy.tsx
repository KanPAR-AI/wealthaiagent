// Privacy & Data (docs/49 ASTRAL-109, as AMENDED 2026-08-24).
//
// The row ships on one condition: "either the screen says plainly what it can
// and cannot remove, or the row is not shipped". So this screen SAYS, and
// offers no control it cannot honour.
//
// What it deliberately does NOT have: a delete button for uploaded files.
// F7 — `file_service.py:50` sets `expiresAt=None`, the only `blob.delete()` is
// commented out at `:70`, and `api/v1/endpoints/files.py` has no DELETE route.
// A delete affordance over files would report success and delete nothing,
// which is `lesson_silent_success_failures` inside a privacy screen.
//
// And no per-item delete on the phone yet either: that is ASTRAL-65, and it
// needs the memories client wired into this app. Until then the screen names
// the place where deletion actually works rather than pretending here.

import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Head, InfoScreen, Item, Para } from '@/components/info-screen';
import { tokens } from '@/theme';

const CONTROL_CENTRE = 'https://chat.yourfinadvisor.com/chataiagent/memory';

export default function Privacy() {
  return (
    <InfoScreen title="Privacy & Data">
      <Para>
        {tokens.wordmark} keeps what it needs to answer you, on the same
        account you are signed in with here.
      </Para>

      <Head>What it holds</Head>
      <Item>Your questions and the readings that came back.</Item>
      <Item>What the assistant has remembered about you — your birth details, and anything you told it to keep in mind.</Item>
      <Item>Your credits balance and the ledger of what each reading spent.</Item>
      <Item>Anonymous usage counts, so we can see which screens people actually reach.</Item>

      <Head>What you can remove today</Head>
      <Para>
        Memories and chat state can both be deleted, one at a time or all at
        once, from the Control Centre on the web — signed in with this same
        account. Deleting there removes it for this app too; there is one
        store, not a copy per app.
      </Para>
      <Pressable
        onPress={() => void WebBrowser.openBrowserAsync(CONTROL_CENTRE)}
        accessibilityRole="link"
        accessibilityLabel="Open the Control Centre on the web"
      >
        <Text style={s.link}>Open the Control Centre →</Text>
      </Pressable>
      <Para>
        Removing them from inside this app is coming; it is not here yet, and
        this screen would rather say so than show a button that does nothing.
      </Para>

      <Head>What you cannot remove yet</Head>
      <Para>
        Photos and documents you upload — a palm image, a report — are kept and
        there is no delete path for them today. If that matters to you, do not
        upload them yet. We would rather tell you that than show a control that
        reports success and removes nothing.
      </Para>
    </InfoScreen>
  );
}

const s = StyleSheet.create({
  link: {
    ...tokens.type.scale.sub,
    color: tokens.palette.accent.interactive,
    fontWeight: '600',
  },
});
