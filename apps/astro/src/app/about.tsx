// About (docs/49 ASTRAL-109) — and the home of the version/build line that
// used to be a "Build" card on the settings screen.

import Constants from 'expo-constants';

import { Head, InfoScreen, Para } from '@/components/info-screen';
import { tokens } from '@/theme';

export default function About() {
  const version = Constants.expoConfig?.version ?? '—';
  const build = Constants.expoConfig?.ios?.buildNumber ?? '—';

  return (
    <InfoScreen title={`About ${tokens.wordmark}`}>
      <Para>
        {tokens.wordmark} reads your birth chart the way a Jyotish astrologer
        would: sidereal positions computed for the moment and place you were
        born, and an answer written from them.
      </Para>
      <Para>
        The astronomy is computed, never guessed — the same engine produces the
        numbers whoever asks, and the assistant reads them rather than
        inventing them.
      </Para>

      <Head>Version</Head>
      <Para>
        {tokens.wordmark} {version} ({build})
      </Para>
    </InfoScreen>
  );
}
