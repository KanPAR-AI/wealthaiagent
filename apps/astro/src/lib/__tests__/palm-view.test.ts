// docs/49 ASTRAL-44..49 — the palm surface's decisions.
//
// Imported by RELATIVE path: `@/*` maps to the WEB app's `src` in the root
// jest project, so `@/lib/palm-view` would silently resolve to a different
// file (or to nothing).

import {
  PALM_EMPTY_LINE,
  PALM_OPENING_TURN,
  captureHint,
  captureReady,
  offTopicAskLine,
  palmAskKind,
  palmDisclosure,
  palmReplyKind,
} from '../palm-view';
import { palmUploadAskPayload, palmHandednessAskPayload } from '@wealthai/astral/fixtures';

describe('which ask arrived', () => {
  it('reads the ENGINE reason, on the engine’s own captured asks', () => {
    expect(palmAskKind(palmUploadAskPayload.ask)).toBe('upload');
    expect(palmAskKind(palmHandednessAskPayload.ask)).toBe('handedness');
  });

  it('anything else is `other` — including nothing', () => {
    expect(palmAskKind('required_slots_missing')).toBe('other');
    expect(palmAskKind('birth_time_unlocks')).toBe('other');
    expect(palmAskKind(null)).toBe('other');
    expect(palmAskKind(undefined)).toBe('other');
  });

  /**
   * The captured upload ask is the reason this is read off `ask` and not off
   * the field set: two `image` fields is a SHAPE, and a shape is not a
   * statement of what the engine is asking for.
   */
  it('the captured upload ask really is two role-labelled image fields', () => {
    expect(palmUploadAskPayload.fields.map((f) => f.kind)).toEqual(['image', 'image']);
    expect(palmUploadAskPayload.fields.map((f) => f.key)).toEqual([
      'dominant_palm_file_id',
      'non_dominant_palm_file_id',
    ]);
    // …and NEITHER is required: one usable photo is a real reading, which is
    // what `captureReady` below has to agree with.
    expect(palmUploadAskPayload.fields.every((f) => f.required === false)).toBe(true);
  });
});

describe('the capture gate matches the engine’s own requiredness', () => {
  it('one hand is enough — the "upload your left hand" loop is forbidden', () => {
    expect(captureReady(1)).toBe(true);
    expect(captureReady(2)).toBe(true);
  });

  it('no photo is not a reading', () => {
    expect(captureReady(0)).toBe(false);
  });

  it('the second hand is encouraged in COPY, never enforced', () => {
    expect(captureHint(0)).toBeNull();
    expect(captureHint(1)).toMatch(/one hand is a real reading/i);
    expect(captureHint(1)).not.toMatch(/required|must|need/i);
    expect(captureHint(2)).toMatch(/both hands ready/i);
  });
});

/**
 * docs/49 ASTRAL-44 / ASTRAL-109 / F7 — the disclosure may not promise
 * anything the product cannot do.
 *
 * Verified against source on 2026-08-28 and unchanged since F7 was written:
 * `file_service.py:50` sets `expiresAt=None`, the only `blob.delete()` is
 * commented out at `:70`, and `api/v1/endpoints/files.py` exposes upload,
 * two GETs and a corpus-media GET — no DELETE.
 */
describe('the retention disclosure is true', () => {
  const d = palmDisclosure();
  const text = d.body.join(' ');

  it('says the photo is kept', () => {
    expect(text).toMatch(/kept/i);
  });

  it('says plainly that it cannot be deleted, rather than staying quiet', () => {
    expect(text).toMatch(/cannot delete/i);
    expect(text).toMatch(/no removal path/i);
  });

  it('promises no deletion, no expiry and no "we will remove it later"', () => {
    expect(text).not.toMatch(/delete it for you\b(?! yet)/i);
    expect(text).not.toMatch(/\bwe (will|can) (delete|remove)\b/i);
    expect(text).not.toMatch(/expires?|automatically removed|deleted after/i);
  });

  it('claims no CONSENT RECORD, because nothing stores one (ASTRAL-44)', () => {
    expect(text).not.toMatch(/recorded|we have logged|your consent/i);
    expect(d.cta).toBe('Continue');
    // …and specifically not a consent-shaped button, which would assert a
    // stored acknowledgement that no endpoint accepts.
    expect(d.cta).not.toMatch(/agree|consent|accept/i);
  });

  it('offers no "analyse without storing" option, because there is no such path', () => {
    expect(text).not.toMatch(/without storing|don.t store|do not store/i);
  });

  it('asks for the other person’s permission when the hand is not yours', () => {
    expect(text).toMatch(/ask that person first/i);
    expect(text).toMatch(/labelled as theirs/i);
  });

  it('does not claim the reading is medical, financial or legal advice', () => {
    expect(text).toMatch(/not medical, financial or legal advice/i);
  });
});

describe('what the screen does with a reply', () => {
  it('a block is a reading', () => {
    expect(palmReplyKind(true, '')).toBe('reading');
    expect(palmReplyKind(true, 'some words too')).toBe('reading');
  });

  /**
   * ASTRAL-47: a non-palm image is refused by the engine and not filed. The
   * screen must show that refusal as the engine wrote it — not convert it
   * into "something went wrong", and not retry around it.
   */
  it('words with no block are the ENGINE speaking, not an error', () => {
    expect(palmReplyKind(false, 'That photo is not a palm — try again with an open hand.'))
      .toBe('said');
  });

  it('neither is `empty`, and empty has a sentence rather than a spinner', () => {
    expect(palmReplyKind(false, '')).toBe('empty');
    expect(palmReplyKind(false, '   ')).toBe('empty');
    expect(PALM_EMPTY_LINE).toMatch(/did not come back/i);
    expect(PALM_EMPTY_LINE).toMatch(/nothing was stored/i);
  });
});

describe('the opening turn names an intent and no value', () => {
  it('is a sentence', () => {
    expect(PALM_OPENING_TURN).toMatch(/palm reading/i);
  });

  it('names no field, slot or kind — the engine decides what it needs', () => {
    expect(PALM_OPENING_TURN).not.toMatch(/file_id|dominant|slot|upload/i);
  });
});

describe('an ask this screen is not for', () => {
  it('handedness gets its own sentence, because it is a real palm question', () => {
    expect(offTopicAskLine('handedness_for_palm')).toMatch(/which hand do you write with/i);
  });

  it('anything else hands over rather than rendering a mislabelled form', () => {
    const line = offTopicAskLine('required_slots_missing');
    expect(line).toMatch(/continue in chat/i);
    expect(line).not.toMatch(/palm/i);
  });
});
