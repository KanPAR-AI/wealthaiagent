/**
 * The crop tool and the consent line (docs/73 ASTRAL-331/332).
 *
 * ── what this component owns and what it does not ─────────────────────────
 *
 * It owns the CANVAS work — measuring the capture's ink, drawing it, cutting
 * the selected rectangle out and encoding it. Every DECISION is in
 * `lib/crop.ts` and `lib/consent.ts`, which are pure and tested at the
 * workspace root with no browser in the room: where the box opens, whether
 * it is smaller than the page, how far an arrow key moves it, what is
 * transmitted, and the words the user agrees to.
 *
 * ── the image never persists ──────────────────────────────────────────────
 *
 * The capture is a string in this component's props and a bitmap on two
 * canvases. It is not written to `chrome.storage`, not to IndexedDB, not to
 * a module-level variable, and not to a ref that outlives the screen: when
 * the panel leaves this screen React drops the component and both canvases
 * go with it (ASTRAL-337). The UNCROPPED capture is never transmitted — the
 * only thing that crosses the bridge is the rectangle the user drew.
 *
 * ── keyboard ──────────────────────────────────────────────────────────────
 *
 * The selection is a focusable element with a visible focus ring. Arrows move
 * it, Shift+arrows resize it, and four number fields are the fallback for
 * anyone who wants to type the rectangle instead of drawing it. A crop tool
 * that only works with a mouse is a product that only works with a mouse.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DARK_THEME } from '@wealthai/astral';

import {
  MIN_CROP_PX,
  clampRect,
  defaultCrop,
  defaultCropFromMask,
  describeCrop,
  edgeInk,
  edgeInkFromMask,
  edgeMaskFrom,
  encodingFor,
  inkProfileFrom,
  nudge,
  outputSize,
  rectFromPoints,
  resizeBy,
  withinBound,
  solidInsideOf,
  type Block,
  type EdgeMask,
  type InkProfile,
  type Rect,
} from '../lib/crop';
import {
  CONSENT_ACTION,
  CONSENT_TEXT,
  consentFor,
  consentedTo,
  type Consent,
  type ConsentLogEntry,
} from '../lib/consent';
import { consentLog } from './bridge';
import { Heading, ghostButton, primaryButton } from './review';

const theme = DARK_THEME;

/** The panel is 380 px; this is the drawing width inside its padding. */
const VIEW_WIDTH = 348;

/**
 * The clipping warning (F308). Exported so the test binds to the string the
 * screen renders rather than to a copy of it.
 */
export const CLIPPING_WARNING =
  'Text touches the edge of your box — widen it so nothing is cut off.';

/**
 * The photo warning (F310).
 *
 * "There MAY be" rather than "there is": what has been measured is that a
 * dense block sits inside the box, which a photograph always is and a dense
 * diagram sometimes is. Claiming to have recognised a face would be claiming
 * something this panel does not do.
 */
export const PHOTO_WARNING =
  'There may be a photo inside the box. Move the box so the photo stays out.';

/** One arrow press. Alt multiplies it, for crossing a tall page. */
const NUDGE = 4;
const NUDGE_FAST = 24;

/**
 * The panel's half of the measurement: get the bitmap, hand it to the pure
 * function. "Ink" is local contrast — a pixel that differs from the one to
 * its right is an edge, and text is mostly edges — which is why it works on
 * a dark theme and a light one without knowing which.
 */
function profileOf(ctx: CanvasRenderingContext2D, width: number, height: number): InkProfile {
  return inkProfileFrom(ctx.getImageData(0, 0, width, height).data, width, height);
}

/**
 * The two-dimensional measurement (F310).
 *
 * One byte per pixel, built once when the capture opens and dropped with it.
 * It is what lets the box be measured INSIDE a rectangle — which is what
 * tells a photograph from writing, stops a 1 px border bridging every row
 * gutter, and makes the clipping guard exact instead of a page-wide guess.
 */
function maskOf(ctx: CanvasRenderingContext2D, width: number, height: number): EdgeMask {
  return edgeMaskFrom(ctx.getImageData(0, 0, width, height).data, width, height);
}

export interface CropScreenProps {
  /** the capture, as a data URI. Held by the caller for this screen only. */
  image: string;
  busy: boolean;
  /** the cropped, downscaled, encoded image — the only thing that is sent */
  onSend: (image: string) => void;
  onCancel: () => void;
  /** an error from a previous send, shown above the consent line */
  problem?: string | null;
  /**
   * What this capture interrupted, if anything (F311).
   *
   * A gesture capture replaces whatever was on screen — including a reading
   * in progress, whose chat the worker then deletes. The user watched the
   * panel change under them and is owed the sentence.
   */
  interrupted?: string;
}

