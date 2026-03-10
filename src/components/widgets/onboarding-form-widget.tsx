'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';

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

interface OnboardingFormWidgetProps {
  id: string;
  title?: string;
  isHistory?: boolean;
  data: {
    fields: FormField[];
    goal?: string;
    submit_label?: string;
    message_template?: string;
  };
}

/* ------------------------------------------------------------------ */
/*  Shared slider thumb + track classes (fat-finger friendly, 44px)   */
/* ------------------------------------------------------------------ */
const SLIDER_THUMB = `
  [&::-webkit-slider-thumb]:appearance-none
  [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6
  [&::-webkit-slider-thumb]:rounded-full
  [&::-webkit-slider-thumb]:bg-primary
  [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.25)]
  [&::-webkit-slider-thumb]:border-[2.5px] [&::-webkit-slider-thumb]:border-white
  [&::-webkit-slider-thumb]:cursor-pointer
  [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150
  [&::-webkit-slider-thumb]:active:scale-110
  [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10
  [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6
  [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary
  [&::-moz-range-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.25)]
  [&::-moz-range-thumb]:border-[2.5px] [&::-moz-range-thumb]:border-white
  [&::-moz-range-thumb]:cursor-pointer
`.trim();

const SLIDER_CLS = `w-full h-2.5 rounded-full appearance-none cursor-pointer touch-none ${SLIDER_THUMB}`;

function sliderBg(pct: number) {
  return {
    background: `linear-gradient(to right, hsl(var(--primary)) ${pct}%, hsl(var(--muted)) ${pct}%)`,
  };
}

/* ------------------------------------------------------------------ */

