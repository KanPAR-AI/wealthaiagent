import { pushRow, routeForPush } from '../push-view';

describe('the Settings row', () => {
  it('is absent on a binary without the native module (every build before push)', () => {
    expect(pushRow(false, 'undetermined')).toBe('absent');
    expect(pushRow(false, 'granted')).toBe('absent');
  });
  it('says "off in Settings" once the OS has said no — a second prompt does not exist', () => {
    expect(pushRow(true, 'denied')).toBe('os_denied');
  });
  it('is the switch otherwise', () => {
    expect(pushRow(true, 'undetermined')).toBe('switch');
    expect(pushRow(true, 'granted')).toBe('switch');
  });
});

describe('where a tapped notification goes', () => {
  it('the chat, for what the backend sends', () => {
    expect(routeForPush('yourfinadvisor://home')).toEqual({ pathname: '/' });
  });
  it('the chat, for anything a payload might try', () => {
    expect(routeForPush('yourfinadvisor://settings')).toEqual({ pathname: '/' });
    expect(routeForPush('https://evil.example/x')).toEqual({ pathname: '/' });
    expect(routeForPush(undefined)).toEqual({ pathname: '/' });
    expect(routeForPush({ pathname: '/control-centre' })).toEqual({ pathname: '/' });
  });
});
