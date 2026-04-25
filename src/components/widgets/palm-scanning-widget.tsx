/**
 * PalmScanningWidget — cinematic "magic" scan animation that plays while
 * Gemini Vision is analyzing the uploaded palm. Shows a hand silhouette
 * outline traced in neon, a horizontal scanline sweeping the image, and a
 * status caption that cycles through stages.
 *
 * Payload (from chatservice/services/agents/astrology/agent.py):
 *   { type: "palm_scanning", image_url?: string, image_file_id?: string }
 */

import { useEffect, useState } from 'react';
import { getApiUrl } from '@/config/environment';

export type PalmScanningPayload = {
  type: 'palm_scanning';
  image_url?: string;
  image_file_id?: string;
};

export function tryParsePalmScanningPayload(raw: string): PalmScanningPayload | null {
  try {
    const obj = JSON.parse(raw);
    if (obj && obj.type === 'palm_scanning') return obj as PalmScanningPayload;
  } catch {
    // ignore
  }
  return null;
}

const SCAN_STAGES = [
  'Initializing Samudrika analysis…',
  'Tracing major lines…',
  'Reading mounts…',
  'Cross-referencing planetary signs…',
  'Compiling reading…',
];

export function PalmScanningWidget({ payload }: { payload: PalmScanningPayload }) {
  const imgUrl = payload.image_url
    ? payload.image_url.startsWith('http')
      ? payload.image_url
      : getApiUrl(payload.image_url.replace(/^\/api\/v1/, ''))
    : payload.image_file_id
      ? getApiUrl(`/files/${payload.image_file_id}/download`)
      : null;

  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Cycle through stage labels every ~7s.
    const stageId = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, SCAN_STAGES.length - 1));
    }, 7000);
    // Animate the progress bar over ~45s, easing toward but never quite
    // reaching 100% — when the actual analysis lands the widget below
    // takes over the user's attention.
    const startedAt = Date.now();
    const progressId = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      // Asymptotic: 1 - e^(-t/15), capped at 0.97
      const target = Math.min(0.97, 1 - Math.exp(-elapsed / 15));
      setProgress(target);
    }, 250);
    return () => {
      clearInterval(stageId);
      clearInterval(progressId);
    };
  }, []);

  return (
    <div className="my-4 rounded-2xl overflow-hidden border border-purple-500/30 bg-gradient-to-br from-purple-950/70 to-indigo-950/80 backdrop-blur-md shadow-xl">
      {/* Header: progress bar + stage text */}
      <div className="px-4 py-3 border-b border-purple-500/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-white shadow-[0_0_18px_rgba(192,132,252,0.6)]">
            <span className="text-base">🤚</span>
          </div>
          <div className="flex-1 h-2 rounded-full bg-purple-950 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-400 to-pink-500 shadow-[0_0_12px_rgba(244,114,182,0.6)]"
              style={{ width: `${progress * 100}%`, transition: 'width 250ms linear' }}
            />
          </div>
        </div>
        <div className="text-xs text-purple-200/80 tracking-wide flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
          {SCAN_STAGES[stageIndex]}
        </div>
      </div>

      {/* Image stage with overlay scanning effects */}
      <div className="relative bg-[#0a0612] aspect-[3/4] sm:aspect-[4/3] max-h-[440px] overflow-hidden">
        {imgUrl && (
          <img
            src={imgUrl}
            alt="Palm being analyzed"
            className="w-full h-full object-contain opacity-80 select-none"
            draggable={false}
          />
        )}

        {/* Sweeping horizontal scanline */}
        <div className="absolute inset-x-0 h-12 pointer-events-none palm-scan-sweep">
          <div className="absolute inset-x-0 top-1/2 h-px bg-fuchsia-300 shadow-[0_0_18px_rgba(244,114,182,0.9)]" />
          <div
            className="absolute inset-x-0 top-0 h-full"
            style={{
              background:
                'linear-gradient(to bottom, rgba(244,114,182,0) 0%, rgba(244,114,182,0.18) 50%, rgba(244,114,182,0) 100%)',
            }}
          />
        </div>

        {/* Corner brackets — "scanning HUD" feel */}
        {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
          <div
            key={corner}
            className={`absolute w-7 h-7 border-fuchsia-300/80 shadow-[0_0_8px_rgba(244,114,182,0.5)] ${
              corner === 'tl' ? 'top-3 left-3 border-t-2 border-l-2' :
              corner === 'tr' ? 'top-3 right-3 border-t-2 border-r-2' :
              corner === 'bl' ? 'bottom-3 left-3 border-b-2 border-l-2' :
                                'bottom-3 right-3 border-b-2 border-r-2'
            }`}
          />
        ))}

        {/* Subtle starfield bokeh */}
        <div className="absolute inset-0 pointer-events-none palm-scan-bokeh" />

        {/* Center crosshair badge */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-[10px] tracking-[0.4em] text-fuchsia-200/70 uppercase font-semibold">
            Scanning Palm
          </div>
        </div>
      </div>

      <style>{`
        @keyframes palm-scan-sweep-anim {
          0%   { transform: translateY(-30%); opacity: 0.0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(120%); opacity: 0.0; }
        }
        .palm-scan-sweep {
          animation: palm-scan-sweep-anim 2.4s ease-in-out infinite;
        }

        @keyframes palm-scan-bokeh-anim {
          0%   { background-position: 0% 0%; opacity: 0.45; }
          100% { background-position: 200% 100%; opacity: 0.65; }
        }
        .palm-scan-bokeh {
          background-image:
            radial-gradient(circle 1.5px at 20% 30%, rgba(255,255,255,0.65), transparent 50%),
            radial-gradient(circle 1px   at 70% 50%, rgba(255,202,40,0.55), transparent 50%),
            radial-gradient(circle 2px   at 40% 75%, rgba(192,132,252,0.55), transparent 50%),
            radial-gradient(circle 1px   at 85% 20%, rgba(255,255,255,0.5),  transparent 50%),
            radial-gradient(circle 1px   at 12% 65%, rgba(255,255,255,0.55), transparent 50%);
          background-size: 200% 200%;
          animation: palm-scan-bokeh-anim 6s ease-in-out infinite alternate;
        }
      `}</style>
    </div>
  );
}
