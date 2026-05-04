/**
 * PalmReadingWidget — renders the uploaded palm photo with neon-glow line
 * overlays + a row of share-worthy "viral" prediction chips.
 *
 * Shape of the widget payload (from chatservice/services/agents/astrology/agent.py):
 *
 *   {
 *     type: "palm_analysis",
 *     image_file_id?: string,
 *     image_url?: string,            // relative path under VITE_API_BASE_URL
 *     hand: "left" | "right" | "unknown",
 *     hand_shape: "earth" | "air" | "water" | "fire",
 *     line_coordinates?: [
 *       { name, color, path: [[x,y], …] }   // x,y normalized 0..1
 *     ],
 *     predictions?: {
 *       lifespan_years:   { value, low, high, confidence } | null,
 *       marriage_age:     { … } | null,
 *       children_count:   { … } | null,
 *       career_peak_age:  { … } | null,
 *       wealth_peak_age:  { … } | null
 *     },
 *     // …other fields rendered by the formatted markdown below the widget
 *   }
 */

import { useEffect, useRef, useState } from 'react';
import { getApiUrl } from '@/config/environment';
import { useAuth } from '@/hooks/use-auth';
import { useCachedFile } from '@/hooks/use-cached-file';

export type PalmPredictionField = {
  value: number | null;
  low?: number;
  high?: number;
  confidence?: number;
};

export type PalmAnalysisPayload = {
  type: 'palm_analysis';
  image_file_id?: string;
  image_url?: string;
  hand?: string;
  hand_shape?: string;
  line_coordinates?: Array<{
    name: string;
    color?: string;
    path: number[][]; // [[x,y], …] in 0..1 image coords
  }>;
  predictions?: {
    lifespan_years?: PalmPredictionField;
    marriage_age?: PalmPredictionField;
    children_count?: PalmPredictionField;
    career_peak_age?: PalmPredictionField;
    wealth_peak_age?: PalmPredictionField;
  };
};

export function tryParsePalmPayload(raw: string): PalmAnalysisPayload | null {
  try {
    const obj = JSON.parse(raw);
    if (obj && obj.type === 'palm_analysis') return obj as PalmAnalysisPayload;
  } catch {
    // ignore
  }
  return null;
}

const PREDICTION_CHIPS: Array<{
  key: keyof NonNullable<PalmAnalysisPayload['predictions']>;
  emoji: string;
  label: string;
  format: (v: number) => string;
  color: string;
}> = [
  { key: 'lifespan_years',  emoji: '⏳',  label: 'LIFESPAN',     format: (v) => `${v} years`,        color: '#a64dff' },
  { key: 'marriage_age',    emoji: '❤️',  label: 'LOVE',         format: (v) => `married at ${v}`,  color: '#ff4d6d' },
  { key: 'children_count',  emoji: '👨‍👩‍👧', label: 'FAMILY',     format: (v) => v === 0 ? 'no children' : v === 1 ? '1 kid' : `${v} kids`, color: '#9333ea' },
  { key: 'career_peak_age', emoji: '💼',  label: 'CAREER PEAK',  format: (v) => `age ${v}`,          color: '#4dd0ff' },
  { key: 'wealth_peak_age', emoji: '💰',  label: 'WEALTH PEAK',  format: (v) => `age ${v}`,          color: '#ffd700' },
];

