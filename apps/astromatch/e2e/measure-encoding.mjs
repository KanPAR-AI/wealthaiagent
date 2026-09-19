/**
 * PNG or JPEG? — measured, not chosen (docs/73 ASTRAL-331, the crop's encoding).
 *
 * The question the row asks is which reads BETTER, and the only honest way to
 * answer it is to put the same crop through the same canvas path twice, at 1×
 * and at 2× DPI, and send both to the live extractor.
 *
 * The corpus is the ENGINE'S OWN synthetic eval set,
 * `chatservice/tests/fixtures/profile_shots/` — fabricated names, dates and
 * places, rendered by `evals/astrology/make_profile_shots.py`. No profile
 * from any site is used, here or anywhere.
 *
 * Each run costs one paid Flash vision call per encoding per image and
 * consumes one of the account's daily captures. Keep the list short.
 *
 *   cd wealthaiagent/apps/astromatch && node e2e/measure-encoding.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { chromium } from 'playwright-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, '..', '..', '..', '..', 'chatservice', 'tests', 'fixtures', 'profile_shots');
const API = 'http://localhost:8080/api/v1';
const TOKEN = 'dev_token';

/** 1× drawn text, a 2× DPI capture, and the hardest one on the set. */
const CASES = ['table_00.png', 'hidpi_2x_00.png', 'low_contrast_dark_00.png'];

const manifest = JSON.parse(readFileSync(join(SHOTS, 'manifest.json'), 'utf8'));
const truthFor = (file) => manifest.shots.find((s) => s.file === file)?.truth ?? null;

const context = await chromium.launchPersistentContext('', {
  headless: true,
  channel: 'chromium',
});
const page = await context.newPage();
await page.goto('about:blank');

const rows = [];
let saved = false;

for (const file of CASES) {
  const dataUri = `data:image/png;base64,${readFileSync(join(SHOTS, file)).toString('base64')}`;
  for (const [mime, quality] of [
    ['image/png', 1],
    ['image/jpeg', 0.92],
  ]) {
    // The SAME path the panel takes: draw into a canvas, downscale the long
    // edge to 1600, encode.
    const encoded = await page.evaluate(
      async ({ dataUri, mime, quality }) => {
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
          img.src = dataUri;
        });
        const longest = Math.max(img.naturalWidth, img.naturalHeight);
        const scale = longest > 1600 ? 1600 / longest : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return {
          data: canvas.toDataURL(mime, quality),
          width: canvas.width,
          height: canvas.height,
          source: { width: img.naturalWidth, height: img.naturalHeight },
        };
      },
      { dataUri, mime, quality },
    );

    const bytes = Math.floor((encoded.data.slice(encoded.data.indexOf(',') + 1).length * 3) / 4);
    const started = Date.now();
    const res = await fetch(`${API}/astrology/extract-profile`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: encoded.data }),
    });
    const body = await res.json().catch(() => null);
    const ms = Date.now() - started;

    const truth = truthFor(file);
    const got = body?.candidates ?? {};
    const exact = ['name', 'dob', 'tob', 'pob'].filter((k) => {
      const t = truth?.[k];
      if (!t) return false;
      if (t.state === 'missing') return got[k]?.state === 'missing';
      return got[k]?.value === t.value;
    });

    rows.push({
      file,
      mime,
      out: `${encoded.width}×${encoded.height}`,
      source: `${encoded.source.width}×${encoded.source.height}`,
      kb: Math.round(bytes / 1024),
      status: res.status,
      ms,
      exact: `${exact.length}/4`,
      wrong: ['name', 'dob', 'tob', 'pob'].filter((k) => !exact.includes(k)),
    });

    if (!saved && res.status === 200) {
      // ONE captured response, as the review screen's fixture. It is the
      // engine's own bytes rather than a hand-written shape — a hand-written
      // fixture proves the client parses what somebody imagined.
      writeFileSync(
        join(HERE, '..', 'src', 'lib', '__tests__', 'fixtures', 'extract-table-00.json'),
        `${JSON.stringify(body, null, 2)}\n`,
      );
      saved = true;
      console.log('  saved extract-table-00.json');
    }
    console.log(
      `  ${file} ${mime} → ${encoded.width}×${encoded.height} ${Math.round(bytes / 1024)} KB ` +
        `status=${res.status} ${ms}ms exact=${exact.length}/4`,
    );
  }
}

console.table(rows);
await context.close();
