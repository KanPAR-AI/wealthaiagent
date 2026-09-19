/**
 * MOVED (docs/73 ASTRAL-321). The adapter itself now lives in
 * `@wealthai/astral-dom` so the AstroMatch extension panel can render the
 * same primitives without copying a file whose `@/…` imports would have
 * resolved to a different module there (F153, and F22 before it).
 *
 * What is left here is the web app's WIRING, not rendering: importing this
 * module installs this app's host capabilities. Zero rendering logic.
 */

import '@/components/astral/install-host';

export { domPrimitives } from '@wealthai/astral-dom';
