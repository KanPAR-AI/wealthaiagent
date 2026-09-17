/**
 * docs/65 B2 — the birth-details carrier suggests places as the user
 * types. The pure half: what a pick becomes on the wire, and the
 * thresholds the field obeys. (The stateful field renders through the
 * host's primitives and is walked on the simulator.)
 */
import {
  PLACE_SUGGEST_DEBOUNCE_MS, PLACE_SUGGEST_MIN, placePickText,
} from '../components/input-request';

describe('a picked suggestion becomes the text a careful user would type', () => {
  it('city, country', () => {
    expect(placePickText({ name: 'Bengaluru', country: 'IN', timezone: 'Asia/Kolkata' }))
      .toBe('Bengaluru, IN');
  });
  it('city alone when the country is unknown', () => {
    expect(placePickText({ name: 'Padrauna' })).toBe('Padrauna');
    expect(placePickText({ name: ' Pune ', country: '' })).toBe('Pune');
  });
});

describe('the field asks the host sparingly', () => {
  it('two characters minimum, one request per pause', () => {
    expect(PLACE_SUGGEST_MIN).toBe(2);
    expect(PLACE_SUGGEST_DEBOUNCE_MS).toBeGreaterThanOrEqual(150);
  });
});
