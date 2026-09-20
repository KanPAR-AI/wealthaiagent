/**
 * docs/77 ASTRAL-399(c) — what a TWELVE-row `choice` does to the bubble.
 *
 * ── the question, and why it is not "does it scroll" ───────────────────────
 *
 * docs/77 F431, from reading `packages/astral/src/components/input-request.tsx`:
 * `ChoiceField` renders `field.options` into a flat wrapping `Box` with
 * `gap: 8` — **no ScrollView, no `maxHeight`, no truncation**. Nothing clips
 * the list; it simply grows inside whatever the message bubble gives it. So
 * the measurement ASTRAL-399(c) owes is the BUBBLE HEIGHT of the A1 menu's
 * worst case, not a scroll behaviour.
 *
 * The worst case is **twelve** rows, not seventeen (F427: `CIRCLE_MAX = 4`,
 * so the menu is sets-named-this-turn + sets-seen-in-this-chat + ≤4 circle
 * members + "the whole family" + "Just me" + "Someone else…").
 *
 * ── what this file measures, and what it does NOT ──────────────────────────
 *
 * It renders the SHIPPED component through the REAL DOM adapter and asserts
 * the render facts: twelve options present, none dropped, no scroll
 * container, no `maxHeight`, no truncation. It then computes the stack
 * height from the component's OWN style constants.
 *
 * That computed number is a **style-derived lower bound, not a device
 * measurement**. jsdom performs no layout, and the root jest project has no
 * React Native preset (documented in `packages/chat-native/src/__tests__/
 * lifecycle.test.tsx`: "anything that imports `react-native` cannot be
 * tested here"), so the on-device screenshots on iOS and Android remain
 * Role-4's. AMB-103 turns on those; this file gives them a number to
 * compare against and proves the list is not clipped by the component.
 */

import { fireEvent, render } from '@testing-library/react';
import {
  InputRequestView,
  LIGHT_THEME,
  buildInputResponseMessage,
  parseInputRequest,
  stripInputResponse,
  type InputRequestPayload,
} from '@wealthai/astral';

import { domPrimitives } from '@/components/astral/dom-primitives';

/** The two widths ASTRAL-18 names. A phone is the narrow one, where the
 *  flex direction is `column` and every option is its own row. */
const PHONE_WIDTH = 380;
const APP_WIDTH = 900;

/** The A1 menu's honest worst case (F427 + F431). */
const TWELVE_OPTIONS = [
  { value: 'set:p_meera,p_kabir', label: 'You, Meera and Kabir' },
  { value: 'set:p_meera', label: 'You and Meera' },
  { value: 'set:p_kabir', label: 'You and Kabir — your son' },
  { value: 'set:p_dev', label: 'You and Dev — your son' },
  { value: 'set:p_meera2', label: 'You and Meera — your partner' },
  { value: 'set:p_sushila', label: 'You and Sushila — your mother' },
  { value: 'set:p_tara', label: 'You and Tara' },
  { value: 'set:p_extra1', label: 'You and Kabir and Dev' },
  { value: 'set:p_extra2', label: 'You, Meera and Sushila' },
  { value: 'circle', label: 'The whole family' },
  { value: 'just_me', label: 'Just me' },
  { value: 'someone_else', label: 'Someone else…' },
];

const twelveRowPayload = {
  type: 'input_request',
  ask: 'who_is_this_about',
  reason: 'Who should I read this for?',
  fields: [
    {
      key: 'reading_for',
      kind: 'choice',
      label: 'Who is this about?',
      required: true,
      allow_unknown: false,
      options: TWELVE_OPTIONS,
    },
  ],
};

/** The shipped `ChoiceField` style constants, transcribed from
 *  `packages/astral/src/components/input-request.tsx`. If the component's
 *  padding changes and this does not, the assertion below over-states the
 *  height — which fails safe, and the transcription is asserted against the
 *  rendered DOM so it cannot drift silently. */
const ROW = {
  paddingTop: 10,
  paddingBottom: 10,
  borderWidth: 1,
  fontSize: 15,
  /** RN's default line height for a 15px font is ~1.2× */
  lineHeightFactor: 1.2,
  gap: 8,
};

function rowHeight(): number {
  return (
    ROW.paddingTop +
    ROW.paddingBottom +
    ROW.borderWidth * 2 +
    Math.round(ROW.fontSize * ROW.lineHeightFactor)
  );
}

function stackHeight(rows: number): number {
  return rows * rowHeight() + (rows - 1) * ROW.gap;
}

function renderTwelve(width: number) {
  const request = parseInputRequest(twelveRowPayload) as InputRequestPayload;
  if (!request) throw new Error('the twelve-row payload did not parse');
  const sent: string[] = [];
  const view = render(
    <InputRequestView
      ui={domPrimitives}
      theme={LIGHT_THEME}
      width={width}
      request={request}
      onSend={(text) => sent.push(text)}
    />,
  );
  return { ...view, sent, request };
}