export function CropScreen({
  image,
  busy,
  onSend,
  onCancel,
  problem,
  interrupted,
}: CropScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  /**
   * The ink profile, kept for the LIFETIME OF THIS SCREEN (F308).
   *
   * Two one-dimensional arrays of counts — no pixels, no bytes, nothing that
   * could reconstruct the capture — and it dies with the component like
   * everything else here. It is kept because the clipping guard has to run on
   * every edit, not only when the box first opens.
   */
  const [profile, setProfile] = useState<InkProfile | null>(null);
  /**
   * The edge mask and what the segmentation made of it (F310).
   *
   * Counts, never pixels — it cannot reconstruct the capture — and it dies
   * with the component exactly like the bitmap does. `blocks` is what the
   * photo warning consults on every box position.
   */
  const [mask, setMask] = useState<EdgeMask | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [rect, setRect] = useState<Rect | null>(null);
  /**
   * The consent, as an OBJECT keyed to this capture (ASTRAL-332).
   *
   * Not a boolean. A boolean is a "remember this" one rename away, and the
   * row forbids a remembered consent by name: an agreement given about a
   * photograph of one person is not an agreement about everybody else's. The
   * key is the capture itself, so `consentedTo` returns false the moment a
   * different image arrives — the rule is a comparison rather than something
   * to remember.
   */
  const [consent, setConsent] = useState<Consent | null>(null);
  const consented = consentedTo(consent, image);
  const [tooBig, setTooBig] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // ── load the capture, measure it, open the box ───────────────────────────
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const source = document.createElement('canvas');
      source.width = img.naturalWidth || img.width;
      source.height = img.naturalHeight || img.height;
      const ctx = source.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      sourceRef.current = source;
      setSize({ width: source.width, height: source.height });
      let measured: InkProfile = {
        width: source.width,
        height: source.height,
        rows: [],
        cols: [],
      };
      let plan: { rect: Rect; blocks: Block[] } | null = null;
      try {
        measured = profileOf(ctx, source.width, source.height);
        const built = maskOf(ctx, source.width, source.height);
        setMask(built);
        plan = defaultCropFromMask(built);
        setBlocks(plan.blocks);
      } catch (e) {
        // NOT swallowed: a canvas that will not give up its pixels means the
        // heuristic cannot run, and the default falls back to the centre band
        // — which is still not the whole page. Said in the log so a silent
        // "why is it always the centre" has an answer.
        console.warn('[astromatch] could not measure the capture; using the centre band', e);
      }
      setProfile(measured);
      // The 1-D `defaultCrop` is the FALLBACK, for a canvas that will not
      // give up its pixels. It cannot tell a photograph from writing, which
      // is why it is not the path this screen normally takes.
      setRect(plan ? plan.rect : defaultCrop(measured));
    };
    img.onerror = () => {
      if (!cancelled) console.warn('[astromatch] the capture could not be decoded');
    };
    img.src = image;
    return () => {
      cancelled = true;
      // The bitmap and the mask go with the screen. Nothing here outlives
      // the review (ASTRAL-337).
      sourceRef.current = null;
    };
  }, [image]);

  // Every new capture asks again. ASTRAL-332: the consent is per capture and
  // is never a remembered checkbox — so it is keyed to the image itself.
  useEffect(() => {
    setTooBig(false);
    setMask(null);
    setBlocks([]);
  }, [image]);

  /**
   * IS THE BOX CUTTING THROUGH TEXT RIGHT NOW? (F308, blocking 3)
   *
   * Derived from `rect` on every change — a drag, an arrow, a shift-resize, a
   * typed number — rather than computed once when the box opens. The default
   * box no longer clips, but the user can still drag one that does, and the
   * failure is silent: a clipped value comes back `stated` at high confidence
   * and reads as a fact.
   *
   * A WARNING, never a block. The profiles are one-dimensional, so this can
   * fire for ink that sits on the same row somewhere else entirely; a false
   * "widen it" costs a glance, a missed clipped name costs a wrong chart.
   */
  const clipping = useMemo(() => {
    if (!rect) return null;
    // EXACT when the mask is there — ink on the boundary WITHIN the box's own
    // extent — and the one-dimensional approximation only as a fallback.
    if (mask) return edgeInkFromMask(mask, rect);
    return profile ? edgeInk(profile, rect) : null;
  }, [mask, profile, rect]);

  /**
   * IS THERE A PHOTOGRAPH IN THE BOX RIGHT NOW? (F310)
   *
   * Derived from `rect` on every change, exactly like the clipping guard, and
   * for the same reason: the default box is clear of the photograph, and the
   * user can still drag one over it. A WARNING, never a block — the panel
   * does not get to decide what somebody may send, only to tell them what is
   * in the box.
   */
  const photoInside = useMemo(
    () => (rect && blocks.length ? solidInsideOf(blocks, rect) : null),
    [blocks, rect],
  );

  const view = useMemo(() => {
    if (!size) return null;
    const scale = Math.min(1, VIEW_WIDTH / size.width);
    return { scale, width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
  }, [size]);

  // ── draw ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const source = sourceRef.current;
    if (!canvas || !source || !view || !rect) return;
    canvas.width = view.width;
    canvas.height = view.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.drawImage(source, 0, 0, view.width, view.height);
    // Everything outside the selection is dimmed, because "what leaves" and
    // "what does not" should be legible at a glance rather than described.
    ctx.fillStyle = 'rgba(10, 8, 16, 0.72)';
    ctx.fillRect(0, 0, view.width, view.height);
    const s = view.scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x * s, rect.y * s, rect.width * s, rect.height * s);
    ctx.clip();
    ctx.drawImage(source, 0, 0, view.width, view.height);
    ctx.restore();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x * s, rect.y * s, rect.width * s, rect.height * s);
  }, [rect, view]);

  const toImage = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas || !view) return { x: 0, y: 0 };
      const box = canvas.getBoundingClientRect();
      return {
        x: Math.round((clientX - box.left) / view.scale),
        y: Math.round((clientY - box.top) / view.scale),
      };
    },
    [view],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!rect || !size) return;
    const step = e.altKey ? NUDGE_FAST : NUDGE;
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = map[e.key];
    if (!delta) return;
    e.preventDefault();
    setRect(
      e.shiftKey
        ? resizeBy(rect, delta[0], delta[1], size.width, size.height)
        : nudge(rect, delta[0], delta[1], size.width, size.height),
    );
  };

  const send = () => {
    const source = sourceRef.current;
    if (!source || !rect) return;
    const out = outputSize(rect);
    const target = document.createElement('canvas');
    target.width = out.width;
    target.height = out.height;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(
      source,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      out.width,
      out.height,
    );
    const encoding = encodingFor(rect);
    const data = target.toDataURL(encoding.mime, encoding.quality);
    if (!withinBound(data)) {
      // Refused HERE rather than by a 422 (INV-4's posture at the client
      // edge): the bound is one the panel can check, and checking it costs
      // no round trip and no paid model call.
      setTooBig(true);
      return;
    }
    setTooBig(false);
    onSend(data);
  };

  const numeric = (key: keyof Rect) => (value: string) => {
    if (!rect || !size) return;
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setRect(clampRect({ ...rect, [key]: n }, size.width, size.height));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
      <Heading>Draw a box around the birth details</Heading>
      {interrupted ? (
        <span data-testid="crop-interrupted" style={{ ...prose, color: theme.warn }}>
          {interrupted}
        </span>
      ) : null}
      <p style={prose}>
        {/* TRUE FOR EVERY BOX POSITION (F310). The sentence this replaces
            promised that the photo and the contact details stay behind —
            which was false the moment the default box included them, and
            false again the moment the user drags the box anywhere. What is
            always true is the box itself. */}
        Only what is inside the box leaves your browser. Everything outside it —
        the rest of the page — does not.
      </p>

      {view && rect ? (
        <div
          role="application"
          aria-label={
            'Crop the capture. Arrow keys move the selection, Shift with an ' +
            'arrow resizes it, Alt with an arrow moves it further.'
          }
          tabIndex={0}
          onKeyDown={onKeyDown}
          data-testid="crop-surface"
          style={{
            position: 'relative',
            width: view.width,
            alignSelf: 'center',
            outlineOffset: '3px',
            borderRadius: '8px',
          }}
        >
          <canvas
            ref={canvasRef}
            data-testid="crop-canvas"
            style={{ display: 'block', width: view.width, height: view.height, cursor: 'crosshair' }}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              drag.current = toImage(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (!drag.current || !size) return;
              setRect(
                rectFromPoints(drag.current, toImage(e.clientX, e.clientY), size.width, size.height),
              );
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
          />
        </div>
      ) : (
        <p style={prose} data-testid="crop-loading">
          Opening the capture…
        </p>
      )}

      {rect && size ? (
        <>
          <span data-testid="crop-size" style={{ ...prose, color: theme.text }}>
            {`Sending ${describeCrop(rect)} — ${
              rect.width * rect.height < size.width * size.height
                ? 'a part of the page'
                : 'the whole page'
            }.`}
          </span>
          {/* aria-live: the warning appears and disappears as the user
              drags, and somebody driving this from the keyboard has to hear
              it happen rather than find it. `polite` — it must not interrupt
              the position they are announcing. */}
          <span
            role="status"
            aria-live="polite"
            data-testid="crop-clipping"
            style={{
              fontSize: '13px',
              lineHeight: 1.45,
              color: theme.warn,
              minHeight: clipping?.any ? undefined : 0,
            }}
          >
            {clipping?.any ? CLIPPING_WARNING : ''}
          </span>
          <span
            role="status"
            aria-live="polite"
            data-testid="crop-photo-warning"
            style={{ fontSize: '13px', lineHeight: 1.45, color: theme.warn }}
          >
            {photoInside ? PHOTO_WARNING : ''}
          </span>
          <details>
            <summary style={{ ...prose, cursor: 'pointer' }}>Type the region instead</summary>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {(['x', 'y', 'width', 'height'] as Array<keyof Rect>).map((key) => (
                <label key={key} style={{ ...prose, display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {key}
                  <input
                    type="number"
                    value={rect[key]}
                    data-testid={`crop-${key}`}
                    onChange={(e) => numeric(key)(e.target.value)}
                    style={{ ...numberInput }}
                  />
                </label>
              ))}
            </div>
          </details>
        </>
      ) : null}

      {size && (size.width < MIN_CROP_PX || size.height < MIN_CROP_PX) ? (
        <span style={{ ...prose, color: theme.warn }}>
          That capture is too small to crop into.
        </span>
      ) : null}

      {problem ? (
        <span data-testid="crop-problem" style={{ ...prose, color: theme.warn }}>
          {problem}
        </span>
      ) : null}
      {tooBig ? (
        <span data-testid="crop-too-big" style={{ ...prose, color: theme.warn }}>
          That region is too large to send. Draw a smaller one around the birth details.
        </span>
      ) : null}

      {/* THE CONSENT, every capture, never a remembered box (ASTRAL-332). */}
      <label
        style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
          border: `1px solid ${consented ? theme.accent : theme.border}`,
          borderRadius: '12px',
          padding: '12px',
        }}
      >
        <input
          type="checkbox"
          checked={consented}
          data-testid="consent"
          onChange={(e) => setConsent(e.target.checked ? consentFor(image, Date.now()) : null)}
          style={{ marginTop: '2px' }}
        />
        <span
          id="consent-text"
          data-testid="consent-text"
          style={{ ...prose, color: theme.text }}
        >
          {CONSENT_TEXT}
        </span>
      </label>

      <ConsentRecord />

      <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
        <button type="button" style={ghostButton} onClick={onCancel} data-testid="crop-cancel">
          Cancel
        </button>
        <button
          type="button"
          data-testid="crop-send"
          disabled={!consented || !rect || busy}
          aria-describedby={consented ? undefined : 'consent-text'}
          style={{ ...primaryButton, opacity: consented && rect && !busy ? 1 : 0.5 }}
          onClick={send}
        >
          {busy ? 'Reading it…' : CONSENT_ACTION}
        </button>
      </div>
    </div>
  );
}

