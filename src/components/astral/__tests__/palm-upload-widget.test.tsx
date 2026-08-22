/**
 * Bug 8dc95a6a — the role-labelled palm upload, through the REAL DOM adapter.
 *
 * The reported failure was a PAIRING failure: two palms, the vision layer
 * called both the same side, and the engine deduped by side, so a pair read as
 * a re-shoot. Two slots each labelled with its ROLE removes the ambiguity at
 * the source — two roles is definitionally two hands.
 *
 * These drive `domPrimitives`, not a stub, because half the risk in the
 * ASTRAL-18 arrangement lives in the adapter and a stubbed one would launder
 * it. What CANNOT be covered here is React Native: this app has no RN jest
 * setup, so `rn-primitives.tsx`'s ImagePicker — camera and photo library —
 * is typechecked and nothing more. Said plainly rather than implied.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { fileIdFromUrl } from '@wealthai/astral';

import { renderInputRequest } from './render-shared';

const REQUEST = {
  type: 'input_request',
  ask: 'palm_intent_needs_upload',
  reason:
    "Both hands, if you have them: the non-dominant hand reads as what you " +
    "were given, the dominant as what you've made of it.",
  fields: [
    {
      key: 'dominant_palm_file_id',
      kind: 'image',
      label: 'Your dominant hand — the one you write with',
      required: false,
      allow_unknown: false,
    },
    {
      key: 'non_dominant_palm_file_id',
      kind: 'image',
      label: 'Your other hand — the non-dominant one',
      required: false,
      allow_unknown: false,
    },
  ],
};

function mockUpload(id: string) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ files: [{ url: `/api/v1/files/${id}/download` }] }),
  }) as unknown as typeof fetch;
}

function pick(testId: string, name = 'palm.jpg') {
  const input = screen.getByTestId(`${testId}-input`);
  fireEvent.change(input, {
    target: { files: [new File(['x'], name, { type: 'image/jpeg' })] },
  });
}

describe('the file id parser', () => {
  it('takes the id out of an upload URL', () => {
    expect(fileIdFromUrl('/api/v1/files/abc-123/download')).toBe('abc-123');
    expect(fileIdFromUrl('https://api.example.com/api/v1/files/abc-123/download'))
      .toBe('abc-123');
  });

  it('passes a bare id through', () => {
    expect(fileIdFromUrl('abc-123')).toBe('abc-123');
  });

  it('returns nothing rather than a guess for a URL it cannot read', () => {
    // The engine REFUSES anything with a slash, so a bad guess here would
    // surface as a refusal the user cannot act on.
    expect(fileIdFromUrl('https://example.com/some/other/thing')).toBe('');
    expect(fileIdFromUrl('')).toBe('');
  });
});

describe('the role-labelled palm upload widget', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is one question per screen, dominant first', () => {
    renderInputRequest(REQUEST);
    expect(screen.getByTestId('input-request-progress').textContent).toBe('1 of 2');
    expect(screen.getByTestId('input-request-label').textContent).toContain('dominant hand');
  });

  it('names the role and never a side', () => {
    renderInputRequest(REQUEST);
    const label = screen.getByTestId('input-request-label').textContent ?? '';
    expect(label.toLowerCase()).not.toContain('left');
    expect(label.toLowerCase()).not.toContain('right');
  });

  it('renders a real picker rather than the unknown-kind text fallback', () => {
    renderInputRequest(REQUEST);
    expect(screen.getByTestId('input-field-dominant_palm_file_id')).toBeTruthy();
    expect(screen.queryByTestId('input-field-dominant_palm_file_id-input')).toBeTruthy();
  });

  it('does not warn about an unknown kind', () => {
    const warn = jest.fn();
    renderInputRequest(REQUEST, 900, warn);
    expect(warn).not.toHaveBeenCalled();
  });

  it('uploads the picked photo and says so', async () => {
    mockUpload('file-A');
    renderInputRequest(REQUEST);
    pick('input-field-dominant_palm_file_id');
    await waitFor(() =>
      expect(screen.getByText('✓ photo attached')).toBeTruthy(),
    );
  });

  it('carries BOTH file ids in one typed answer', async () => {
    mockUpload('file-A');
    const { sent } = renderInputRequest(REQUEST);
    pick('input-field-dominant_palm_file_id');
    await waitFor(() => screen.getByText('✓ photo attached'));
    fireEvent.click(screen.getByTestId('input-request-next'));

    mockUpload('file-B');
    pick('input-field-non_dominant_palm_file_id');
    await waitFor(() => screen.getByText('✓ photo attached'));
    fireEvent.click(screen.getByTestId('input-request-next'));

    expect(sent).toHaveLength(1);
    const payload = JSON.parse(
      sent[0].split('```input_response\n')[1].split('\n```')[0],
    );
    expect(payload.ask).toBe('palm_intent_needs_upload');
    expect(payload.values).toEqual({
      dominant_palm_file_id: 'file-A',
      non_dominant_palm_file_id: 'file-B',
    });
  });

  it('the echo never shows the user a file id', async () => {
    mockUpload('8f2c-not-for-humans');
    const { sent } = renderInputRequest(REQUEST);
    pick('input-field-dominant_palm_file_id');
    await waitFor(() => screen.getByText('✓ photo attached'));
    fireEvent.click(screen.getByTestId('input-request-next'));
    fireEvent.click(screen.getByTestId('input-request-next'));
    const echo = sent[0].split('\n\n```')[0];
    expect(echo).not.toContain('8f2c');
    expect(echo).toContain('photo attached');
  });

  it('lets one hand through — skipping the second is a real reading', async () => {
    mockUpload('file-A');
    const { sent } = renderInputRequest(REQUEST);
    pick('input-field-dominant_palm_file_id');
    await waitFor(() => screen.getByText('✓ photo attached'));
    fireEvent.click(screen.getByTestId('input-request-next'));
    // Second slot: skip it outright.
    fireEvent.click(screen.getByTestId('input-request-skip'));
    const payload = JSON.parse(
      sent[0].split('```input_response\n')[1].split('\n```')[0],
    );
    expect(payload.values).toEqual({ dominant_palm_file_id: 'file-A' });
  });

  it('every slot offers a way past it', () => {
    renderInputRequest(REQUEST);
    expect(screen.getByTestId('input-request-skip')).toBeTruthy();
  });

  it('shows a failed upload instead of swallowing it', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch;
    renderInputRequest(REQUEST);
    pick('input-field-dominant_palm_file_id');
    await waitFor(() =>
      expect(
        screen.getByTestId('input-field-dominant_palm_file_id-error').textContent,
      ).toContain('500'),
    );
    expect(screen.queryByText('✓ photo attached')).toBeNull();
  });

  it('an upload with no file id in the response is an error, not a send', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ files: [{}] }),
    }) as unknown as typeof fetch;
    renderInputRequest(REQUEST);
    pick('input-field-dominant_palm_file_id');
    await waitFor(() =>
      expect(
        screen.getByTestId('input-field-dominant_palm_file_id-error').textContent,
      ).toContain('file id'),
    );
  });
});

// ── Preview: the user must see WHICH photo landed in which slot ────────────
//
// The widget exists to label a photo as the dominant or non-dominant hand. A
// control that only says "Replace photo" cannot show that the wrong photo went
// into the wrong slot — which is the one mistake it exists to prevent.

describe('the picked photo is shown back', () => {
  // jsdom has no object-URL support; the browser always does.
  beforeAll(() => {
    (URL as unknown as Record<string, unknown>).createObjectURL =
      jest.fn(() => 'blob:preview');
    (URL as unknown as Record<string, unknown>).revokeObjectURL = jest.fn();
  });
  afterAll(() => {
    delete (URL as unknown as Record<string, unknown>).createObjectURL;
    delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
  });

  it('renders a preview once a file is chosen', async () => {
    const { container } = renderInputRequest(REQUEST);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['x'], 'palm.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(container.querySelector('img[data-testid$="-preview"]')).not.toBeNull();
    });
    const img = container.querySelector('img[data-testid$="-preview"]')!;
    expect(img.getAttribute('alt')).toMatch(/preview/i);
  });

  it('shows no preview before anything is picked', () => {
    const { container } = renderInputRequest(REQUEST);
    expect(container.querySelector('img[data-testid$="-preview"]')).toBeNull();
  });
});
