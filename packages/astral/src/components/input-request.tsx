/**
 * The input widget (docs/49 ASTRAL-87/88/89/91/92).
 *
 * ONE implementation for three surfaces — the web app, React Native, and the
 * 380 px AstroMatch side panel — written against the primitive contract in
 * `../primitives.ts`, with `width` as a prop (ASTRAL-18's rule, and a
 * structural test greps the workspace for a second one).
 *
 * ── the three rules that are not cosmetic ──────────────────────────────────
 *
 * 1. ONE QUESTION PER SCREEN, with an honest count set up front (ASTRAL-92).
 *    A three-field ask is three light screens showing "1 of 3", not a wall of
 *    form. `reason` is shown once, at the top, never repeated per field.
 *
 * 2. "I DON'T KNOW" IS AN ANSWER, not an escape hatch (ASTRAL-87). Under the
 *    owner's birth-time ruling the product withholds every time-dependent
 *    value and says why — so a user who genuinely cannot find their birth
 *    time must have a way through. A picker with no way out traps a very
 *    common user, and that is the failure this control exists to prevent.
 *
 * 3. AN UNKNOWN FIELD KIND RENDERS A TEXT INPUT and warns once by name
 *    (ASTRAL-91). This is a DELIBERATE difference from ASTRAL-20's
 *    block-level rule, where an unknown block renders nothing: a block the
 *    client cannot draw is a missing decoration, but a FIELD the client
 *    cannot draw is a missing question the engine is still waiting on.
 *    Degrade to the working general case, never to a dead card.
 *
 * The answer leaves through `onSend` and only through `onSend`, carrying
 * `buildInputResponseMessage`'s typed fence. Nothing here flattens a value
 * into a sentence for a model to re-read — see `../input-request.ts` for why
 * that sentence is the whole point of the feature.
 */

import { useState, type ReactNode } from 'react';

import { createBlockRegistry } from '../block-registry';
import {
  buildInputResponseMessage,
  echoFor,
  type InputField,
  type InputRequestPayload,
  type InputValue,
} from '../input-request';
import { isWide, type AstralRenderProps } from '../primitives';

export interface InputRequestViewProps extends AstralRenderProps {
  request: InputRequestPayload;
  /** the ONE way an answer leaves this component */
  onSend: (message: string) => void;
  /** test seam — defaults to `console.warn` through the registry */
  warn?: (message: string) => void;
}

interface FieldRenderContext {
  ui: AstralRenderProps['ui'];
  theme: AstralRenderProps['theme'];
  width: number;
  field: InputField;
  value: InputValue | undefined;
  onChange: (value: InputValue) => void;
}

type FieldRenderer = (ctx: FieldRenderContext) => ReactNode;

function TextField({ ui, theme, field, value, onChange }: FieldRenderContext) {
  const { TextInput } = ui;
  return (
    <TextInput
      value={typeof value === 'string' ? value : ''}
      onChangeText={onChange}
      placeholder={field.hint ?? ''}
      accessibilityLabel={field.label}
      testID={`input-field-${field.key}`}
      style={{
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 10,
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: 12,
        paddingRight: 12,
        fontSize: 16,
        color: theme.text,
        backgroundColor: theme.surface,
      }}
    />
  );
}

function TimeField({ ui, theme, field, value, onChange }: FieldRenderContext) {
  const { Box, TimeWheel } = ui;
  return (
    <Box style={{ gap: 8 }}>
      <TimeWheel
        value={typeof value === 'string' ? value : null}
        onChange={onChange}
        accessibilityLabel={field.label}
        testID={`input-field-${field.key}`}
      />
      {field.hint ? (
        <ui.Text style={{ fontSize: 12, color: theme.textMuted }}>{field.hint}</ui.Text>
      ) : null}
    </Box>
  );
}

/**
 * A role-labelled photo slot (bug 8dc95a6a).
 *
 * The reported failure was a PAIRING failure: two palms, the vision layer
 * called both the same side, and the engine deduped by side — so a pair read
 * as a re-shoot and the user got a one-hand reading. Two slots each LABELLED
 * with the role removes the ambiguity at the source: two roles is
 * definitionally two hands, whatever the pixels say.
 *
 * The picking and the upload belong to the host (`ui.ImagePicker`); what is
 * shared is the question, the label, the skip and the carrier. Once a photo
 * is attached the slot SAYS SO — a control that looks identical before and
 * after a tap is how a user uploads the same hand twice.
 */
