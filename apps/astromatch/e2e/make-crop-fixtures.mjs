/**
 * Ink profiles for `crop.test.ts`, measured from real captures.
 *
 * The row's assertion is "the default crop is smaller than the capture on
 * EVERY fixture", and a fixture invented at a keyboard would prove the
 * heuristic behaves on shapes somebody imagined. So the profiles come from
 * the engine's own synthetic screenshot corpus —
 * `chatservice/tests/fixtures/profile_shots/`, seven layouts, fabricated
 * people — decoded in a real Chromium and measured with the SAME algorithm
 * the panel runs.
 *
 * ⚠ THE ALGORITHM BELOW IS A COPY of `lib/crop.ts`'s `inkProfileFrom`, and it
 * has to be: this is a plain .mjs script and that is TypeScript. The drift
 * that matters is the threshold, so `EDGE_THRESHOLD` is exported from
 * `crop.ts` and `crop.test.ts` asserts the literal below equals it. If the
 * loop itself ever changes shape, regenerate.
 *
 *   cd wealthaiagent/apps/astromatch && node e2e/make-crop-fixtures.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { chromium } from 'playwright-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, '..', '..', '..', '..', 'chatservice', 'tests', 'fixtures', 'profile_shots');
const OUT = join(HERE, '..', 'src', 'lib', '__tests__', 'fixtures', 'ink-profiles.json');

/** One per layout in the corpus, so no layout is unrepresented. */
const FILES = [
  'table_00.png',
  'two_column_00.png',
  'mixed_script_00.png',
  'photo_dominant_00.png',
  'low_contrast_dark_00.png',
  'hidpi_2x_00.png',
  'cropped_tight_00.png',
];

const EDGE_THRESHOLD = 60;

/**
 * THREE SYNTHETIC LAYOUTS WITH A PHOTO-LIKE TEXTURE (F310).
 *
 * The seven layouts above use a FLAT GREY placeholder where a real page has a
 * photograph, which is why nothing exercised the case the whole two-
 * dimensional measurement exists for: a photograph is far denser in edges
 * than text, so the old seed landed on it.
 *
 * The texture is generated PROCEDURALLY — value noise, soft blobs and a
 * gradient — and it is emphatically NOT a face and NOT any downloaded image.
 * Nothing here is a real person and nothing is fetched.
 *
 * Each layout records its OWN rectangles in the fixture JSON — the photo, the
 * header, each birth-detail value — so the tests assert against GROUND TRUTH
 * rather than against whatever the algorithm happened to produce.
 */
const PHOTO_LAYOUTS = [
  { name: 'photo_left_header.png', width: 900, height: 620, photo: 'left', header: true },
  { name: 'photo_right.png', width: 900, height: 560, photo: 'right', header: false },
  { name: 'photo_dominant_corner.png', width: 820, height: 840, photo: 'dominant', header: true },
];

const context = await chromium.launchPersistentContext('', { headless: true, channel: 'chromium' });
const page = await context.newPage();
await page.goto('about:blank');

const profiles = {};
for (const file of FILES) {
  const dataUri = `data:image/png;base64,${readFileSync(join(SHOTS, file)).toString('base64')}`;
  profiles[file] = await page.evaluate(
    async ({ dataUri, threshold }) => {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = dataUri;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const { width, height } = canvas;
      const data = ctx.getImageData(0, 0, width, height).data;
      const rows = new Array(height).fill(0);
      const cols = new Array(width).fill(0);
      for (let y = 0; y < height; y += 1) {
        for (let x = 1; x < width; x += 1) {
          const i = (y * width + x) * 4;
          const prev = i - 4;
          const edge =
            Math.abs(data[i] - data[prev]) +
            Math.abs(data[i + 1] - data[prev + 1]) +
            Math.abs(data[i + 2] - data[prev + 2]);
          if (edge > threshold) {
            rows[y] += 1;
            cols[x] += 1;
          }
        }
      }
      return { width, height, rows, cols };
    },
    { dataUri, threshold: EDGE_THRESHOLD },
  );
  console.log(`  ${file} ${profiles[file].width}×${profiles[file].height}`);
}

// ── the photo layouts ─────────────────────────────────────────────────────

