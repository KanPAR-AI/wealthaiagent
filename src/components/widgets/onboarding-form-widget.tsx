'use client';

import { useState, useCallback, useMemo } from 'react';

interface FormField {
  id: string;
  label: string;
  type: 'number' | 'select' | 'height';
  min?: number;
  max?: number;
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

export function OnboardingFormWidget({ data, isHistory }: OnboardingFormWidgetProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [heightMode, setHeightMode] = useState<'ft' | 'cm'>('ft');
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const goal = data.goal || '';

  const setValue = useCallback((id: string, val: string) => {
    setValues((prev) => ({ ...prev, [id]: val }));
  }, []);

  const getHeightCm = (): number => {
    if (heightMode === 'cm') {
      return parseFloat(values['height'] || '0');
    }
    const ft = parseInt(feet || '0', 10);
    const inc = parseInt(inches || '0', 10);
    return Math.round(ft * 30.48 + inc * 2.54);
  };

  const isValid = (): boolean => {
    for (const field of data.fields) {
      if (field.required === false) continue;
      if (field.type === 'height') {
        if (heightMode === 'ft') {
          if (!feet) return false;
        } else {
          if (!values['height']) return false;
        }
      } else if (!values[field.id]) {
        return false;
      }
    }
    return true;
  };

  // Live rate hint: computed when weight + target_weight + timeline are filled
  const rateHint = useMemo(() => {
    const weight = parseFloat(values['weight'] || '');
    const targetWeight = parseFloat(values['target_weight'] || '');
    const timeline = parseInt(values['timeline'] || '', 10);
    if (!weight || !targetWeight || !timeline || weight === targetWeight) return null;

    const diff = Math.abs(weight - targetWeight);
    const weeks = timeline * 4.33;
    const weeklyRate = diff / weeks;
    const isLoss = targetWeight < weight;

    const safeLimit = isLoss ? 1.0 : 0.5;
    const isSafe = weeklyRate <= safeLimit;

    return {
      rate: weeklyRate.toFixed(1),
      isSafe,
      direction: isLoss ? 'lose' : 'gain',
    };
  }, [values]);

  const handleSubmit = () => {
    if (submitted || !isValid()) return;
    setSubmitted(true);

    const heightCm = getHeightCm();
    const age = values['age'] || '';
    const sex = values['sex'] || '';
    const weight = values['weight'] || '';
    const targetWeight = values['target_weight'] || '';
    const timeline = values['timeline'] || '';

    let message = `Age: ${age}, Sex: ${sex}, Height: ${heightCm} cm, Weight: ${weight} kg`;
    if (targetWeight) {
      message += `, Target: ${targetWeight} kg`;
    }
    if (timeline) {
      message += `, Timeline: ${timeline} months`;
    }

    window.dispatchEvent(
      new CustomEvent('chat-quick-reply', { detail: { text: message } })
    );
  };

  // Historical: show disabled state
  if (isHistory || submitted) {
    return (
      <div className="mt-2 rounded-xl border border-border bg-muted/30 p-4 opacity-50 pointer-events-none">
        <p className="text-xs text-muted-foreground">Profile submitted</p>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-border bg-card p-4 space-y-4 shadow-sm max-w-md">
      {data.fields.map((field) => {
        if (field.type === 'select') {
          return (
            <div key={field.id} className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{field.label}</label>
              <div className="flex gap-2">
                {field.options?.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setValue(field.id, opt.value)}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                      values[field.id] === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-foreground hover:border-primary/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          );
        }

        if (field.type === 'height') {
          return (
            <div key={field.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">{field.label}</label>
                <button
                  onClick={() => setHeightMode((m) => (m === 'ft' ? 'cm' : 'ft'))}
                  className="text-xs text-primary hover:underline"
                >
                  Switch to {heightMode === 'ft' ? 'cm' : 'ft/in'}
                </button>
              </div>
              {heightMode === 'ft' ? (
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      value={feet}
                      onChange={(e) => setFeet(e.target.value)}
                      placeholder="5"
                      min={3}
                      max={7}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ft</span>
                  </div>
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      value={inches}
                      onChange={(e) => setInches(e.target.value)}
                      placeholder="8"
                      min={0}
                      max={11}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">in</span>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="number"
                    value={values['height'] || ''}
                    onChange={(e) => setValue('height', e.target.value)}
                    placeholder="173"
                    min={120}
                    max={220}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">cm</span>
                </div>
              )}
            </div>
          );
        }

        // Number input
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              {field.label}
              {field.required === false && (
                <span className="text-xs text-muted-foreground ml-1">(optional)</span>
              )}
            </label>
            <div className="relative">
              <input
                type="number"
                value={values[field.id] || ''}
                onChange={(e) => setValue(field.id, e.target.value)}
                placeholder={field.placeholder}
                min={field.min}
                max={field.max}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {field.unit && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {field.unit}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Rate hint: shown when weight + goal weight + timeline are all filled */}
      {rateHint && (
        <p className={`text-xs px-1 ${
          rateHint.isSafe
            ? 'text-green-600 dark:text-green-400'
            : 'text-yellow-600 dark:text-yellow-400'
        }`}>
          ~{rateHint.rate} kg/week to {rateHint.direction}
          {rateHint.isSafe
            ? ' — healthy pace'
            : ' — aggressive, we\'ll set a safe pace'}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!isValid()}
        className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
          isValid()
            ? 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-sm'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        }`}
      >
        {data.submit_label ?? 'Continue'}
      </button>
    </div>
  );
}
