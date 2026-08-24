/**
 * (a) The one allowed difference that is about LOOKS (docs/49 ASTRAL-105,
 * amended 2026-08-24).
 *
 * The surface below is one implementation; the brands are two. So every
 * value a chat component paints with arrives through this contract, and no
 * component consults `useColorScheme()` — which is how `apps/astro`'s chart
 * wheel silently flipped to a dark palette nobody drew (ASTRAL-124, F34).
 * A host that follows the OS does it in its own adapter, where somebody
 * chose it.
 *
 * Named steps carry their own leading, per ASTRAL-97: a component SPREADS a
 * step and never states a size, so leading cannot drift from the size it
 * belongs to.
 *
 * `metrics` is deliberately explicit rather than a spacing function. The two
 * apps' scales are not the same shape — mobile's is `{2,4,8,16,24,32,64}`
 * with hand-tuned `+2`s, astro's is `4n` — and a shared function would have
 * silently re-spaced the live app by a pixel or two everywhere. Each host
 * states its own numbers; mobile's are the ones already on TestFlight.
 */

import type { TextStyle } from 'react-native';

export type ChatTypeStep = Pick<
  TextStyle,
  'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing'
>;

export interface ChatTheme {
  colors: {
    /** page ground behind the transcript and the composer */
    background: string;
    /** raised element ground: mobile's user bubble, astro's reply card and
     *  composer field */
    surface: string;
    /** a pressed / disabled / selected ground */
    surfaceStrong: string;
    /** hairlines and borders */
    line: string;
    text: string;
    textMuted: string;
    /** links inside a reply. Inheriting the body colour is how "[Download
     *  the unlocked PDF](…)" rendered as ordinary prose — tappable, with
     *  nothing to say so. */
    link: string;
    danger: string;
    /** the user's own bubble */
    userBubble: string;
    userBubbleText: string;
    /** The brand's solid: the send disc, the submit button, a selected
     *  option. One pair, because they are one decision — mobile's is its ink
     *  colour, astro's is the board's violet. */
    primary: string;
    onPrimary: string;
    /** the send disc when there is nothing to send: mobile changes the
     *  GROUND, the board keeps the violet and fades it. Both are drawn
     *  designs, so both are tokens. */
    sendDisabled: string;
    /** spinners and the chip ink */
    accent: string;
  };

  type: {
    /** a sheet or section heading — the one step outside the transcript */
    title: ChatTypeStep;
    /** running prose in a reply (the markdown body) */
    body: ChatTypeStep;
    /** the user's own words in their bubble. Separate from `body` because
     *  mobile's shipped pair is not one step: its bubbles run at weight 500
     *  and its markdown at 400, and folding them together would have made
     *  every assistant reply on the live app visibly bolder. */
    bubble: ChatTypeStep;
    small: ChatTypeStep;
    smallBold: ChatTypeStep;
    /** the composer's field. Separate from `body` because it is: mobile's
     *  composer runs 16/22 against a 16/24 transcript, and folding the two
     *  together would have re-flowed the live app's input by two points a
     *  line. */
    input: ChatTypeStep;
  };

  radius: {
    bubble: number;
    /** the squared-off corner on the sender's side */
    tail: number;
    card: number;
    input: number;
    chip: number;
  };

  metrics: {
    /** gutter either side of a transcript row */
    rowPaddingX: number;
    /** space between transcript rows */
    rowGapY: number;
    bubblePaddingX: number;
    bubblePaddingY: number;
    /** the composer's own padding, inside the bar */
    composerPaddingX: number;
    composerPaddingY: number;
    /** the field's inner padding */
    fieldPaddingY: number;
    /** the round send button */
    sendSize: number;
    /** its opacity when there is nothing to send (1 = the ground changes
     *  instead) */
    sendDisabledOpacity: number;
    /** the composer's field padding on the leading edge — wider when there
     *  is no attach button in front of the text */
    fieldPaddingStart: number;
    /** does the composer bar sit under a hairline (mobile) or on the open
     *  paper ground (the board)? */
    composerBarBorderTop: boolean;
    /** is the field outlined (the board) or filled only (mobile)? */
    composerFieldBorder: boolean;
    /** how tall the composer's field may grow before it scrolls */
    maxInputHeight: number;
    /** the widget row's gaps */
    widgetGap: number;

    /**
     * Does an assistant reply sit on a floating CARD, or run full-width?
     *
     * Both are drawn designs, not preferences: ChatGPT (and `apps/mobile`)
     * runs the reply full-width with no bubble; the board's frame 04 floats
     * it on a light card. It is a brand decision, so it is a token.
     */
    assistantCard: boolean;
  };

  /** Shadow for a floating card, when the brand floats rather than outlines.
   *  Ignored when `assistantCard` is false. */
  cardElevation?: {
    color: string;
    opacity: number;
    radius: number;
    offsetY: number;
  };
}
