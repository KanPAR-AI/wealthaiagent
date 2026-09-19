/** The control for `sends-parsed.ts`: the same door with a CONFIRMED profile,
 *  which must compile clean. Without this pair, "it failed to compile" would
 *  prove nothing about which error it failed on. */
import { confirmProfile } from '../src/lib/confirmed';
import { requestMatch } from '../src/lib/messages';

const outcome = confirmProfile('manual', {
  name: { act: 'typed', value: 'Someone' },
  dob: { act: 'typed', value: '1994-05-14' },
  tob: { act: 'declined' },
  pob: { act: 'typed', value: 'Pune, India' },
});

export const sent = outcome.ok ? requestMatch(outcome.profile, 'Match — Someone') : null;
