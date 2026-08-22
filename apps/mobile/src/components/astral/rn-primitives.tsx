/**
 * The React Native adapter for `@wealthai/astral` (docs/49 ASTRAL-18).
 *
 * Counterpart to `wealthaiagent/src/components/astral/dom-primitives.tsx`.
 * Between them, ONE chart implementation and ONE scorecard implementation
 * serve the web app, the 380 px AstroMatch extension panel and this app. This
 * file knows nothing about kootas, grahas or muhurtas — it maps a dozen style
 * keys onto `View`, `Text` and `react-native-svg`, and nothing else.
 *
 * Keep it that way. The moment domain rendering appears here, the workspace
 * has two scorecards and ASTRAL-18 is broken.
 */

import type {
  AstralPrimitives,
  AstralTextInputProps,
  BoxProps,
  GroupProps,
  PressableProps,
  TimeWheelProps,
  SvgCircleProps,
  SvgLineProps,
  SvgProps,
  SvgRectProps,
  SvgTextProps,
  TextProps,
} from '@wealthai/astral';
import {
  Pressable as RNPressable,
  ScrollView,
  TextInput as RNTextInput,
  Text as RNText,
  View,
} from 'react-native';
import Svg2, { Circle, G, Line, Rect, Text as SvgTextEl } from 'react-native-svg';

function Box({ style, testID, children }: BoxProps) {
  return (
    <View testID={testID} style={style}>
      {children}
    </View>
  );
}

function Text({ style, testID, children }: TextProps) {
  return (
    <RNText testID={testID} style={style}>
      {children}
    </RNText>
  );
}

function SvgRoot({ width, height, viewBox, testID, children }: SvgProps) {
  return (
    <Svg2 testID={testID} width={width} height={height} viewBox={viewBox}>
      {children}
    </Svg2>
  );
}

function Group({ rotation, originX, originY, children }: GroupProps) {
  // `rotation` + `originX/originY` is react-native-svg's own API for this and
  // is the reason the primitive is shaped as a group rather than a `transform`
  // string: the string form is not portable between the two SVG stacks.
  return (
    <G rotation={rotation} originX={originX} originY={originY}>
      {children}
    </G>
  );
}

function SvgRect(p: SvgRectProps) {
  return (
    <Rect
      x={p.x}
      y={p.y}
      width={p.width}
      height={p.height}
      rx={p.rx}
      stroke={p.stroke}
      strokeWidth={p.strokeWidth}
      fill={p.fill ?? 'none'}
    />
  );
}

function SvgLine(p: SvgLineProps) {
  return <Line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.strokeWidth} />;
}

function SvgCircle(p: SvgCircleProps) {
  return (
    <Circle
      cx={p.cx}
      cy={p.cy}
      r={p.r}
      stroke={p.stroke}
      strokeWidth={p.strokeWidth}
      fill={p.fill ?? 'none'}
      strokeDasharray={p.strokeDasharray}
      strokeLinecap={p.strokeLinecap}
    />
  );
}

function SvgText(p: SvgTextProps) {
  return (
    <SvgTextEl
      x={p.x}
      y={p.y}
      fontSize={p.fontSize}
      fill={p.fill}
      fontWeight={p.fontWeight}
      textAnchor={p.textAnchor}>
      {p.children}
    </SvgTextEl>
  );
}

function Pressable({
  onPress,
  disabled,
  accessibilityLabel,
  style,
  testID,
  children,
}: PressableProps) {
  return (
    <RNPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }) => [style as any, pressed ? { opacity: 0.7 } : null]}>
      {children}
    </RNPressable>
  );
}

function TextInput({
  value,
  onChangeText,
  placeholder,
  keyboard,
  style,
  accessibilityLabel,
  testID,
}: AstralTextInputProps) {
  return (
    <RNTextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType={keyboard === 'number' ? 'number-pad' : 'default'}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={style as any}
    />
  );
}

/**
 * The React Native time wheel.
 *
 * Deliberately built from `ScrollView` + `Pressable` rather than pulling in
 * `@react-native-community/datetimepicker`: this app is built locally with
 * Xcode (not EAS), so a new NATIVE module means every developer and every
 * device needs a rebuild before the widget works at all — and a picker that
 * renders as a red screen on an un-rebuilt binary is worse than one that is
 * merely not the OS control.
 *
 * Hours are 12-hour with an am/pm toggle because that is how people know
 * their birth time, but `onChange` always emits 24-hour "HH:MM": the
 * ambiguous form never leaves this file, which is the A6#3/A6#8 failure
 * class the widget exists to remove.
 *
 * This adapter knows nothing about astrology — it maps an input element
 * family, exactly like `TextInput` above.
 */
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function TimeWheel({ value, onChange, accessibilityLabel, testID }: TimeWheelProps) {
  const parsed = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
  const hour24 = parsed ? Number(parsed[1]) : 12;
  const minute = parsed ? Number(parsed[2]) : 0;
  const pm = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const emit = (h12: number, m: number, isPm: boolean) => {
    const h24 = isPm ? (h12 === 12 ? 12 : h12 + 12) : h12 === 12 ? 0 : h12;
    onChange(`${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const column = (
    items: number[],
    selected: number,
    onPick: (n: number) => void,
    pad: boolean,
    id: string,
  ) => (
    <ScrollView style={{ height: 132, width: 64 }} testID={`${testID}-${id}`}>
      {items.map((n) => (
        <RNPressable
          key={n}
          onPress={() => onPick(n)}
          testID={`${testID}-${id}-${n}`}
          style={{ paddingVertical: 6, alignItems: 'center' }}>
          <RNText
            style={{
              fontSize: 18,
              fontWeight: n === selected ? '700' : '400',
              opacity: n === selected ? 1 : 0.5,
            }}>
            {pad ? String(n).padStart(2, '0') : String(n)}
          </RNText>
        </RNPressable>
      ))}
    </ScrollView>
  );

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {column(HOURS_12, hour12, (h) => emit(h, minute, pm), false, 'hour')}
      <RNText style={{ fontSize: 18 }}>:</RNText>
      {column(MINUTES, minute, (m) => emit(hour12, m, pm), true, 'minute')}
      <View style={{ gap: 6 }}>
        {[false, true].map((isPm) => (
          <RNPressable
            key={isPm ? 'pm' : 'am'}
            onPress={() => emit(hour12, minute, isPm)}
            testID={`${testID}-${isPm ? 'pm' : 'am'}`}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderWidth: 1,
              opacity: isPm === pm ? 1 : 0.45,
            }}>
            <RNText style={{ fontSize: 14, fontWeight: '600' }}>{isPm ? 'PM' : 'AM'}</RNText>
          </RNPressable>
        ))}
      </View>
    </View>
  );
}

export const rnPrimitives: AstralPrimitives = {
  Box,
  Text,
  Svg: SvgRoot,
  Group,
  SvgRect,
  SvgLine,
  SvgCircle,
  SvgText,
  Pressable,
  TextInput,
  TimeWheel,
};
