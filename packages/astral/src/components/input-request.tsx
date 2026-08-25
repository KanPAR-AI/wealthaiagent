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
  /**
   * Per-field helper copy the HOST supplies, keyed by field `key` first and
   * field `kind` second (docs/49 ASTRAL-104's amendment).
   *
   * It lives here rather than in this file because it is BRAND copy, and the
   * board's own hints are US postal conventions: "Austin, Texas, USA" and
   * "City, State, or ZIP code" are a form asking an Indian user for something
   * that does not exist. The engine does not send it either — a hint is how a
   * product talks, not a fact about the belief.
   *
   * The engine's own `hint` on a field always wins: if it ever has something
   * to say about a specific ask, that is not a brand's business to overwrite.
   */
  hints?: Record<string, string>;
  /** the label on the last step's button ("Done" by default) */
  submitLabel?: string;
  /**
   * A small glyph per field KIND, drawn by the host and shown beside the
   * field's label in the `page` layout (the board's frame 2 puts a calendar,
   * a clock and a pin on its three rows).
   *
   * The host draws them because an icon set is a brand asset and this package
   * has no icons, no font and no opinion about either. Absent is fine: the
   * form is complete without them.
   */
  fieldIcons?: Record<string, ReactNode>;
  /**
   * `page` renders every field at once under one heading — the full-screen
   * form of docs/49 ASTRAL-104's screen 2. It is the SAME component, the same
   * fields and the same carrier with different chrome; a screen that drew its
   * own date/time/place fields would be the second implementation ASTRAL-91
   * forbids, and would drift from the engine's payload the first time a kind
   * changed.
   */
  layout?: 'card' | 'page';
}

interface FieldRenderContext {
  ui: AstralRenderProps['ui'];
  theme: AstralRenderProps['theme'];
  width: number;
  field: InputField;
  value: InputValue | undefined;
  onChange: (value: InputValue) => void;
  /** the engine's `hint` if it sent one, otherwise the host's brand copy */
  hint?: string;
}

type FieldRenderer = (ctx: FieldRenderContext) => ReactNode;

