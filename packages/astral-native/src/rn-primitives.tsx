/**
 * The React Native adapter for `@wealthai/astral` (docs/49 ASTRAL-18/99).
 *
 * Counterpart to `wealthaiagent/src/components/astral/dom-primitives.tsx`.
 * Between them, ONE chart implementation and ONE scorecard implementation
 * serve the web app, the 380 px AstroMatch extension panel and BOTH native
 * apps. This file knows nothing about kootas, grahas or muhurtas — it maps a
 * dozen style keys onto `View`, `Text` and `react-native-svg`, and nothing
 * else.
 *
 * Keep it that way. The moment domain rendering appears here, the workspace
 * has two scorecards and ASTRAL-18 is broken.
 *
 * It lives in a PACKAGE rather than in an app because it used to live in
 * `apps/mobile` and import `@/lib/auth` and `@/lib/upload` — and `@/*` maps
 * to `./src/*` in both apps, so copying it into the second app would have
 * compiled rather than failed (F22). The two capabilities it needs now
 * arrive through `getAstralHost()`.
 */

import { useState } from 'react';
import type {
  AstralImagePickerProps,
  AstralPrimitives,
  AstralTextInputProps,
  BoxProps,
  GroupProps,
  PressableProps,
  TimeWheelProps,
  DateWheelProps,
  SvgCircleProps,
  SvgLineProps,
  SvgProps,
  SvgRectProps,
  SvgTextProps,
  TextProps,
} from '@wealthai/astral';
import { fileIdFromUrl } from '@wealthai/astral';
import * as ExpoImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image as ExpoImage } from 'expo-image';
import {
  Alert,
  Pressable as RNPressable,
  ScrollView,
  TextInput as RNTextInput,
  Text as RNText,
  View,
} from 'react-native';
import Svg2, { Circle, G, Line, Rect, Text as SvgTextEl } from 'react-native-svg';

import { getAstralHost } from './host';

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

/**
 * The React Native date wheel (docs/49 ASTRAL-96).
 *
 * Built from `ScrollView` + `Pressable` for the SAME reason `TimeWheel`
 * above is, and it is worth restating rather than assuming: this app is
 * built locally with Xcode, not EAS, so a new native module means every
 * developer and every device needs a rebuild before the widget works at
 * all — and a picker that red-screens on an un-rebuilt binary is worse than
 * one that is merely not the OS control.
 *
 * Months are NAMED, never numbered. `03/04/1989` is the ambiguity this
 * picker exists to remove (ASTRAL-96), and three numeric columns would put
 * it straight back: a user scrolling "3" and "4" has told us nothing more
 * than typing it did. `onChange` always emits ISO `YYYY-MM-DD`.
 *
 * The day column is clamped to the month's real length, so 31 February
 * cannot be assembled here — but a date that is nonetheless impossible is
 * still refused BY THE ENGINE with a named reason. This adapter knows
 * nothing about astrology and validates nothing on its behalf.
 */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** row height of a date column: 17pt text + 6pt padding either side */
const DATE_ROW_HEIGHT = 29;

function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