function ImageField({ ui, theme, field, value, onChange }: FieldRenderContext) {
  const { Box, ImagePicker, Text } = ui;
  const attached = typeof value === 'string' && value.length > 0;
  return (
    <Box style={{ gap: 8 }}>
      <ImagePicker
        value={attached ? (value as string) : null}
        onChange={onChange}
        label={field.label}
        accessibilityLabel={field.label}
        testID={`input-field-${field.key}`}
      />
      <Text style={{ fontSize: 12, color: attached ? theme.accent : theme.textMuted }}>
        {attached ? '✓ photo attached' : (field.hint ?? 'Palm facing the camera, fingers spread.')}
      </Text>
    </Box>
  );
}

function ChoiceField({ ui, theme, width, field, value, onChange }: FieldRenderContext) {
  const { Box, Pressable, Text } = ui;
  return (
    <Box
      style={{
        flexDirection: isWide(width) ? 'row' : 'column',
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      {field.options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            // The LABEL is display only. `option.value` is what travels, and
            // the engine refuses a label submitted as a value rather than
            // matching it to the nearest option (ASTRAL-88).
            onPress={() => onChange(option.value)}
            accessibilityLabel={option.label}
            testID={`input-option-${field.key}-${option.value}`}
            style={{
              borderWidth: 1,
              borderColor: selected ? theme.accent : theme.border,
              backgroundColor: selected ? theme.surfaceAlt : theme.surface,
              borderRadius: 12,
              paddingTop: 10,
              paddingBottom: 10,
              paddingLeft: 14,
              paddingRight: 14,
              gap: 2,
            }}
          >
            <Text style={{ fontSize: 15, color: theme.text, fontWeight: selected ? '600' : '400' }}>
              {option.label}
            </Text>
            {option.sublabel ? (
              <Text style={{ fontSize: 12, color: theme.textMuted }}>{option.sublabel}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </Box>
  );
}

/**
 * Kinds this build renders natively. `date` and `place` are DECLARED but not
 * yet built — PH-12 / ASTRAL-96 owns them, and until then they render the
 * text input WITHOUT a warning, because a warning that says "unknown" about
 * a kind we know is coming is noise that trains people to ignore warnings.
 */
const DEFERRED_KINDS = ['date', 'place'];

const handlers: Record<string, FieldRenderer> = {
  time: TimeField,
  choice: ChoiceField,
  text: TextField,
  image: ImageField,
};

/**
 * Test seam. Set for the duration of ONE synchronous `reportUnknown` call
 * below and cleared immediately, so it is never live across a render — a
 * module-level value read during concurrent rendering is how a test double
 * leaks into a neighbouring component.
 */
let activeWarn: ((message: string) => void) | null = null;

export const inputFieldRegistry = createBlockRegistry<FieldRenderer>(handlers, {
  surface: 'input-request',
  warn: (message) => (activeWarn ?? ((m: string) => console.warn(m)))(message),
  unknownMessage: (kind) =>
    `[astral/input-request] unknown field kind "${kind}" — rendering a text ` +
    'input so the question is still answerable. Add a renderer to the field ' +
    'registry (docs/49 ASTRAL-91).',
});

function rendererFor(kind: string, warn?: (message: string) => void): FieldRenderer {
  const handler = inputFieldRegistry.get(kind);
  if (handler) return handler;
  if (DEFERRED_KINDS.indexOf(kind) !== -1) return TextField;
  activeWarn = warn ?? null;
  try {
    inputFieldRegistry.reportUnknown(kind);
  } finally {
    activeWarn = null;
  }
  return TextField;
}

function Button({
  ui,
  theme,
  label,
  onPress,
  testID,
  emphasis,
  disabled,
}: {
  ui: AstralRenderProps['ui'];
  theme: AstralRenderProps['theme'];
  label: string;
  onPress: () => void;
  testID: string;
  emphasis?: boolean;
  disabled?: boolean;
}) {
  const { Pressable, Text } = ui;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      testID={testID}
      style={{
        borderRadius: 12,
        borderWidth: emphasis ? 0 : 1,
        borderColor: theme.border,
        backgroundColor: emphasis ? theme.accent : 'transparent',
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: 16,
        paddingRight: 16,
        opacity: disabled ? 0.4 : 1,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          color: emphasis ? theme.surface : theme.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function InputRequestView({
  ui,
  theme,
  width,
  request,
  onSend,
  warn,
}: InputRequestViewProps) {
  const { Box, Pressable, Text } = ui;
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, InputValue>>({});
  const [outcome, setOutcome] = useState<'open' | 'submitted' | 'dismissed'>('open');

  const total = request.fields.length;
  const field = request.fields[Math.min(step, total - 1)];
  const isLast = step >= total - 1;

  const setValue = (key: string, value: InputValue) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const submit = (finalValues: Record<string, InputValue>) => {
    setValues(finalValues);
    setOutcome('submitted');
    onSend(buildInputResponseMessage(request, finalValues));
  };

  const advance = (next: Record<string, InputValue>) => {
    setValues(next);
    if (isLast) submit(next);
    else setStep(step + 1);
  };

  if (outcome === 'submitted') {
    // The answer stays readable in the transcript as its own user turn
    // (ASTRAL-89); this line is the widget's own quiet receipt.
    return (
      <Box
        testID="input-request-submitted"
        style={{
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 14,
          padding: 12,
          backgroundColor: theme.surfaceAlt,
          marginTop: 8,
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 13, color: theme.textMuted }}>
          {`✓ ${echoFor(request, values)}`}
        </Text>
      </Box>
    );
  }

  if (outcome === 'dismissed') {
    // ASTRAL-89 (2): a dismissed widget collapses to a quiet one-line
    // affordance that stays available and SAYS NOTHING FURTHER. It does not
    // re-appear on a later turn, and it never speaks first — ASTRAL-11's
    // "named once, never repeated" is not weakened by something silent.
    return (
      <Pressable
        onPress={() => setOutcome('open')}
        accessibilityLabel={request.fields[0].label}
        testID="input-request-collapsed"
        style={{ paddingTop: 6, paddingBottom: 6 }}
      >
        <Text style={{ fontSize: 13, color: theme.textMuted }}>
          {`+ ${request.fields[0].label}`}
        </Text>
      </Pressable>
    );
  }

  const renderField = rendererFor(field.kind, warn);
  const answered = field.key in values;

  return (
    <Box
      testID="input-request"
      style={{
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 16,
        padding: 14,
        gap: 12,
        backgroundColor: theme.surface,
        marginTop: 8,
        marginBottom: 8,
        width,
        maxWidth: width,
      }}
    >
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {total > 1 ? (
          <Text
            testID="input-request-progress"
            style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}
          >
            {`${step + 1} of ${total}`}
          </Text>
        ) : (
          <Text style={{ fontSize: 11, color: theme.textMuted }}> </Text>
        )}
        <Pressable
          onPress={() => setOutcome('dismissed')}
          accessibilityLabel="Dismiss"
          testID="input-request-dismiss"
          style={{ paddingLeft: 8, paddingRight: 4 }}
        >
          <Text style={{ fontSize: 16, color: theme.textMuted }}>×</Text>
        </Pressable>
      </Box>

      {/* Shown ONCE, at the top — never repeated per field (ASTRAL-92). */}
      {request.reason && step === 0 ? (
        <Text testID="input-request-reason" style={{ fontSize: 13, color: theme.textMuted, lineHeight: 18 }}>
          {request.reason}
        </Text>
      ) : null}

      <Text testID="input-request-label" style={{ fontSize: 16, fontWeight: '600', color: theme.text }}>
        {field.label}
      </Text>

      {renderField({
        ui,
        theme,
        width,
        field,
        value: values[field.key],
        onChange: (value) => setValue(field.key, value),
      })}

      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {step > 0 ? (
          <Button ui={ui} theme={theme} label="Back" testID="input-request-back" onPress={() => setStep(step - 1)} />
        ) : null}
        {field.allowUnknown ? (
          <Button
            ui={ui}
            theme={theme}
            label="I don't know"
            testID="input-request-unknown"
            // An ANSWER, not a dismissal: it travels as an explicit null and
            // the engine records it as a fact (ASTRAL-87).
            onPress={() => advance({ ...values, [field.key]: null })}
          />
        ) : null}
        {!field.required && !field.allowUnknown ? (
          <Button
            ui={ui}
            theme={theme}
            label="Skip"
            testID="input-request-skip"
            onPress={() => advance(values)}
          />
        ) : null}
        <Button
          ui={ui}
          theme={theme}
          emphasis
          label={isLast ? 'Done' : 'Next'}
          testID="input-request-next"
          disabled={field.required && !answered}
          onPress={() => advance(values)}
        />
      </Box>
    </Box>
  );
}
