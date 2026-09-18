import { OFFER_QUIET_DAYS, pushRow, routeForPush, shouldOfferPush } from '../push-view';

const base = { supported: true, permission: 'undetermined' as const, hasDayCard: true, dismissedAt: null, now: 1_000_000_000_000 };

describe('when the morning line may be offered', () => {
  it('a supported binary, an undecided OS and a day card to promise from', () => {
    expect(shouldOfferPush(base)).toBe(true);
  });
  it('never on a binary without the native module (builds 12 and 13)', () => {
    expect(shouldOfferPush({ ...base, supported: false })).toBe(false);
  });
  it('never before there is a day card', () => {
    expect(shouldOfferPush({ ...base, hasDayCard: false })).toBe(false);
  });
  it('never once the OS has answered — a second system prompt does not exist', () => {
    expect(shouldOfferPush({ ...base, permission: 'denied' })).toBe(false);
    expect(shouldOfferPush({ ...base, permission: 'granted' })).toBe(false);
  });
  it('"Not now" is respected for a fortnight', () => {
    const day = 86_400_000;
    expect(shouldOfferPush({ ...base, dismissedAt: base.now - 3 * day })).toBe(false);
    expect(shouldOfferPush({ ...base, dismissedAt: base.now - (OFFER_QUIET_DAYS + 1) * day })).toBe(true);
  });
});

describe('the Profile row', () => {
  it('is absent without the module, honest when the OS said no, a switch otherwise', () => {
    expect(pushRow(false, 'granted')).toBe('absent');
    expect(pushRow(true, 'denied')).toBe('os_denied');
    expect(pushRow(true, 'undetermined')).toBe('switch');
    expect(pushRow(true, 'granted')).toBe('switch');
  });
});

describe('a tapped notification goes only where the app allows', () => {
  it('knows its own routes', () => {
    expect(routeForPush('astro://home')).toEqual({ pathname: '/home' });
    expect(routeForPush('astro://day?date=2026-09-21')).toEqual({ pathname: '/day', params: { date: '2026-09-21' } });
  });
  it('sends everything else Home', () => {
    for (const bad of ['https://evil.example', 'astro://sign-in', 'astro://../x', '', null, 42]) {
      expect(routeForPush(bad)).toEqual({ pathname: '/home' });
    }
  });
  it('drops a parameter it cannot read as a plain value', () => {
    expect(routeForPush('astro://day?date=<script>')).toEqual({ pathname: '/day' });
  });
});
