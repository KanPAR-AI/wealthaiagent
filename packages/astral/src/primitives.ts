/**
 * The renderer contract that lets ASTRAL-18 be literally true.
 *
 * ASTRAL-18: "the extension's 380 px side panel and the app's compatibility
 * screen are the same artifact, built once as a responsive component in the
 * shared workspace with width as a prop. A second implementation of the match
 * scorecard anywhere in the workspace is a SPEC-DEVIATION."
 *
 * The obstacle is physical: the extension and the web app render through React
 * DOM, the app renders through React Native. `<div>` and `<View>` cannot be
 * the same element. So the scorecard is written ONCE against the small set of
 * primitives below, and each host supplies a ~100-line adapter that maps them
 * to its element family. The adapter is not a scorecard renderer — it knows
 * nothing about kootas, gunas or wheels — so the grep at the gate finds
 * exactly one implementation of each artifact, which is the property the row
 * is actually asking for.
 *
 * The style vocabulary is deliberately tiny and is the INTERSECTION of what
 * both platforms mean the same way. Two traps it exists to avoid:
 *   - `flexDirection` defaults to `row` in CSS and `column` in RN, so `Box`
 *     is specified as column-by-default and the web adapter must set that.
 *   - RN `Text` does not inherit style through an intervening `View`, so
 *     every piece of text carries its own style. Do not rely on inheritance.
 */

import type { ComponentType, ReactNode } from 'react';

export interface AstralBoxStyle {
  flexDirection?: 'row' | 'column';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
  flexWrap?: 'wrap' | 'nowrap';
  flex?: number;
  flexShrink?: number;
  gap?: number;
  padding?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  marginTop?: number;
  marginBottom?: number;
  backgroundColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  borderTopWidth?: number;
  borderLeftWidth?: number;
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  alignSelf?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  opacity?: number;
}

/**
 * Layout keys that are legal on TEXT as well as on a box.
 *
 * React Native's `Text` accepts layout style, and in the DOM adapter every
 * `Text` is a `<span>` inside a `display:flex` parent, so it is a flex item
 * and `flex` / `width` apply there too. Sharing the exact key set is what
 * keeps a row laid out the same on both platforms from one source file.
 */
type AstralTextLayout = Pick<
  AstralBoxStyle,
  'width' | 'minWidth' | 'maxWidth' | 'flex' | 'flexShrink' | 'alignSelf' | 'marginTop' | 'marginBottom' | 'opacity'
>;

export interface AstralTextStyle extends AstralTextLayout {
  fontSize?: number;
  fontWeight?: '400' | '500' | '600' | '700';
  color?: string;
  letterSpacing?: number;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  fontStyle?: 'normal' | 'italic';
  textTransform?: 'none' | 'uppercase';
}

export interface BoxProps {
  style?: AstralBoxStyle;
  /** surfaced on the host element for tests and for accessibility tooling */
  testID?: string;
  children?: ReactNode;
}

export interface TextProps {
  style?: AstralTextStyle;
  testID?: string;
  children?: ReactNode;
}

export interface SvgProps {
  width: number;
  height: number;
  viewBox: string;
  testID?: string;
  children?: ReactNode;
}

export interface GroupProps {
  rotation?: number;
  originX?: number;
  originY?: number;
  children?: ReactNode;
}

export interface SvgRectProps {
  x: number;
  y: number;
  width: number;
  height: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  rx?: number;
}

export interface SvgLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke?: string;
  strokeWidth?: number;
}

export interface SvgCircleProps {
  cx: number;
  cy: number;
  r: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  strokeDasharray?: string;
  strokeLinecap?: 'butt' | 'round';
}

export interface SvgTextProps {
  x: number;
  y: number;
  fontSize: number;
  fill: string;
  fontWeight?: '400' | '500' | '600' | '700';
  textAnchor?: 'start' | 'middle' | 'end';
  children?: ReactNode;
}

/**
 * The interactive half of the contract (docs/49 ASTRAL-91).
 *
 * PH-3's components only ever drew, so the contract only had drawing in it.
 * The input widget has to be TAPPED, and a tap target is the one place where
 * `<button>` and `Pressable` genuinely cannot be the same element. So three
 * more primitives, mapped by the same two adapters, and the widget itself
 * still exists exactly once for web, React Native and the 380 px panel.
 */