export function OnboardingFormWidget({ data, isHistory }: OnboardingFormWidgetProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [heightMode, setHeightMode] = useState<'ft' | 'cm'>('ft');
  const [feet, setFeet] = useState('5');
  const [inches, setInches] = useState('6');
  const [submitted, setSubmitted] = useState(false);

  const setValue = useCallback((id: string, val: string) => {
    setValues((prev) => ({ ...prev, [id]: val }));
  }, []);

  // Pre-fill slider midpoints on mount
  useEffect(() => {
    const defaults: Record<string, string> = {};
    for (const field of data.fields) {
      if (field.type === 'slider' && field.min != null && field.max != null) {
        defaults[field.id] = String(Math.round((field.min + field.max) / 2));
      }
    }
    if (Object.keys(defaults).length > 0) {
      setValues((prev) => ({ ...defaults, ...prev }));
    }
  }, [data.fields]);

  const getHeightCm = (): number => {
    if (heightMode === 'cm') return parseInt(values['height'] || '165', 10);
    return Math.round(parseInt(feet || '5', 10) * 30.48 + parseInt(inches || '6', 10) * 2.54);
  };

  const isValid = (): boolean => {
    for (const field of data.fields) {
      if (field.required === false) continue;
      if (field.type === 'height') continue; // always has a slider value
      if (!values[field.id]) return false;
    }
    return true;
  };

  // Live rate hint
  const rateHint = useMemo(() => {
    const w = parseFloat(values['weight'] || '');
    const tw = parseFloat(values['target_weight'] || '');
    const tv = parseInt(values['timeline'] || '', 10);
    if (!w || !tw || !tv || w === tw) return null;
    const weeks = tv > 12 ? tv : tv * 4.33;
    const rate = Math.abs(w - tw) / weeks;
    const isLoss = tw < w;
    return { rate: rate.toFixed(1), isSafe: rate <= (isLoss ? 1.5 : 0.5), direction: isLoss ? 'lose' : 'gain' };
  }, [values]);

  const handleSubmit = () => {
    if (submitted || !isValid()) return;
    setSubmitted(true);
    const heightCm = getHeightCm();
    let msg = `Age: ${values['age']}, Sex: ${values['sex']}, Height: ${heightCm} cm, Weight: ${values['weight']} kg`;
    if (values['target_weight']) msg += `, Target: ${values['target_weight']} kg`;
    if (values['timeline']) {
      const t = parseInt(values['timeline'], 10);
      msg += t > 12 ? `, Timeline: ${t} weeks` : `, Timeline: ${t} months`;
    }
    window.dispatchEvent(new CustomEvent('chat-quick-reply', { detail: { text: msg } }));
  };

  /* ---------- Historical / submitted ---------- */
  if (isHistory || submitted) {
    return (
      <div className="mt-2 rounded-2xl border border-border bg-muted/30 p-4 opacity-50 pointer-events-none">
        <p className="text-xs text-muted-foreground">Profile submitted</p>
      </div>
    );
  }

  /* ---------- Render ---------- */
  return (
    <div className="mt-2 w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-5 shadow-lg">

      {data.fields.map((field) => {

        /* ── SELECT PILLS (sex) ── */
        if (field.type === 'select') {
          return (
            <fieldset key={field.id} className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {field.label}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {field.options?.map((opt) => {
                  const active = values[field.id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setValue(field.id, opt.value)}
                      className={`
                        relative py-3 rounded-xl text-sm font-semibold transition-all duration-200
                        active:scale-[0.97]
                        ${active
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                          : 'bg-muted/60 text-foreground hover:bg-muted'}
                      `}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        }

        /* ── DROPDOWN (age) ── */
        if (field.type === 'dropdown') {
          return (
            <fieldset key={field.id} className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {field.label}
                {field.required === false && (
                  <span className="font-normal normal-case tracking-normal ml-1 opacity-60">optional</span>
                )}
              </legend>
              <div className="relative">
                <select
                  value={values[field.id] || ''}
                  onChange={(e) => setValue(field.id, e.target.value)}
                  className={`
                    w-full rounded-xl border border-border bg-muted/40 px-4 py-3
                    text-sm font-medium
                    focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                    appearance-none cursor-pointer transition-colors
                    ${values[field.id] ? 'text-foreground' : 'text-muted-foreground'}
                  `}
                >
                  <option value="">{field.placeholder || 'Select...'}</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </fieldset>
          );
        }

        /* ── SLIDER (weight, target_weight, timeline) ── */
        if (field.type === 'slider') {
          const min = field.min ?? 0;
          const max = field.max ?? 100;
          const step = field.step ?? 1;
          const cur = values[field.id] ? parseFloat(values[field.id]) : Math.round((min + max) / 2);
          const pct = ((cur - min) / (max - min)) * 100;

          return (
            <fieldset key={field.id} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {field.label}
                  {field.required === false && (
                    <span className="font-normal normal-case tracking-normal ml-1 opacity-60">optional</span>
                  )}
                </legend>
                <span className="text-lg font-bold text-foreground tabular-nums leading-none">
                  {cur}
                  <span className="text-xs font-medium text-muted-foreground ml-0.5">{field.unit}</span>
                </span>
              </div>

              <div className="px-1 pt-1 pb-0.5">
                <input
                  type="range" min={min} max={max} step={step} value={cur}
                  onChange={(e) => setValue(field.id, e.target.value)}
                  className={SLIDER_CLS}
                  style={sliderBg(pct)}
                />
                <div className="flex justify-between mt-1 px-0.5">
                  <span className="text-[10px] text-muted-foreground">{min}</span>
                  <span className="text-[10px] text-muted-foreground">{max}</span>
                </div>
              </div>
            </fieldset>
          );
        }

        /* ── HEIGHT (dual-mode slider) ── */
        if (field.type === 'height') {
          const heightCm = getHeightCm();

          return (
            <fieldset key={field.id} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {field.label}
                </legend>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground tabular-nums leading-none">
                    {heightMode === 'ft'
                      ? <>{feet || 5}<span className="text-xs font-medium text-muted-foreground">ft</span>{' '}{inches || 6}<span className="text-xs font-medium text-muted-foreground">in</span></>
                      : <>{values['height'] || 165}<span className="text-xs font-medium text-muted-foreground ml-0.5">cm</span></>}
                  </span>
                  <button
                    onClick={() => setHeightMode((m) => (m === 'ft' ? 'cm' : 'ft'))}
                    className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full
                      hover:bg-primary/20 active:scale-95 transition-all"
                  >
                    {heightMode === 'ft' ? 'cm' : 'ft/in'}
                  </button>
                </div>
              </div>

              {heightMode === 'ft' ? (
                <div className="space-y-3 px-1 pt-1">
                  {/* Feet */}
                  <div>
                    <div className="flex justify-between mb-1 px-0.5">
                      <span className="text-[11px] text-muted-foreground">Feet</span>
                      <span className="text-[11px] font-semibold text-foreground">{feet || 5}</span>
                    </div>
                    <input
                      type="range" min={3} max={7} step={1}
                      value={parseInt(feet || '5', 10)}
                      onChange={(e) => setFeet(e.target.value)}
                      className={SLIDER_CLS}
                      style={sliderBg(((parseInt(feet || '5', 10) - 3) / 4) * 100)}
                    />
                    <div className="flex justify-between mt-0.5 px-0.5">
                      <span className="text-[10px] text-muted-foreground">3</span>
                      <span className="text-[10px] text-muted-foreground">7</span>
                    </div>
                  </div>
                  {/* Inches */}
                  <div>
                    <div className="flex justify-between mb-1 px-0.5">
                      <span className="text-[11px] text-muted-foreground">Inches</span>
                      <span className="text-[11px] font-semibold text-foreground">{inches || 6}</span>
                    </div>
                    <input
                      type="range" min={0} max={11} step={1}
                      value={parseInt(inches || '6', 10)}
                      onChange={(e) => setInches(e.target.value)}
                      className={SLIDER_CLS}
                      style={sliderBg((parseInt(inches || '6', 10) / 11) * 100)}
                    />
                    <div className="flex justify-between mt-0.5 px-0.5">
                      <span className="text-[10px] text-muted-foreground">0</span>
                      <span className="text-[10px] text-muted-foreground">11</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">= {heightCm} cm</p>
                </div>
              ) : (
                <div className="px-1 pt-1 pb-0.5">
                  <input
                    type="range" min={120} max={220} step={1}
                    value={parseInt(values['height'] || '165', 10)}
                    onChange={(e) => setValue('height', e.target.value)}
                    className={SLIDER_CLS}
                    style={sliderBg(((parseInt(values['height'] || '165', 10) - 120) / 100) * 100)}
                  />
                  <div className="flex justify-between mt-1 px-0.5">
                    <span className="text-[10px] text-muted-foreground">120</span>
                    <span className="text-[10px] text-muted-foreground">220</span>
                  </div>
                </div>
              )}
            </fieldset>
          );
        }

        /* ── FALLBACK: number input ── */
        return (
          <fieldset key={field.id} className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {field.label}
              {field.required === false && (
                <span className="font-normal normal-case tracking-normal ml-1 opacity-60">optional</span>
              )}
            </legend>
            <div className="relative">
              <input
                type="number"
                value={values[field.id] || ''}
                onChange={(e) => setValue(field.id, e.target.value)}
                placeholder={field.placeholder}
                min={field.min}
                max={field.max}
                className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground
                  focus:outline-none focus:ring-2 focus:ring-primary/40
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {field.unit && (
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {field.unit}
                </span>
              )}
            </div>
          </fieldset>
        );
      })}

      {/* Rate hint */}
      {rateHint && (
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
          rateHint.isSafe
            ? 'bg-green-500/10 text-green-700 dark:text-green-400'
            : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
        }`}>
          <span className="text-base">{rateHint.isSafe ? '\u2713' : '\u26A0'}</span>
          <span>
            ~{rateHint.rate} kg/week to {rateHint.direction}
            {rateHint.isSafe ? ' \u2014 healthy pace' : ' \u2014 aggressive, we\u2019ll set a safe pace'}
          </span>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!isValid()}
        className={`
          w-full py-3.5 rounded-xl text-sm font-semibold tracking-wide
          transition-all duration-200 active:scale-[0.98]
          ${isValid()
            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30'
            : 'bg-muted text-muted-foreground cursor-not-allowed'}
        `}
      >
        {data.submit_label ?? 'Continue'}
      </button>
    </div>
  );
}
