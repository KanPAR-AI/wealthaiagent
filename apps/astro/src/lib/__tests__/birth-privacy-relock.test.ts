/**
 * The RE-LOCK WIRING, driven for real (Role-3's blocking test gap).
 *
 * Four mutations used to survive the entire suite: the root layout's
 * `state !== 'active'` flipped to `false` and to `=== 'active'` (re-locking
 * on the way BACK, so the iOS app-switcher photographs an unlocked screen —
 * the exact bug the comment beside it warned about), and each of the two
 * dispatches deleted. All four were invisible because the logic sat inside a
 * `useEffect` in a `.tsx` this jest project cannot import.
 *
 * It now lives behind a seam that TAKES the subscriber, so these cases pass
 * a fake AppState and drive the real handler — the same function the root
 * layout and the hook both register.
 */

const probe = jest.fn();
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: probe }), { virtual: true });
jest.mock('expo-local-authentication', () => ({}), { virtual: true });

import {
  installBirthPrivacyRelock,
  onAppStateChange,
  onScreenBlur,
  useBirthPrivacy,
  type AppStateLike,
} from '../birth-privacy';
import { LOCKED, eventForAppState, eventForScreenBlur } from '../birth-privacy-view';

/** A stand-in for react-native's `AppState`, with the handler kept. */
function fakeAppState() {
  let handler: ((state: string) => void) | null = null;
  let removed = false;
  const appState: AppStateLike = {
    addEventListener: (_type, h) => {
      handler = h;
      return { remove: () => { removed = true; handler = null; } };
    },
  };
  return {
    appState,
    fire: (state: string) => handler?.(state),
    get subscribed() { return handler !== null; },
    get removed() { return removed; },
  };
}

const unlock = () =>
  useBirthPrivacy.getState().dispatch({ type: 'unlocked', at: Date.now() });
const revealed = () => useBirthPrivacy.getState().revealed();

beforeEach(() => {
  probe.mockReturnValue(null);
  useBirthPrivacy.setState({ state: LOCKED });
});

describe('which app states close the lock', () => {
  it('every state but `active` closes it — `inactive` included', () => {
    // `inactive` is the state iOS is in WHILE the switcher snapshot is
    // taken. A rule that only caught `background` would mask one frame late.
    for (const state of ['background', 'inactive', 'unknown', 'extension']) {
      expect(eventForAppState(state)).toEqual({ type: 'app_backgrounded' });
    }
  });

  it('`active` closes nothing — a re-lock on the way BACK is the bug', () => {
    expect(eventForAppState('active')).toBeNull();
  });

  it('leaving a screen closes it', () => {
    expect(eventForScreenBlur()).toEqual({ type: 'left_screen' });
  });
});

describe('the handler the root layout and the hook both register', () => {
  it('re-locks when the app goes to the background', () => {
    unlock();
    expect(revealed()).toBe(true);
    onAppStateChange('background');
    expect(revealed()).toBe(false);
  });

  it('re-locks on `inactive`, before the snapshot', () => {
    unlock();
    onAppStateChange('inactive');
    expect(revealed()).toBe(false);
  });

  it('does NOT re-lock on the way back to active', () => {
    // Not a nicety: if coming back re-locked, then going OUT did not, and
    // the switcher card was photographed with the values on screen.
    unlock();
    onAppStateChange('active');
    expect(revealed()).toBe(true);
  });

  it('re-locks on screen blur', () => {
    unlock();
    onScreenBlur();
    expect(revealed()).toBe(false);
  });
});

describe('the subscription itself', () => {
  it('subscribes, re-locks through the real handler, and unsubscribes', () => {
    const app = fakeAppState();
    const off = installBirthPrivacyRelock(app.appState);
    expect(app.subscribed).toBe(true);

    unlock();
    app.fire('background');
    expect(revealed()).toBe(false);

    off();
    expect(app.removed).toBe(true);
    // …and after unsubscribing nothing else happens through it
    unlock();
    app.fire('background');
    expect(revealed()).toBe(true);
  });

  it('calls `onActive` ONLY on the way back, and re-locks on the way out', () => {
    const app = fakeAppState();
    const onActive = jest.fn();
    installBirthPrivacyRelock(app.appState, onActive);

    unlock();
    app.fire('background');
    expect(onActive).not.toHaveBeenCalled();
    expect(revealed()).toBe(false);

    app.fire('active');
    expect(onActive).toHaveBeenCalledTimes(1);
    // …and returning did not re-open it either
    expect(revealed()).toBe(false);
  });

  it('a subscriber with no `onActive` still re-locks', () => {
    const app = fakeAppState();
    installBirthPrivacyRelock(app.appState);
    unlock();
    app.fire('inactive');
    expect(revealed()).toBe(false);
  });
});
