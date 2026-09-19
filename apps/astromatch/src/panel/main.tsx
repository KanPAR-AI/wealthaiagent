/**
 * The panel's entry point.
 *
 * Two things happen here and nothing else: this surface's host capabilities
 * are installed into `@wealthai/astral-dom` (docs/73 ASTRAL-321), and the app
 * is mounted.
 *
 * The host is where the extension differs from the web app:
 *   - `send` puts the composed answer on the service-worker port, because
 *     there is no `chat-quick-reply` window listener in a side panel.
 *   - `upload` is ABSENT, which is a real state: the panel has no network
 *     (F154) and PH-39 has no image path. The shared photo slot shows a
 *     visible refusal rather than a tap that appears to work.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installAstralDomHost } from '@wealthai/astral-dom';

import { App, deliverWidgetAnswer } from './app';

installAstralDomHost({
  send: (text: string) => deliverWidgetAnswer(text),
});

const root = document.getElementById('root');
if (!root) {
  // A panel that mounted nothing would be a blank 380 px column with no
  // explanation. Loud.
  throw new Error('[astromatch] panel.html has no #root to mount into');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
