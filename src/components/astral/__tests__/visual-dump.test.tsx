/**
 * Not an assertion test — a VISUAL ARTIFACT generator.
 *
 * The astral renderer had 153 passing unit tests and had never been looked
 * at. This repo's own lesson (A6#1: Rahu and Ketu missing from every chart
 * for months, all tests green) is that assertions do not see layout. The DOM
 * adapter styles inline, so a dumped container is a faithful standalone page.
 *
 * Writes /tmp/astral-visual/*.html for a screenshot pass at both widths
 * ASTRAL-18 names: the 380px extension side panel and a 900px app width.
 *
 * To look at them:
 *   npx jest --testPathPattern visual-dump
 *   open /tmp/astral-visual/natal-timed-panel.html
 * or screenshot them all with a few lines of @playwright/test against the
 * file:// URLs. Two real defects came out of doing exactly that — see the
 * "Degree" label and the crowded-cell handling in natal-chart.tsx.
 */
import fs from 'fs';
import path from 'path';

import { renderNatal, renderMatch, renderMuhurta, PANEL_WIDTH, APP_WIDTH } from './render-shared';
import { natalTimedPayload, natalTimelessPayload, matchTimedPayload, matchTimelessPayload, muhurtaPayload }
  from '../../../../packages/astral/src/fixtures/payloads';

const OUT = process.env.ASTRAL_VISUAL_OUT || '/tmp/astral-visual';

function dump(name: string, html: string, width: number) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.html`), `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#fff;font:14px/1.5 system-ui,sans-serif}
.frame{width:${width}px;margin:0 auto;outline:1px dashed #ccc}
.cap{font:600 11px monospace;color:#666;padding:6px 0;text-align:center}</style>
<div class="cap">${name} · ${width}px</div><div class="frame">${html}</div>`);
}

describe('visual dump', () => {
  it('writes the shared blocks at both widths', () => {
    const cases: Array<[string, () => { container: HTMLElement }, number]> = [
      ['natal-timed-app', () => renderNatal(natalTimedPayload, APP_WIDTH), APP_WIDTH],
      ['natal-timed-panel', () => renderNatal(natalTimedPayload, PANEL_WIDTH), PANEL_WIDTH],
      ['natal-timeless-app', () => renderNatal(natalTimelessPayload, APP_WIDTH), APP_WIDTH],
      ['match-app', () => renderMatch(matchTimedPayload, APP_WIDTH), APP_WIDTH],
      ['match-panel', () => renderMatch(matchTimedPayload, PANEL_WIDTH), PANEL_WIDTH],
      ['match-timeless-app', () => renderMatch(matchTimelessPayload, APP_WIDTH), APP_WIDTH],
      ['muhurta-app', () => renderMuhurta(muhurtaPayload, APP_WIDTH), APP_WIDTH],
    ];
    for (const [name, fn, width] of cases) {
      dump(name, fn().container.innerHTML, width);
    }
    expect(fs.readdirSync(OUT).length).toBeGreaterThanOrEqual(6);
  });
});
