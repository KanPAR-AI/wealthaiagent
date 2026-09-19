/**
 * docs/73 ASTRAL-321 — the DOM binding's host seam.
 *
 * Three claims, each one a failure that already happened on the native side
 * (F22) or is one copy-paste away on this one (F153):
 *
 *   1. A missing host THROWS and names the fix. It does not fall back to a
 *      plausible default — a widget that renders with no way to send an
 *      answer is a dead card that looks alive.
 *   2. The answer leaves through the host, so the package names no channel.
 *      The web's `chat-quick-reply` and the extension's service-worker send
 *      are the same seam from the binding's point of view.
 *   3. A host with no upload gets a VISIBLE refusal from the photo slot,
 *      never a tap that appears to work. The extension panel may not fetch
 *      at all (docs/73 F154), so "no upload here" is a real state.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  InputRequestView,
  LIGHT_THEME,
  parseInputRequest,
} from '@wealthai/astral';

import { domPrimitives } from '../dom-primitives';
import {
  getAstralDomHost,
  installAstralDomHost,
  isAstralDomHostInstalled,
  resetAstralDomHost,
} from '../host';

const IMAGE_ASK = {
  type: 'input_request',
  ask: 'palm_intent_needs_upload',
  reason: 'Both hands, if you have them.',
  fields: [
    {
      key: 'dominant_palm_file_id',
      kind: 'image',
      label: 'Your dominant hand',
      required: false,
      allow_unknown: false,
    },
  ],
};

function renderImageAsk() {
  const request = parseInputRequest(IMAGE_ASK);
  if (!request) throw new Error('fixture did not parse');
  return render(
    <InputRequestView
      ui={domPrimitives}
      theme={LIGHT_THEME}
      width={380}
      request={request}
      onSend={() => {}}
    />,
  );
}

function pickAFile() {
  fireEvent.change(screen.getByTestId('input-field-dominant_palm_file_id-input'), {
    target: { files: [new File(['x'], 'palm.jpg', { type: 'image/jpeg' })] },
  });
}

describe('the host seam', () => {
  afterEach(() => resetAstralDomHost());

  it('reports honestly whether a host was installed', () => {
    resetAstralDomHost();
    expect(isAstralDomHostInstalled()).toBe(false);
    installAstralDomHost({ send: () => {} });
    expect(isAstralDomHostInstalled()).toBe(true);
  });

  it('throws with the fix in the message when nothing was installed', () => {
    resetAstralDomHost();
    expect(() => getAstralDomHost()).toThrow(/installAstralDomHost/);
  });

  it('hands the composed answer to the host and names no channel itself', () => {
    const sent: string[] = [];
    installAstralDomHost({ send: (text) => sent.push(text) });
    getAstralDomHost().send('hello');
    expect(sent).toEqual(['hello']);
  });
});

describe('the photo slot, with and without a host upload', () => {
  afterEach(() => resetAstralDomHost());

  it('uploads through the host and hands back the file id', async () => {
    const seen: File[] = [];
    installAstralDomHost({
      send: () => {},
      upload: async (file) => {
        seen.push(file);
        return { url: '/api/v1/files/abc-123/download' };
      },
    });
    renderImageAsk();
    pickAFile();
    await waitFor(() => expect(seen).toHaveLength(1));
    // the slot moved on: the control now offers to REPLACE, which only
    // happens once a file id came back
    await waitFor(() => expect(screen.getByText('Replace photo')).toBeTruthy());
  });

  it('SHOWS a refusal when the host has no upload path', async () => {
    installAstralDomHost({ send: () => {} });
    renderImageAsk();
    pickAFile();
    const error = await screen.findByTestId(
      'input-field-dominant_palm_file_id-error',
    );
    expect(error.textContent ?? '').toMatch(/cannot attach a photo/i);
  });
});