/**
 * The user's own record of what they have agreed to (ASTRAL-332).
 *
 * "Recorded locally for you to read" is a claim, and a claim with nowhere to
 * read it is a sentence in a spec. It is kept in `chrome.storage.local` by
 * the worker, carries the WORDS and the time, and carries nothing about any
 * capture — no image, no candidate, no page.
 */
function ConsentRecord() {
  const [entries, setEntries] = useState<ConsentLogEntry[] | null>(null);
  useEffect(() => {
    void consentLog()
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);
  if (!entries?.length) return null;
  const last = entries[entries.length - 1];
  return (
    <details data-testid="consent-record">
      <summary style={{ ...prose, cursor: 'pointer' }}>
        {`You have agreed to this ${entries.length} time${entries.length === 1 ? '' : 's'} — see your record`}
      </summary>
      <p style={{ ...prose, marginTop: '8px' }}>
        {`Most recently on ${new Date(last.at).toLocaleString()}, to version ${last.version} of:`}
      </p>
      <p style={{ ...prose, marginTop: '6px', fontStyle: 'italic' }}>{last.text}</p>
      <p style={{ ...prose, marginTop: '6px' }}>
        This record is kept on this computer only and is never sent anywhere.
      </p>
    </details>
  );
}

const prose: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  color: theme.textMuted,
  lineHeight: 1.5,
};

const numberInput: React.CSSProperties = {
  width: '72px',
  border: `1px solid ${theme.border}`,
  background: theme.surfaceAlt,
  color: theme.text,
  borderRadius: '8px',
  padding: '6px 8px',
  fontSize: '13px',
};
