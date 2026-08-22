/**
 * The React-DOM adapter for `@wealthai/astral` (docs/49 ASTRAL-18).
 *
 * This file knows nothing about charts, kootas or muhurtas. It maps the tiny
 * primitive contract in `packages/astral/src/primitives.ts` onto DOM elements,
 * which is what lets the scorecard exist exactly ONCE in the workspace while
 * still rendering in the browser, in the AstroMatch extension side panel and,
 * through the React Native adapter, in the app.
 *
 * Two mappings that are not cosmetic:
 *   - `display: flex` + `flexDirection: column` are forced ON, because CSS
 *     defaults to block/row and React Native defaults to flex/column. Without
 *     this every shared layout would be laid out differently on the two
 *     platforms from one source file, which defeats the point.
 *   - numeric style values become `px`. RN numbers are density-independent
 *     pixels; CSS numbers are unitless and mostly invalid.
 */

import { useRef, useState, type CSSProperties } from 'react';
import type {
  AstralBoxStyle,
  AstralImagePickerProps,
  AstralPrimitives,
  AstralTextInputProps,
  AstralTextStyle,
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
import { fileIdFromUrl } from '@wealthai/astral';

import { getApiUrl } from '@/config/environment';
import { useAuthStore } from '@/store/auth';

const PX_PROPS = new Set([
  'gap', 'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'marginTop', 'marginBottom', 'borderRadius', 'borderWidth', 'borderTopWidth',
  'borderLeftWidth', 'width', 'height', 'minWidth', 'maxWidth', 'fontSize',
  'letterSpacing', 'lineHeight',
]);

function toCss(style: AstralBoxStyle | AstralTextStyle | undefined): CSSProperties {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(style ?? {})) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === 'number' && PX_PROPS.has(key) ? `${value}px` : value;
  }
  return out as CSSProperties;
}

function Box({ style, testID, children }: BoxProps) {
  return (
    <div
      data-testid={testID}
      style={{ display: 'flex', flexDirection: 'column', minWidth: 0, ...toCss(style) }}
    >
      {children}
    </div>
  );
}

function Text({ style, testID, children }: TextProps) {
  return (
    <span data-testid={testID} style={{ ...toCss(style) }}>
      {children}
    </span>
  );
}

function Svg({ width, height, viewBox, testID, children }: SvgProps) {
  return (
    <svg
      data-testid={testID}
      width={width}
      height={height}
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

function Group({ rotation, originX, originY, children }: GroupProps) {
  const transform =
    rotation === undefined
      ? undefined
      : `rotate(${rotation} ${originX ?? 0} ${originY ?? 0})`;
  return <g transform={transform}>{children}</g>;
}

function SvgRect(p: SvgRectProps) {
  return (
    <rect
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
  return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.strokeWidth} />;
}

function SvgCircle(p: SvgCircleProps) {
  return (
    <circle
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
    <text
      x={p.x}
      y={p.y}
      fontSize={p.fontSize}
      fill={p.fill}
      fontWeight={p.fontWeight}
      textAnchor={p.textAnchor}
    >
      {p.children}
    </text>
  );
}

function Pressable({ onPress, disabled, accessibilityLabel, style, testID, children }: PressableProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={accessibilityLabel}
      data-testid={testID}
      style={{
        display: 'flex',
        flexDirection: 'column',
        cursor: disabled ? 'default' : 'pointer',
        font: 'inherit',
        textAlign: 'left',
        ...toCss(style),
      }}
    >
      {children}
    </button>
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
    <input
      type="text"
      inputMode={keyboard === 'number' ? 'numeric' : undefined}
      value={value}
      placeholder={placeholder}
      aria-label={accessibilityLabel}
      data-testid={testID}
      onChange={(e) => onChangeText(e.target.value)}
      style={{ ...toCss(style) }}
    />
  );
}

/**
 * `<input type="time">` IS the native picker on every phone browser and a
 * keyboard-navigable HH:MM control on the desktop — and it hands back a
 * 24-hour string, so the am/pm loss that A6#3/A6#8 live at never happens on
 * this surface. That is why the wheel is a primitive rather than something
 * the shared component draws.
 */
function TimeWheel({ value, onChange, accessibilityLabel, testID }: TimeWheelProps) {
  return (
    <input
      type="time"
      value={value ?? ''}
      aria-label={accessibilityLabel}
      data-testid={testID}
      onChange={(e) => onChange(e.target.value)}
      style={{ fontSize: '16px', padding: '10px 12px', borderRadius: '10px' }}
    />
  );
}

/**
 * A photo slot, on the web (bug 8dc95a6a).
 *
 * `<input type="file" accept="image/*">` IS the OS camera/library sheet on
 * every phone browser, so the picking half needs nothing invented. The
 * upload half is the SAME endpoint and the same response shape the composer
 * already posts to (`chat-input.tsx`'s `/files/upload`) — deliberately not a
 * second upload path, and deliberately not a second way for a file id to
 * reach the engine: the id travels in the typed `input_response` fence like
 * every other answered field.
 *
 * A failure is SHOWN. An upload that quietly does nothing leaves a user
 * tapping a control that looks unchanged, which is how the same hand gets
 * sent twice.
 */
function ImagePicker({
  value,
  onChange,
  label,
  accessibilityLabel,
  testID,
}: AstralImagePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const token = useAuthStore.getState().idToken || 'dev_token';
      const form = new FormData();
      form.append('files', file, file.name);
      const res = await fetch(getApiUrl('/files/upload'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: form,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const body = await res.json();
      const id = fileIdFromUrl(String(body?.files?.[0]?.url ?? ''));
      if (!id) throw new Error('The upload came back without a file id');
      onChange(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        data-testid={`${testID}-input`}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        aria-label={accessibilityLabel ?? label}
        data-testid={testID}
        onClick={() => inputRef.current?.click()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          padding: '18px 12px',
          borderRadius: '12px',
          borderWidth: '1px',
          borderStyle: value ? 'solid' : 'dashed',
          cursor: busy ? 'default' : 'pointer',
          font: 'inherit',
        }}
      >
        <span style={{ fontSize: '15px', fontWeight: 600 }}>
          {busy ? 'Uploading…' : value ? 'Replace photo' : 'Add photo'}
        </span>
      </button>
      {error ? (
        <span data-testid={`${testID}-error`} style={{ fontSize: '12px' }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

export const domPrimitives: AstralPrimitives = {
  Box, Text, Svg, Group, SvgRect, SvgLine, SvgCircle, SvgText,
  Pressable, TextInput, TimeWheel, ImagePicker,
};
