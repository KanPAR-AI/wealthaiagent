// Help & Support (docs/49 ASTRAL-109).
//
// No mailto: there is no support mailbox anywhere in this workspace — a grep
// for `mailto:` / `support@` across src, apps and packages returns nothing —
// and a link to an address nobody reads is a dead affordance wearing a
// stamp. Deciding the address is the owner's call, not a build detail, so it
// is flagged rather than invented.
//
// What the screen does instead is the thing a first-time user actually needs:
// say what the advisor can answer today, and what it cannot.

import { Head, InfoScreen, Item, Para } from '@/components/info-screen';
import { tokens } from '@/theme';

export default function Help() {
  return (
    <InfoScreen title="Help & Support">
      <Head>Getting a reading</Head>
      <Para>
        Start by telling {tokens.wordmark} your birth date, the time if you
        know it, and the town you were born in. The time is what makes a chart
        specific; without it some answers stay general, and the reply will say
        so rather than guess.
      </Para>

      <Head>What it can answer today</Head>
      <Item>Your chart, and what the placements in it mean.</Item>
      <Item>Timing questions — whether a day or a window suits what you are planning.</Item>
      <Item>Compatibility between two charts, if you have both sets of details.</Item>

      <Head>What to expect</Head>
      <Para>
        It is one exchange at a time in this build: your question, then the
        reading. Longer conversations, saved readings and the chart drawn as a
        wheel are being built.
      </Para>

      <Head>If something goes wrong</Head>
      <Para>
        If a reading does not arrive, the screen says so; ask again. Readings
        spend credits, and your balance is on the settings screen.
      </Para>
      <Para>
        There is no support address in this build yet. It is on the list, and
        it will be a real mailbox when it appears rather than a link that goes
        nowhere.
      </Para>
    </InfoScreen>
  );
}