function buildPath(points: number[][], w: number, h: number): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    const [x, y] = points[0];
    return `M ${x * w} ${y * h}`;
  }
  // Smooth quadratic curves through midpoints for a natural line look.
  let d = `M ${points[0][0] * w} ${points[0][1] * h}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const mx = ((x0 + x1) / 2) * w;
    const my = ((y0 + y1) / 2) * h;
    d += ` Q ${x0 * w} ${y0 * h} ${mx} ${my}`;
  }
  const last = points[points.length - 1];
  d += ` T ${last[0] * w} ${last[1] * h}`;
  return d;
}

export function PalmReadingWidget({ payload }: { payload: PalmAnalysisPayload }) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  // Resolve full backend URL for the palm image. The <img> tag below CANNOT
  // send an Authorization header, so we route the URL through useCachedFile
  // which fetches with Bearer token, caches the bytes in IndexedDB, and
  // hands back a blob: URL the <img> can render natively. Without this,
  // the file endpoint rejected unauthenticated GETs and the widget showed
  // a broken image on every reload.
  const backendUrl =
    payload.image_url
      ? payload.image_url.startsWith('http')
        ? payload.image_url
        : getApiUrl(payload.image_url.replace(/^\/api\/v1/, ''))
      : payload.image_file_id
        ? getApiUrl(`/files/${payload.image_file_id}/download`)
        : null;
  const { idToken: token } = useAuth();
  const { blobUrl, error: imgError } = useCachedFile(
    backendUrl ? { name: 'palm', type: 'image/jpeg', url: backendUrl, size: 0 } : null,
    token,
  );
  const imgUrl = blobUrl;
  // Distinguish "still fetching" (backendUrl set, blobUrl null, no error) from
  // "no image was ever attached" (no backendUrl). The original code
  // collapsed both into a single "(palm image not available)" tile, which
  // flashed briefly on every reload before the blob arrived.
  const isImgLoading = Boolean(backendUrl) && !blobUrl && !imgError;

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const measure = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    if (el.complete && el.naturalWidth > 0) measure();
    el.addEventListener('load', measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener('load', measure);
      ro.disconnect();
    };
  }, [imgUrl]);

  const lines = payload.line_coordinates || [];
  const preds = payload.predictions || {};
  const chips = PREDICTION_CHIPS.map((c) => {
    const p = preds[c.key];
    if (!p || p.value == null) return null;
    return { ...c, value: p.value };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="my-4 rounded-2xl overflow-hidden border border-purple-500/20 bg-gradient-to-br from-purple-950/60 to-indigo-950/70 backdrop-blur-md shadow-xl">
      {imgUrl ? (
        <div className="relative w-full" style={{ background: '#0a0612' }}>
          <img
            ref={imgRef}
            src={imgUrl}
            alt="Palm reading"
            className="w-full block select-none"
            draggable={false}
          />
          {dims && lines.length > 0 && (
            <svg
              className="absolute inset-0 pointer-events-none"
              width={dims.w}
              height={dims.h}
              viewBox={`0 0 ${dims.w} ${dims.h}`}
            >
              <defs>
                {lines.map((l, i) => (
                  <filter key={i} id={`palm-glow-${i}`} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                ))}
              </defs>
              {lines.map((line, i) => {
                const d = buildPath(line.path, dims.w, dims.h);
                const color = line.color || '#ffffff';
                return (
                  <g key={i} filter={`url(#palm-glow-${i})`}>
                    {/* Outer halo */}
                    <path d={d} stroke={color} strokeWidth={9} strokeLinecap="round" fill="none" opacity={0.22} />
                    {/* Bright core */}
                    <path d={d} stroke={color} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.95} />
                  </g>
                );
              })}

              {/* Floating labels for each line — anchored to the start point */}
              {lines.map((line, i) => {
                const start = line.path?.[0];
                if (!start) return null;
                const [nx, ny] = start;
                const lx = nx * dims.w;
                const ly = ny * dims.h;
                // Offset label so it doesn't sit on the line itself.
                const dx = nx < 0.5 ? -8 : 8;
                const anchor = nx < 0.5 ? 'end' : 'start';
                return (
                  <text
                    key={`label-${i}`}
                    x={lx + dx}
                    y={ly}
                    fill={line.color || '#ffffff'}
                    fontSize={Math.max(11, dims.w * 0.022)}
                    fontWeight={700}
                    textAnchor={anchor}
                    style={{
                      filter: `drop-shadow(0 0 4px ${line.color || '#ffffff'})`,
                      letterSpacing: '0.05em',
                    }}
                  >
                    {line.name.replace(/\s*\(.*\)/, '').toUpperCase()}
                  </text>
                );
              })}
            </svg>
          )}
        </div>
      ) : isImgLoading ? (
        <div className="p-6 flex items-center justify-center min-h-[180px] bg-[#0a0612]/60">
          <div className="size-6 rounded-full border-2 border-purple-300/30 border-t-purple-300 animate-spin" />
        </div>
      ) : (
        <div className="p-6 text-center text-sm text-purple-200/60">
          (palm image not available)
        </div>
      )}

      {chips.length > 0 && (
        <div className="px-4 py-4">
          <div className="text-[10px] tracking-[0.18em] uppercase text-amber-300/80 mb-3 text-center">
            ✦ Quick Predictions ✦
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {chips.map((chip) => (
              <div
                key={chip.key}
                className="rounded-xl px-3 py-2 border bg-black/40 backdrop-blur-sm"
                style={{
                  borderColor: `${chip.color}55`,
                  boxShadow: `0 0 18px ${chip.color}22, inset 0 0 12px ${chip.color}10`,
                }}
              >
                <div
                  className="text-[10px] tracking-widest font-semibold flex items-center gap-1"
                  style={{ color: chip.color }}
                >
                  <span className="text-base leading-none">{chip.emoji}</span>
                  <span>{chip.label}</span>
                </div>
                <div className="text-sm sm:text-base font-semibold text-white mt-0.5">
                  {chip.format(chip.value)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[10px] text-center text-purple-200/40">
            Traditional Samudrika indications · not medical or financial advice
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PalmPredictionsCard — pinned at the top of every holistic follow-up answer.
// Backend emits ```palm_predictions { chips: [...keys], predictions: {...} }```
// when a follow-up is being routed through the Verification Method and we
// already have palm predictions on file. This is the chip-only sibling of
// PalmReadingWidget (no image overlay, no large layout) so each follow-up
// reply opens with the lucid TikTok-style snapshot tied to the user's question.
// ---------------------------------------------------------------------------

export type PalmPredictionsPayload = {
  type: 'palm_predictions';
  chips: Array<keyof NonNullable<PalmAnalysisPayload['predictions']>>;
  predictions: NonNullable<PalmAnalysisPayload['predictions']>;
};

export function tryParsePalmPredictionsPayload(raw: string): PalmPredictionsPayload | null {
  try {
    const obj = JSON.parse(raw);
    if (obj && obj.type === 'palm_predictions' && Array.isArray(obj.chips)) {
      return obj as PalmPredictionsPayload;
    }
  } catch { /* ignore */ }
  return null;
}

export function PalmPredictionsCard({ payload }: { payload: PalmPredictionsPayload }) {
  const chips = payload.chips
    .map((key) => {
      const spec = PREDICTION_CHIPS.find((c) => c.key === key);
      const p = payload.predictions[key];
      if (!spec || !p || p.value == null) return null;
      return { ...spec, value: p.value };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (chips.length === 0) return null;
  return (
    <div className="my-3 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-950/60 to-indigo-950/70 backdrop-blur-md shadow-xl px-4 py-3">
      <div className="text-[10px] tracking-[0.18em] uppercase text-amber-300/80 mb-2 text-center">
        ✦ Your Palm Snapshot ✦
      </div>
      <div className="grid grid-cols-3 gap-2">
        {chips.map((chip) => (
          <div
            key={chip.key}
            className="rounded-xl px-2 py-2 border bg-black/40 backdrop-blur-sm text-center"
            style={{
              borderColor: `${chip.color}55`,
              boxShadow: `0 0 18px ${chip.color}22, inset 0 0 12px ${chip.color}10`,
            }}
          >
            <div
              className="text-[10px] tracking-widest font-semibold flex items-center justify-center gap-1"
              style={{ color: chip.color }}
            >
              <span className="text-base leading-none">{chip.emoji}</span>
              <span>{chip.label}</span>
            </div>
            <div className="text-xs sm:text-sm font-semibold text-white mt-0.5">
              {chip.format(chip.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
