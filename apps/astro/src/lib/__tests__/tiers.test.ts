import { looksLikePerson } from '../tiers-view';

describe('who a tier can be set for', () => {
  it('an email, an E.164 phone, or a uid', () => {
    expect(looksLikePerson('friend@example.com')).toBe(true);
    expect(looksLikePerson(' +919876543210 ')).toBe(true);
    expect(looksLikePerson('a1B2c3D4e5F6g7H8i9J0k1L2m3N4')).toBe(true);
  });
  it('nothing else', () => {
    for (const bad of ['', 'friend', 'friend@', '9876543210', 'two words@x.co']) {
      expect(looksLikePerson(bad)).toBe(false);
    }
  });
});