export interface PressableProps {
  onPress: () => void;
  disabled?: boolean;
  /** what a screen reader announces — this is a question, not decoration */
  accessibilityLabel?: string;
  style?: AstralBoxStyle;
  testID?: string;
  children?: ReactNode;
}

export interface AstralTextInputProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** `number` asks for a numeric keypad where one exists */
  keyboard?: 'default' | 'number';
  /**
   * How the OS capitalises what is typed.
   *
   * On the contract because the platform DEFAULT is wrong for the field this
   * widget asks most often: React Native capitalises sentences, so a place
   * typed mid-form arrives as "Ranchi" only by luck of it being first, and
   * "new delhi" stays lower-case.
   */
  autoCapitalize?: 'none' | 'words' | 'sentences';
  /**
   * OS autocorrect and spell-check. Turn it OFF for a proper noun.
   *
   * "Padrauna" is not a typo, and a keyboard that helpfully replaces it sends
   * a different place to the geocoder — which either refuses it (a user
   * blamed for the keyboard's edit) or resolves somewhere else entirely (a
   * chart cast on the wrong coordinates, with nothing on its face to say so).
   */
  autoCorrect?: boolean;
  /** `done` labels the return key and dismisses the keyboard on it, which is
   *  what a single-field form wants. It does NOT submit: submitting a form
   *  the user has not finished is worse than one more tap. */
  returnKey?: 'done' | 'default';
  style?: AstralBoxStyle & AstralTextStyle;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * A time of day, entered the way the host does it best.
 *
 * This is a PRIMITIVE rather than a shared component because "native picker"
 * is precisely the part that cannot be written once: on the web the honest
 * answer is `<input type="time">`, which is the OS picker on every phone
 * browser, and React Native has no equivalent element. What stays shared is
 * everything around it — the question, the progress, the "I don't know", the
 * validation and the carrier.
 *
 * `value` is 24-hour "HH:MM" or null when nothing has been chosen. 24-hour on
 * the wire is deliberate: am/pm loss is one of the two failures (A6#3, A6#8)
 * this whole widget exists to remove, so the ambiguous form never travels.
 */
export interface TimeWheelProps {
  value: string | null;
  onChange: (value: string) => void;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * A date, entered the way the host does it best (docs/49 ASTRAL-96).
 *
 * A PRIMITIVE for exactly the reason `TimeWheel` is one, and the reason is
 * not symmetry: `<input type="date">` IS the OS date picker on every phone
 * browser and React Native has no equivalent element, so "native picker" is
 * the one part that cannot be written once. Everything around it — the
 * question, the progress, the validation, the carrier — stays shared.
 *
 * `value` is ISO `YYYY-MM-DD` or null when nothing has been chosen. ISO on
 * the wire is deliberate and it is the whole reason ASTRAL-96 asks for a
 * picker at all: `03/04/1989` is the 3rd of April to half the world and the
 * 4th of March to the other half, and the ambiguous form never leaves the
 * host.
 *
 * `minYear`/`maxYear` bound the wheel to plausible birth years. They are a
 * COURTESY, not a validation: the engine refuses an implausible year with a
 * named reason (`_validate_input_value`), because a client-side bound that
 * silently clamps is how a wrong date gets charted as a right one.
 */
export interface DateWheelProps {
  value: string | null;
  onChange: (value: string) => void;
  minYear: number;
  maxYear: number;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * A photo, chosen and uploaded the way the host does it best (bug 8dc95a6a).
 *
 * A PRIMITIVE for the same reason `TimeWheel` is one: picking a photo is
 * precisely the part that cannot be written once. On the web the honest
 * answer is `<input type="file" accept="image/*" capture>`, which is the OS
 * camera/library sheet on every phone browser; React Native has no such
 * element and goes through `expo-image-picker` and a native streaming
 * upload. Both hosts already have that code and neither should grow a
 * second copy.
 *
 * `value` is the uploaded FILE ID, or null before anything is chosen — the
 * host does the upload and hands back the id, so nothing about auth, retry
 * or multipart leaks into the shared component. `busy` lets the shared
 * component show an honest in-flight state instead of pretending the tap
 * did nothing.
 */
export interface AstralImagePickerProps {
  value: string | null;
  /** called with the uploaded file id once the host has it */
  onChange: (fileId: string) => void;
  /** the role this slot is for, shown on the control */
  label?: string;
  accessibilityLabel?: string;
  testID?: string;
}

export interface AstralPrimitives {
  /**
   * How THIS host's date and time controls present themselves — the one
   * thing about a picker the shared widget cannot know and must not guess.
   *
   * `'field'` (the default, and what every host did before this existed):
   *   the control already draws its own labelled field row. `<input
   *   type="date">` IS the row in a browser, and wrapping it in a second
   *   bordered box gives a double border and two hit targets for one answer.
   *
   * `'disclosure'`: the control is a PICKER BODY only. React Native has no
   *   element that draws itself as a field, so the shared widget draws the
   *   board's frame-2 row — label, formatted value, glyph — and reveals the
   *   picker underneath when it is tapped. This is what makes the form read
   *   as three quiet rows instead of three stacked wheels, which is the
   *   owner's "gives impression of an unpolished app" verbatim.
   *
   * It is declared BY THE HOST rather than sniffed from the platform inside
   * the shared component, for the same reason every other capability here is:
   * a `Platform.OS` check in `packages/astral` would make one source file
   * behave differently per platform, which is precisely what ASTRAL-18 says
   * the adapter seam exists to prevent.
   */
  pickerPresentation?: 'field' | 'disclosure';
  Box: ComponentType<BoxProps>;
  Text: ComponentType<TextProps>;
  Svg: ComponentType<SvgProps>;
  Group: ComponentType<GroupProps>;
  SvgRect: ComponentType<SvgRectProps>;
  SvgLine: ComponentType<SvgLineProps>;
  SvgCircle: ComponentType<SvgCircleProps>;
  SvgText: ComponentType<SvgTextProps>;
  Pressable: ComponentType<PressableProps>;
  TextInput: ComponentType<AstralTextInputProps>;
  TimeWheel: ComponentType<TimeWheelProps>;
  DateWheel: ComponentType<DateWheelProps>;
  ImagePicker: ComponentType<AstralImagePickerProps>;
}

/** Colour tokens a host supplies so the shared components carry no palette. */
export interface AstralTheme {
  text: string;
  textMuted: string;
  /** the "this is not known" ink — used for pending/absent rows */
  textPending: string;
  line: string;
  surface: string;
  surfaceAlt: string;
  /** Violet: INTERACTION — buttons, chips, links, the send disc, the
   *  "current" marker. Everything a finger is meant to reach for. */
  accent: string;
  /**
   * Gold: CEREMONY — the compatibility ring, and nothing a finger reaches for.
   *
   * docs/49 ASTRAL-98 / F25: the board has two accents with different jobs and
   * one token cannot serve both — supplying a gold `accent` to get the ring
   * right turns every button gold. REQUIRED, so a host that constructs a theme
   * without choosing a ceremonial colour fails to compile rather than
   * silently falling back to the interactive one.
   */
  ceremonial: string;
  warn: string;
  border: string;
}

export const LIGHT_THEME: AstralTheme = {
  text: '#1a1523',
  textMuted: '#6b6577',
  textPending: '#8a8494',
  line: '#3b3548',
  surface: '#ffffff',
  surfaceAlt: '#f5f3f8',
  // The board's violet, sampled off frame 04's user bubble (#5b3a93). The
  // ceremonial gold is DEEPER here than on the dark theme: the board's
  // #e8c986 on a white card is a 7px ring nobody can see.
  accent: '#5a378e',
  ceremonial: '#c9a227',
  warn: '#b45309',
  border: '#e3dfea',
};

export const DARK_THEME: AstralTheme = {
  text: '#f2eefb',
  textMuted: '#a49db4',
  textPending: '#8a8397',
  line: '#cfc7e0',
  surface: '#17141f',
  surfaceAlt: '#221d2e',
  accent: '#a78bfa',
  // the board's own gold, which is drawn on the cosmic field
  ceremonial: '#e8c986',
  warn: '#fbbf24',
  border: '#332c42',
};

/**
 * Every shared component takes exactly this. `width` is the prop ASTRAL-18
 * names: 380 for the extension side panel, the measured screen width in the
 * app, the container width on the web compatibility screen.
 */
export interface AstralRenderProps {
  ui: AstralPrimitives;
  theme: AstralTheme;
  width: number;
}

/**
 * The one breakpoint. Below it the layout is a single column (the extension
 * panel and every phone); at or above it, side-by-side blocks are allowed.
 * 380 px — the extension's declared panel width — must land BELOW it, so the
 * panel and a phone get the same treatment.
 */
export const WIDE_LAYOUT_MIN_WIDTH = 520;

export const isWide = (width: number): boolean => width >= WIDE_LAYOUT_MIN_WIDTH;
