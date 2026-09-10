/**
 * The player gate — the fix for the 2026-09-10 RCA's client defect: the
 * initial `#t` seek was issued in the useVideoPlayer setup callback, before
 * the item was ready, so expo-video dropped it and Library taps played the
 * wrong content from 0:00. Relative imports on purpose: `@/*` maps to the
 * web app's src in the root jest project.
 */
import { CACHING_IOS, createPlayerGate, useCachingFor } from '../player-view';

describe('the initial seek waits for readyToPlay and fires once', () => {
  it('does not seek before the player is ready', () => {
    const gate = createPlayerGate(71, 140);
    expect(gate.onStatus('idle')).toBeNull();
    expect(gate.onStatus('loading')).toBeNull();
  });

  it('seeks to the segment start exactly when ready', () => {
    const gate = createPlayerGate(71, 140);
    expect(gate.onStatus('readyToPlay')).toBe(71);
  });

  it('never seeks twice — the replaceAsync language switch restores its own position', () => {
    const gate = createPlayerGate(71, 140);
    expect(gate.onStatus('readyToPlay')).toBe(71);
    // the language switch swaps sources; the new item goes ready again
    expect(gate.onStatus('readyToPlay')).toBeNull();
  });

  it('a start of 0 needs no seek at all', () => {
    const gate = createPlayerGate(0, 140);
    expect(gate.onStatus('readyToPlay')).toBeNull();
  });
});

describe('the loop returns to the segment start, without re-entry', () => {
  it('stays quiet inside the segment', () => {
    const gate = createPlayerGate(71, 140);
    expect(gate.onTime(139.9)).toBeNull();
  });

  it('loops back on reaching the end', () => {
    const gate = createPlayerGate(71, 140);
    expect(gate.onTime(140)).toBe(71);
  });

  it('a slow seek cannot re-enter: ticks still past end are swallowed', () => {
    const gate = createPlayerGate(71, 140);
    expect(gate.onTime(140)).toBe(71); // seek issued…
    expect(gate.onTime(140.25)).toBeNull(); // …still landing
    expect(gate.onTime(140.5)).toBeNull();
  });

  it('re-arms once the playhead reports back inside the segment', () => {
    const gate = createPlayerGate(71, 140);
    expect(gate.onTime(140)).toBe(71);
    expect(gate.onTime(71.3)).toBeNull(); // landed — guard cleared
    expect(gate.onTime(140.1)).toBe(71); // next lap loops again
  });

  it('playToEnd loops with the same guard', () => {
    const gate = createPlayerGate(71, 140);
    expect(gate.onPlayToEnd()).toBe(71);
    expect(gate.onTime(140.2)).toBeNull(); // straggler tick after the jump
    expect(gate.onTime(72)).toBeNull();
    expect(gate.onTime(140.3)).toBe(71);
  });

  it('no end means no loop — the video just plays', () => {
    const gate = createPlayerGate(71, null);
    expect(gate.onTime(9999)).toBeNull();
  });
});

describe('useCaching stays off on iOS while the player URL is the no-store redirect', () => {
  it('android caches', () => {
    expect(useCachingFor('android')).toBe(true);
  });

  it('ios does not — ETags fixed the 206, not the redirect the cache choked on', () => {
    expect(CACHING_IOS).toBe(false);
    expect(useCachingFor('ios')).toBe(false);
  });

  it('anything else does not cache', () => {
    expect(useCachingFor('web')).toBe(false);
  });
});
