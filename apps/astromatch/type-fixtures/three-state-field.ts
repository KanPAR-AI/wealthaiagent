/** The control for `two-state-field.ts`: the same field with one of the three
 *  real states, which must compile clean. */
import type { Candidate } from '../src/lib/confirmed';

export const inferred: Candidate = {
  state: 'inferred',
  value: 'Pune',
  confidence: 0.4,
  basis: 'this row says where they live, which may not be where they were born',
};