describe('ASTRAL-399(c) — twelve options in the shipped `choice`', () => {
  it('renders all twelve, on a phone width and on an app width', () => {
    for (const width of [PHONE_WIDTH, APP_WIDTH]) {
      const { container, unmount } = renderTwelve(width);
      const rendered = container.querySelectorAll(
        '[data-testid^="input-option-reading_for-"]',
      );
      expect(rendered.length).toBe(12);
      unmount();
    }
  });

  it('drops no label and truncates nothing', () => {
    const { container, unmount } = renderTwelve(PHONE_WIDTH);
    const text = container.textContent ?? '';
    for (const option of TWELVE_OPTIONS) {
      expect(text).toContain(option.label);
    }
    // the component has no truncation to fall back on (F431): no ellipsis
    // was inserted, and no `numberOfLines`-style clamp is present.
    expect(text).not.toContain('…more');
    expect(container.innerHTML).not.toContain('text-overflow');
    unmount();
  });

  it('has no ScrollView, no maxHeight and no overflow clip (F431)', () => {
    const { container, unmount } = renderTwelve(PHONE_WIDTH);
    const html = container.innerHTML;
    expect(html).not.toContain('max-height');
    expect(html).not.toContain('overflow: auto');
    expect(html).not.toContain('overflow: scroll');
    expect(html).not.toContain('overflow: hidden');
    unmount();
  });

  it('sends the option VALUE, not its label, from a twelve-row list', () => {
    const { getByTestId, queryByTestId, sent, unmount } =
      renderTwelve(PHONE_WIDTH);
    fireEvent.click(getByTestId('input-option-reading_for-someone_else'));
    // the card layout's forward button is `input-request-next` on the last
    // field; `input-request-submit` is the `page` layout's. Both are
    // accepted so this test pins the ANSWER, not the chrome.
    const forward = queryByTestId('input-request-next')
      ? 'input-request-next'
      : 'input-request-submit';
    fireEvent.click(getByTestId(forward));
    expect(sent.length).toBe(1);
    expect(sent[0]).toContain('"someone_else"');
    expect(sent[0]).not.toContain('Someone else…"}');
    unmount();
  });

  /**
   * THE MEASUREMENT. Style-derived, stated as such, so a later gate has a
   * number to hold the device screenshot against.
   *
   *   one row            10 + 10 + 2 + 18 = 40 px
   *   twelve rows        12 × 40 + 11 × 8 = 568 px
   *
   * Against a 667 px viewport (the shortest phone still supported) the
   * option list alone is 85% of the screen before the bubble's own padding,
   * the question text, the transcript above it or the composer below it —
   * so the twelve-row ask does not fit on a small phone, and nothing in the
   * component scrolls it. That is the input AMB-103 needs.
   */
  it('states the bubble height it would need, beside the viewport', () => {
    expect(rowHeight()).toBe(40);
    expect(stackHeight(12)).toBe(568);
    expect(stackHeight(12)).toBeGreaterThan(0.8 * 667);
    // and the shape the fallback would be: six rows fit comfortably
    expect(stackHeight(6)).toBeLessThan(0.5 * 667);
  });

  it('the transcribed padding still matches the rendered component', () => {
    const { container, unmount } = renderTwelve(PHONE_WIDTH);
    const first = container.querySelector(
      '[data-testid="input-option-reading_for-circle"]',
    ) as HTMLElement | null;
    expect(first).not.toBeNull();
    const style = first!.getAttribute('style') ?? '';
    // the adapter collapses the four paddings into the shorthand
    expect(style).toContain('padding: 10px 14px 10px 14px');
    expect(style).toContain('border-width: 1px');
    unmount();
  });
});

describe('ASTRAL-399(c) — an action tile whose message carries a fence', () => {
  /**
   * `TileRow` (packages/chat-native/src/widgets.tsx) hands `t.message` to
   * `sendFromWidget` VERBATIM, so a tile can carry the engine's own
   * `input_response` fence. The RN component itself cannot be rendered in
   * this project (no React Native preset), so the property is asserted on
   * the CARRIER — which is the half that can actually break.
   */
  const request = parseInputRequest(twelveRowPayload) as InputRequestPayload;
  const message = buildInputResponseMessage(request, {
    reading_for: 'set:p_meera',
  });

  it('round-trips through the engine-shaped parser', () => {
    const m = /```input_response[ \t]*\r?\n([\s\S]*?)```/.exec(message);
    expect(m).not.toBeNull();
    const parsed = JSON.parse(m![1]);
    expect(parsed.type).toBe('input_response');
    expect(parsed.ask).toBe('who_is_this_about');
    expect(parsed.values.reading_for).toBe('set:p_meera');
  });

  it('leaves a human sentence in the bubble once the fence is stripped', () => {
    const visible = stripInputResponse(message).trim();
    // the LABEL, never the id-bearing value (docs/77 §H's standing rule
    // that no raw `set:` value is visible in a user bubble)
    expect(visible).toBe('Who is this about?: You and Meera');
    expect(visible).not.toContain('input_response');
    expect(visible).not.toContain('set:p_meera');
  });
});