const truth = {};
for (const layout of PHOTO_LAYOUTS) {
  const measured = await page.evaluate(
    async ({ layout, threshold }) => {
      const canvas = document.createElement('canvas');
      canvas.width = layout.width;
      canvas.height = layout.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // A PHOTOGRAPH-LIKE TEXTURE: value noise + soft blobs + a gradient.
      // Dense in edges everywhere, which is the property that distinguishes a
      // photograph from writing. Not a face; nothing recognisable.
      const paintPhoto = (x, y, w, h) => {
        const grad = ctx.createLinearGradient(x, y, x + w, y + h);
        grad.addColorStop(0, '#6a7f9c');
        grad.addColorStop(1, '#c9b79a');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, w, h);
        let seed = 1337;
        const rnd = () => {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          return seed / 0x7fffffff;
        };
        for (let i = 0; i < 9; i += 1) {
          const bx = x + rnd() * w;
          const by = y + rnd() * h;
          const br = 12 + rnd() * Math.min(w, h) * 0.35;
          const blob = ctx.createRadialGradient(bx, by, 0, bx, by, br);
          blob.addColorStop(0, `rgba(${40 + rnd() * 180},${40 + rnd() * 180},${40 + rnd() * 180},0.8)`);
          blob.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = blob;
          ctx.fillRect(x, y, w, h);
        }
        const img = ctx.getImageData(x, y, w, h);
        for (let i = 0; i < img.data.length; i += 4) {
          const n = (rnd() - 0.5) * 150;
          img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
          img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
          img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
        }
        ctx.putImageData(img, x, y);
      };

      const rects = { photo: null, header: null, values: [] };
      let top = 0;
      if (layout.header) {
        ctx.fillStyle = '#7a1f3d';
        ctx.fillRect(0, 0, canvas.width, 72);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px Georgia, serif';
        ctx.fillText('Asha Verma', 32, 46);
        rects.header = { x: 32, y: 20, width: 220, height: 34 };
        top = 72;
      }

      const photoW = layout.photo === 'dominant' ? 560 : 210;
      const photoH = layout.photo === 'dominant' ? 480 : 250;
      const photoX = layout.photo === 'right' ? canvas.width - photoW - 40 : 40;
      const photoY = top + 40;
      paintPhoto(photoX, photoY, photoW, photoH);
      // a 2px border, the thing that used to bridge every row gutter
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.strokeRect(photoX, photoY, photoW, photoH);
      rects.photo = { x: photoX - 1, y: photoY - 1, width: photoW + 2, height: photoH + 2 };

      const tableX =
        layout.photo === 'right' ? 40 : layout.photo === 'dominant' ? 40 : photoX + photoW + 40;
      const tableY = layout.photo === 'dominant' ? photoY + photoH + 40 : photoY + 6;
      ctx.fillStyle = '#111';
      const rows = [
        ['Date of Birth', '14 May 1994'],
        ['Time of Birth', '07:45 AM'],
        ['Place of Birth', 'Nagpur, Maharashtra'],
        ['Education', 'M.Sc. Botany'],
      ];
      ctx.font = '17px Georgia, serif';
      rows.forEach(([label, value], i) => {
        const y = tableY + i * 42;
        ctx.fillStyle = '#666';
        ctx.fillText(label, tableX, y);
        ctx.fillStyle = '#111';
        ctx.fillText(value, tableX + 170, y);
        rects.values.push({
          x: tableX + 170,
          y: y - 16,
          width: Math.ceil(ctx.measureText(value).width),
          height: 22,
        });
      });

      const { width, height } = canvas;
      const data = ctx.getImageData(0, 0, width, height).data;
      const rle = [];
      for (let y = 0; y < height; y += 1) {
        const row = [];
        let run = 0;
        let on = 0;
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4;
          const d = (a, b) =>
            Math.abs(data[a] - data[b]) +
            Math.abs(data[a + 1] - data[b + 1]) +
            Math.abs(data[a + 2] - data[b + 2]);
          const left = x > 0 ? d(i, i - 4) : 0;
          const up = y > 0 ? d(i, i - width * 4) : 0;
          const bit = left > threshold || up > threshold ? 1 : 0;
          if (bit === on) run += 1;
          else {
            row.push(run);
            on = bit;
            run = 1;
          }
        }
        row.push(run);
        rle.push(row);
      }
      return { width, height, rle, rects, png: canvas.toDataURL('image/png') };
    },
    { layout, threshold: EDGE_THRESHOLD },
  );
  truth[layout.name] = {
    width: measured.width,
    height: measured.height,
    rle: measured.rle,
    rects: measured.rects,
  };
  console.log(`  ${layout.name} ${measured.width}×${measured.height} (photo + ${measured.rects.values.length} values)`);
}

writeFileSync(
  join(HERE, '..', 'src', 'lib', '__tests__', 'fixtures', 'photo-masks.json'),
  `${JSON.stringify({
    note:
      'Edge masks (run-length encoded, starting with a ZERO run) and GROUND-TRUTH ' +
      'rectangles for three synthetic layouts with a PROCEDURAL photo-like texture ' +
      '(value noise + soft blobs + a gradient). Not a face, not a downloaded image, ' +
      'not a real person. Regenerate with apps/astromatch/e2e/make-crop-fixtures.mjs.',
    edgeThreshold: EDGE_THRESHOLD,
    layouts: truth,
  })}\n`,
);
console.log('wrote photo-masks.json');

writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      note:
        'Ink profiles measured from chatservice/tests/fixtures/profile_shots — ' +
        'the engine\'s own SYNTHETIC corpus. No real profile from any site. ' +
        'Regenerate with apps/astromatch/e2e/make-crop-fixtures.mjs.',
      edgeThreshold: EDGE_THRESHOLD,
      profiles,
    },
    null,
    0,
  )}\n`,
);
console.log(`wrote ${OUT}`);
await context.close();