function DateWheel({ value, onChange, minYear, maxYear, accessibilityLabel, testID }: DateWheelProps) {
  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  const today = new Date();
  const year = parsed ? Number(parsed[1]) : Math.min(maxYear, today.getFullYear() - 25);
  const month = parsed ? Number(parsed[2]) : 1;
  const day = parsed ? Number(parsed[3]) : 1;

  const emit = (y: number, m: number, d: number) => {
    const clamped = Math.min(d, daysInMonth(y, m));
    onChange(
      `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`,
    );
  };

  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y -= 1) years.push(y);
  const days: number[] = [];
  for (let d = 1; d <= daysInMonth(year, month); d += 1) days.push(d);

  // Each column opens ON its own selection rather than at the top of its
  // list. Measured on the simulator: the year column runs from this year
  // downwards, so an unscrolled wheel offered 2026 as the first birth year a
  // user sees — and the value it would actually emit was 25 years down, out
  // of sight. `contentOffset` is an initial position, not state: scrolling
  // still does whatever the finger says.
  const column = (
    items: number[],
    selected: number,
    onPick: (n: number) => void,
    render: (n: number) => string,
    width: number,
    id: string,
  ) => (
    <ScrollView
      style={{ height: 132, width }}
      testID={`${testID}-${id}`}
      contentOffset={{
        x: 0,
        y: Math.max(0, items.indexOf(selected) - 1) * DATE_ROW_HEIGHT,
      }}>
      {items.map((n) => (
        <RNPressable
          key={n}
          onPress={() => onPick(n)}
          testID={`${testID}-${id}-${n}`}
          style={{ paddingVertical: 6, alignItems: 'center' }}>
          <RNText
            style={{
              fontSize: 17,
              fontWeight: n === selected ? '700' : '400',
              opacity: n === selected ? 1 : 0.5,
            }}>
            {render(n)}
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
      {column(days, day, (d) => emit(year, month, d), (d) => String(d), 52, 'day')}
      {column(
        MONTHS.map((_m, i) => i + 1),
        month,
        (m) => emit(year, m, day),
        (m) => MONTHS[m - 1].slice(0, 3),
        76,
        'month',
      )}
      {column(years, year, (y) => emit(y, month, day), (y) => String(y), 72, 'year')}
    </View>
  );
}

/**
 * A photo slot, on the device (bug 8dc95a6a).
 *
 * The picking half is `expo-image-picker`, the same sheet the composer
 * already uses. The uploading half belongs to the HOST: it is a native
 * multipart upload with three documented SDK-57 dead ends behind it
 * (`apps/mobile/src/lib/upload.ts`), and it is exactly the kind of app-local
 * capability F22 says must not be imported across an app boundary. What
 * arrives back is a URL; the shared `fileIdFromUrl` turns it into the id the
 * engine's `image` field accepts, because that field REFUSES a URL rather
 * than coercing one.
 *
 * Two refusals here, both VISIBLE, neither silent:
 *   - a host with no upload capability (`apps/astro` today) says so;
 *   - a null token — the case mobile's `Promise<string | null>` carries and
 *     a narrower contract would have erased — is an honest refusal to
 *     upload, never an unauthenticated request.
 *
 * A failure is SHOWN, never swallowed — a control that looks the same
 * before and after a tap is how the same hand gets sent twice.
 */
function ImagePicker({
  value,
  onChange,
  label,
  accessibilityLabel,
  testID,
}: AstralImagePickerProps) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // A palm shot is usually taken in the moment; forcing a detour through the
  // Camera app is the same friction chat-input.tsx already solved.
  const choose = () => {
    if (busy) return;
    Alert.alert(label || 'Add photo', undefined, [
      { text: 'Take photo', onPress: () => { void pick('camera'); } },
      { text: 'Choose from library', onPress: () => { void pick('library'); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pick = async (source: 'camera' | 'library') => {
    if (busy) return;
    if (source === 'camera') {
      const perm = await ExpoImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera access needed',
          'Enable camera access in Settings to take a photo.');
        return;
      }
    }
    const res = source === 'camera'
      ? await ExpoImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.85 })
      : await ExpoImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.85 });
    const asset = res.assets?.[0];
    if (!asset) return;
    setPreview(asset.uri);          // instant feedback, before the upload
    setBusy(true);
    try {
      const host = getAstralHost();
      if (!host.upload) {
        throw new Error('This app cannot attach photos yet.');
      }
      const token = await host.getToken();
      if (!token) throw new Error('Not signed in');
      // Downscale before uploading. A full-res palm photo is several MB and
      // uploads crawl on a slow or LAN connection (bug af85427f, solved the
      // same way in chat-input.tsx). 1600px + JPEG 0.7 — vision models
      // downscale internally, so no analysis quality is lost. EXIF survives
      // the resize, which ASTRAL palm orientation now depends on.
      let uri = asset.uri;
      let mime = asset.mimeType || 'image/jpeg';
      if ((asset.width ?? 9999) > 1600) {
        try {
          const r = await manipulateAsync(asset.uri, [{ resize: { width: 1600 } }],
                                          { compress: 0.7, format: SaveFormat.JPEG });
          uri = r.uri;
          mime = 'image/jpeg';
        } catch {
          /* keep the original on any manipulation failure */
        }
      }
      const uploaded = await host.upload(token, {
        uri,
        name: asset.fileName || `palm_${Date.now()}.jpg`,
        type: mime,
        size: asset.fileSize,
      });
      const id = fileIdFromUrl(uploaded.url);
      if (!id) throw new Error('The upload came back without a file id');
      onChange(id);
    } catch (e: unknown) {
      setPreview(null);           // the tile must not imply a photo that is not there
      Alert.alert('Upload failed',
        e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <RNPressable
      onPress={choose}
      disabled={busy}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={{
        paddingVertical: 18,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: value ? 'solid' : 'dashed',
        alignItems: 'center',
        opacity: busy ? 0.5 : 1,
      }}>
      {preview ? (
        // The whole point of this widget is labelling WHICH hand, so the user
        // must be able to see which photo landed in which slot. A control that
        // only says "Replace photo" cannot show a wrong photo in the wrong slot.
        <ExpoImage
          source={{ uri: preview }}
          style={{ width: 96, height: 96, borderRadius: 8, marginBottom: 8 }}
          contentFit="cover"
          accessibilityLabel={label ? `${label} preview` : 'Selected photo'}
        />
      ) : null}
      <RNText style={{ fontSize: 15, fontWeight: '600' }}>
        {busy ? 'Uploading…' : value ? 'Replace photo' : 'Add photo'}
      </RNText>
    </RNPressable>
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
  DateWheel,
  ImagePicker,
};
