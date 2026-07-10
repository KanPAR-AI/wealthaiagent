// Native onboarding form — the dietician/specialist intake widget.
//
// Mirrors the web widget's contract exactly: same field schema
// (number/select/height/dropdown/slider), same submit message format
// ("Age: 34, Sex: male, Height: 175 cm, Weight: 78 kg, ...") dispatched
// as a quick reply, so the backend sees no difference between platforms.
//
// Mobile adaptations: sliders become steppers (– value +) — RN has no
// styled-range input and steppers beat sliders for precise numeric entry
// on phones; selects render as pill groups; height uses a cm stepper with
// an ft/in readout.

import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, useColorScheme, View } from 'react-native';
import { getPlatform } from '@wealthai/core';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { QUICK_REPLY_EVENT } from '@/lib/events';

interface FormField {
  id: string;
  label: string;
  type: 'number' | 'select' | 'height' | 'dropdown' | 'slider';
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  unit?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
}

export function OnboardingForm({ data }: { data: any }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const fields: FormField[] = data.fields || [];

  const defaults = useMemo(() => {
    const d: Record<string, string> = {};
    for (const f of fields) {
      if ((f.type === 'slider' || f.type === 'height') && f.min != null && f.max != null) {
        d[f.id] = String(Math.round((f.min + f.max) / 2));
      }
      if (f.type === 'height' && f.min == null) d[f.id] = '170';
    }
    return d;
  }, [fields]);

  const [values, setValues] = useState<Record<string, string>>(defaults);
  const [submitted, setSubmitted] = useState(false);

  const set = (id: string, v: string) => setValues((prev) => ({ ...prev, [id]: v }));

  const isValid = () =>
    fields.every((f) => !f.required || (values[f.id] ?? '').toString().length > 0);

  const submit = () => {
    if (submitted || !isValid()) return;
    setSubmitted(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Web-identical message format (backend slot extractor depends on it).
    let msg = `Age: ${values['age']}, Sex: ${values['sex']}, Height: ${values['height'] || values['height_cm'] || ''} cm, Weight: ${values['weight']} kg`;
    if (values['target_weight']) msg += `, Target: ${values['target_weight']} kg`;
    if (values['timeline']) {
      const t = parseInt(values['timeline'], 10);
      msg += t > 12 ? `, Timeline: ${t} weeks` : `, Timeline: ${t} months`;
    }
    getPlatform().events.emit(QUICK_REPLY_EVENT, { text: msg });
  };

  if (submitted) {
    return (
      <View style={[styles.card, styles.cardDone, { borderColor: colors.backgroundSelected }]}>
        <ThemedText type="small" themeColor="textSecondary">✓ Profile submitted</ThemedText>
      </View>
    );
  }

  const cmToFtIn = (cm: number) => {
    const inches = cm / 2.54;
    return `${Math.floor(inches / 12)}′ ${Math.round(inches % 12)}″`;
  };

  const renderField = (f: FormField) => {
    const v = values[f.id] ?? '';

    if (f.type === 'select' || f.type === 'dropdown') {
      const opts = f.options || [];
      // A select with dozens of numeric options (e.g. Age 18-80) must not
      // become a wall of pills — render it as a stepper over the values.
      const allNumeric = opts.length > 8 && opts.every((o) => !isNaN(parseInt(o.value, 10)));
      if (allNumeric) {
        const nums = opts.map((o) => parseInt(o.value, 10)).sort((a, b) => a - b);
        const cur = parseInt(v || String(nums[Math.floor(nums.length / 2)]), 10);
        if (!v) setTimeout(() => set(f.id, String(cur)), 0);
        const idx = Math.max(0, nums.indexOf(cur));
        const stepTo = (i: number) => {
          const j = Math.min(nums.length - 1, Math.max(0, i));
          Haptics.selectionAsync();
          set(f.id, String(nums[j]));
        };
        const labelFor = (n: number) =>
          opts.find((o) => parseInt(o.value, 10) === n)?.label || String(n);
        return (
          <View style={styles.stepperRow}>
            <Pressable onPress={() => stepTo(idx - 1)}
              style={[styles.stepperButton, { backgroundColor: colors.backgroundElement }]}>
              <ThemedText type="title" style={styles.stepperGlyph}>−</ThemedText>
            </Pressable>
            <View style={styles.stepperValue}>
              <ThemedText type="subtitle">{labelFor(cur)}</ThemedText>
            </View>
            <Pressable onPress={() => stepTo(idx + 1)}
              style={[styles.stepperButton, { backgroundColor: colors.backgroundElement }]}>
              <ThemedText type="title" style={styles.stepperGlyph}>+</ThemedText>
            </Pressable>
          </View>
        );
      }
      return (
        <View style={styles.pillRow}>
          {(f.options || []).map((o) => {
            const on = v === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => { Haptics.selectionAsync(); set(f.id, o.value); }}
                style={[
                  styles.pill,
                  { backgroundColor: on ? colors.text : colors.backgroundElement },
                ]}>
                <ThemedText type="small" style={on ? { color: colors.background } : undefined}>
                  {o.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      );
    }

    if (f.type === 'slider' || f.type === 'height') {
      const num = parseInt(v || '0', 10) || f.min || 0;
      const step = f.step || 1;
      const clamp = (n: number) =>
        Math.min(f.max ?? 999, Math.max(f.min ?? 0, n));
      return (
        <View style={styles.stepperRow}>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); set(f.id, String(clamp(num - step))); }}
            style={[styles.stepperButton, { backgroundColor: colors.backgroundElement }]}>
            <ThemedText type="title" style={styles.stepperGlyph}>−</ThemedText>
          </Pressable>
          <View style={styles.stepperValue}>
            <ThemedText type="subtitle">
              {num}{f.unit ? ` ${f.unit}` : f.type === 'height' ? ' cm' : ''}
            </ThemedText>
            {f.type === 'height' && (
              <ThemedText type="small" themeColor="textSecondary">{cmToFtIn(num)}</ThemedText>
            )}
          </View>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); set(f.id, String(clamp(num + step))); }}
            style={[styles.stepperButton, { backgroundColor: colors.backgroundElement }]}>
            <ThemedText type="title" style={styles.stepperGlyph}>+</ThemedText>
          </Pressable>
        </View>
      );
    }

    // number
    return (
      <TextInput
        value={v}
        onChangeText={(t) => set(f.id, t.replace(/[^0-9.]/g, ''))}
        placeholder={f.placeholder || ''}
        placeholderTextColor={colors.textSecondary}
        keyboardType="numeric"
        style={[styles.numberInput, { backgroundColor: colors.backgroundElement, color: colors.text }]}
      />
    );
  };

  return (
    <View style={[styles.card, { borderColor: colors.backgroundSelected, backgroundColor: colors.background }]}>
      {data.title ? <ThemedText type="smallBold" style={styles.title}>{data.title}</ThemedText> : null}
      {fields.map((f) => (
        <View key={f.id} style={styles.fieldBlock}>
          <ThemedText type="small" themeColor="textSecondary">
            {f.label}{f.required ? ' *' : ''}
          </ThemedText>
          {renderField(f)}
        </View>
      ))}
      <Pressable
        onPress={submit}
        disabled={!isValid()}
        style={[
          styles.submit,
          { backgroundColor: isValid() ? colors.text : colors.backgroundSelected },
        ]}>
        <ThemedText type="smallBold" style={{ color: colors.background }}>
          {data.submit_label || 'Continue'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.four,
    marginVertical: Spacing.two,
    gap: Spacing.three,
  },
  cardDone: { opacity: 0.6 },
  title: { marginBottom: Spacing.one },
  fieldBlock: { gap: Spacing.two },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: {
    borderRadius: 18,
    paddingHorizontal: Spacing.three + 2,
    paddingVertical: Spacing.two + 2,
  },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperGlyph: { fontSize: 22, lineHeight: 26 },
  stepperValue: { flex: 1, alignItems: 'center' },
  numberInput: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  submit: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
});