function TextField({ ui, theme, field, value, onChange, hint }: FieldRenderContext) {
  const { TextInput } = ui;
  return (
    <TextInput
      value={typeof value === 'string' ? value : ''}
      onChangeText={onChange}
      placeholder={hint ?? ''}
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

function TimeField({ ui, theme, field, value, onChange, hint }: FieldRenderContext) {
  const { Box, TimeWheel } = ui;
  return (
    <Box style={{ gap: 8 }}>
      <TimeWheel
        value={typeof value === 'string' ? value : null}
        onChange={onChange}
        accessibilityLabel={field.label}
        testID={`input-field-${field.key}`}
      />
      {hint ? (
        <ui.Text style={{ fontSize: 12, color: theme.textMuted }}>{hint}</ui.Text>
      ) : null}
    </Box>
  );
}

/**
 * The date of birth (docs/49 ASTRAL-96).
 *
 * The picker exists to remove ONE ambiguity: `03/04/1989` is two different
 * dates depending on where the reader grew up, and a chart cast on the wrong
 * one is wrong by a month with nothing on its face to say so. The host draws
 * the control (`ui.DateWheel`); what is shared is the question, the bound and
 * the carrier.
 *
 * The year bound is a courtesy, not a validation. The engine refuses an
 * implausible year with a named reason and never clamps one — a clamp is how
 * a typo becomes a chart that looks like any other.
 */
function DateField({ ui, theme, field, value, onChange, hint }: FieldRenderContext) {
  const { Box, DateWheel } = ui;
  const thisYear = new Date().getFullYear();
  return (
    <Box style={{ gap: 8 }}>
      <DateWheel
        value={typeof value === 'string' ? value : null}
        onChange={onChange}
        minYear={EARLIEST_BIRTH_YEAR}
        maxYear={thisYear}
        accessibilityLabel={field.label}
        testID={`input-field-${field.key}`}
      />
      {hint ? (
        <ui.Text style={{ fontSize: 12, color: theme.textMuted }}>{hint}</ui.Text>
      ) : null}
    </Box>
  );
}

/**
 * The place of birth (docs/49 ASTRAL-96 / ASTRAL-69).
 *
 * A text field, and DELIBERATELY nothing more. There is no geocoding library
 * and no autocomplete on this side of the wire — the standing rule from
 * ASTRAL-57/69/96, and a structural test greps both bundles for one. The
 * engine resolves the place, refuses an implausible match with a designed
 * message instead of guessing, and when a name turns out to be several real
 * places it asks again as a `choice` over PLACES (ASTRAL-94/95). All three
 * of those come back as ordinary turns; nothing here predicts them.
 *
 * The placeholder is brand copy from the host, because "City, State, or ZIP
 * code" is a US postal convention and this product ships in India too
 * (ASTRAL-104's amendment).
 */
function PlaceField(ctx: FieldRenderContext) {
  // The hint is the PLACEHOLDER and nothing else. It was briefly both — a
  // placeholder and a caption under it — and the simulator showed the same
  // sentence twice, three lines apart. The board carries two different
  // strings there (an example and a helper); one brand token is one string,
  // and saying it twice is not two strings.
  return TextField(ctx);
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
function ImageField({ ui, theme, field, value, onChange, hint }: FieldRenderContext) {
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
        {attached ? '✓ photo attached' : (hint ?? 'Palm facing the camera, fingers spread.')}
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
 * The ordered pick (docs/49 ASTRAL-152, F42).
 *
 * ── why tapping, and not dragging ─────────────────────────────────────────
 *
 * The rank IS the order, so the control has to make order visible and
 * editable. A drag handle is the desktop instinct and it is the wrong one on
 * a phone inside a scrolling transcript: a long-press-drag inside a
 * ScrollView fights the scroll, and RN's own gesture guidance is to avoid
 * exactly that. So picking is TAPPING — the first tap makes it #1, the next
 * #2 — and a picked row shows its number and can be tapped again to remove
 * it, which re-numbers everything below. Every state is reachable with one
 * finger and no gesture the user has to discover.
 *
 * At `max` the unpicked options go quiet rather than disappearing: a control
 * that removes its own options when you reach the limit reads as a bug, and
 * the engine's refusal is still the authority behind it.
 */
function MultiField({ ui, theme, field, value, onChange }: FieldRenderContext) {
  const { Box, Pressable, Text } = ui;
  const picked = Array.isArray(value) ? value : [];
  const max = field.max ?? field.options.length;
  const ordered = field.ordered !== false;

  const toggle = (option: string) => {
    if (picked.indexOf(option) !== -1) {
      onChange(picked.filter((v) => v !== option));
      return;
    }
    // At the limit, a tap is a no-op rather than a silent replacement: the
    // engine refuses an over-long list by name (ASTRAL-152) and this control
    // must not paper over that by quietly dropping somebody's first pick.
    if (picked.length >= max) return;
    onChange([...picked, option]);
  };

  return (
    <Box style={{ gap: 8 }}>
      {field.options.map((option) => {
        const rank = picked.indexOf(option.value);
        const selected = rank !== -1;
        const atLimit = !selected && picked.length >= max;
        return (
          <Pressable
            key={option.value}
            onPress={() => toggle(option.value)}
            accessibilityLabel={
              selected
                ? `${option.label}, picked${ordered ? `, number ${rank + 1}` : ''}`
                : option.label
            }
            testID={`input-option-${field.key}-${option.value}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              borderWidth: 1,
              borderColor: selected ? theme.accent : theme.border,
              backgroundColor: selected ? theme.surfaceAlt : theme.surface,
              borderRadius: 12,
              paddingTop: 10,
              paddingBottom: 10,
              paddingLeft: 12,
              paddingRight: 12,
              opacity: atLimit ? 0.45 : 1,
            }}
          >
            <Box
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: selected ? theme.accent : theme.border,
                backgroundColor: selected ? theme.accent : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: selected ? theme.surface : theme.textMuted,
                }}
              >
                {selected ? (ordered ? String(rank + 1) : '✓') : ''}
              </Text>
            </Box>
            <Text style={{ fontSize: 15, color: theme.text, flex: 1 }}>{option.label}</Text>
          </Pressable>
        );
      })}
      <Text testID={`input-multi-count-${field.key}`} style={{ fontSize: 12, color: theme.textMuted }}>
        {ordered
          ? `${picked.length} of up to ${max} picked, in order. Tap again to remove.`
          : `${picked.length} picked. Tap again to remove.`}
      </Text>
    </Box>
  );
}

/**
 * The earliest year the date wheel offers. A person born before it can still
 * type their date in prose (ASTRAL-90) and the engine accepts any year from
 * 1900 — this is where the wheel STARTS, not what the product will believe.
 */
const EARLIEST_BIRTH_YEAR = 1900;

/**
 * Every kind the engine can emit now has a renderer. `date` and `place` were
 * DEFERRED_KINDS until PH-12 (ASTRAL-96) — declared by the engine, drawn as a
 * plain text box here — and that list is gone rather than emptied, so nothing
 * is left that quietly downgrades a kind without saying so.
 */
const handlers: Record<string, FieldRenderer> = {
  time: TimeField,
  date: DateField,
  place: PlaceField,
  choice: ChoiceField,
  text: TextField,
  image: ImageField,
  // docs/49 PH-19 (ASTRAL-152): the ordered pick. Registered here rather
  // than drawn by the screen that wanted it, for ASTRAL-91's reason — a
  // screen with its own field renderer is the second implementation that
  // drifts from the engine's payload the first time a kind changes.
  multi: MultiField,
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
  hints,
  submitLabel,
  fieldIcons,
  layout = 'card',
}: InputRequestViewProps) {
  const { Box, Pressable, Text } = ui;
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, InputValue>>({});
  const [outcome, setOutcome] = useState<'open' | 'submitted' | 'dismissed'>('open');

  const total = request.fields.length;
  const field = request.fields[Math.min(step, total - 1)];
  const isLast = step >= total - 1;

  // The engine's hint wins; the host's brand copy fills the silence. Keyed by
  // field first so a specific ask can be spoken to, then by kind so one token
  // covers every place field in the product.
  const hintFor = (f: InputField): string | undefined =>
    f.hint ?? hints?.[f.key] ?? hints?.[f.kind];

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

  /** a field is answered when it holds a value OR an explicit "I don't know" */
  // A key whose value was typed then cleared is NOT answered — '' enabling
  // Continue sent an empty place the engine then refused by name (Role-3).
  // `null` stays answered: it is the deliberate "I don't know" sentinel
  // (ASTRAL-87), not an empty string.
  const answeredKey = (f: InputField) => {
    if (!(f.key in values)) return false;
    const v = values[f.key];
    // An EMPTY LIST is an answer, not a blank: it is how a user clears their
    // priorities through the same carrier that sets them (ASTRAL-154). A
    // `multi` is never `required`, so this only decides what Continue reads
    // as answered — but treating [] as unanswered would make "clear" the one
    // edit the widget could not express.
    if (Array.isArray(v)) return true;
    return v === null || String(v ?? '').trim() !== '';
  };
  const missingRequired = request.fields.filter((f) => f.required && !answeredKey(f));

  if (layout === 'page') {
    // The full-screen form (docs/49 ASTRAL-104). One heading, every field,
    // one button — the pacing of ASTRAL-92 is a CARD-in-a-transcript
    // affordance, and a screen whose whole job is this form has no bubble to
    // pace inside. What does not change: the fields are the engine's, the
    // answer leaves through `buildInputResponseMessage`, and a required birth
    // time is still answerable with "I don't know".
    if (outcome === 'submitted') {
      return (
        <Box testID="input-request-submitted" style={{ gap: 4 }}>
          <Text style={{ fontSize: 13, color: theme.textMuted }}>
            {`✓ ${echoFor(request, values)}`}
          </Text>
        </Box>
      );
    }
    return (
      <Box testID="input-request-page" style={{ gap: 20, width, maxWidth: width }}>
        {request.reason ? (
          <Text
            testID="input-request-reason"
            style={{ fontSize: 15, color: theme.textMuted, lineHeight: 22 }}
          >
            {request.reason}
          </Text>
        ) : null}

        {request.fields.map((f) => {
          const render = rendererFor(f.kind, warn);
          return (
            <Box key={f.key} style={{ gap: 8 }}>
              <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text
                  testID={`input-request-label-${f.key}`}
                  style={{ fontSize: 14, fontWeight: '600', color: theme.text }}
                >
                  {f.label}
                </Text>
                {fieldIcons?.[f.kind] ?? null}
              </Box>
              {render({
                ui,
                theme,
                width,
                field: f,
                value: values[f.key],
                onChange: (value) => setValue(f.key, value),
                hint: hintFor(f),
              })}
              {f.allowUnknown ? (
                // Hugs its content: full-width it reads as a second primary
                // action competing with Continue, which is the opposite of
                // what it is (ASTRAL-87 — a way out, not a call to action).
                <Box style={{ alignSelf: 'flex-start' }}>
                  <Button
                    ui={ui}
                    theme={theme}
                    label={values[f.key] === null ? "✓ I don't know" : "I don't know"}
                    testID={`input-request-unknown-${f.key}`}
                    onPress={() => setValue(f.key, null)}
                  />
                </Box>
              ) : null}
            </Box>
          );
        })}

        <Button
          ui={ui}
          theme={theme}
          emphasis
          label={submitLabel ?? 'Continue'}
          testID="input-request-submit"
          disabled={missingRequired.length > 0}
          onPress={() => submit(values)}
        />
      </Box>
    );
  }

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
        hint: hintFor(field),
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
