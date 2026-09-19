// What a bubble's TEXT ends up being — the three decisions, pure.
//
// PURE: no React, no react-native. It exists because `message-bubble.tsx`
// cannot be mounted by any jest project in this workspace, so every rule that
// lived inside it was a rule no test could see. Role-3 measured exactly that:
// three separate mutations — the bubble ignoring `userText`, the bubble
// ignoring `assistantText`, the list not passing `previous` — each left the
// whole root suite green while a user's own birth date rendered in clear.
//
// Nothing here is a default for a host that passes nothing: every function
// returns what shipped when its hook is absent, so `apps/mobile` behaves
// byte-identically and only a host that OPTS IN sees a difference.

import { stripInputResponse } from '@wealthai/astral';
import type { ContentBlock, Message } from '@wealthai/core';

/**
 * A USER bubble's text: the host's, or the shipped default.
 *
 * The default is `stripInputResponse` — AMB-17 (a)'s declared cost, a widget
 * answer's raw fence suppressed on the user's own turn.
 */
export function resolveUserText(
  message: Message,
  userText?: (message: Message) => string,
): string {
  return userText ? userText(message) : stripInputResponse(message.message);
}

/**
 * An ASSISTANT bubble's replacement text, when the host has one.
 *
 * `previous` is part of the question, not a convenience: the thing
 * `apps/astro` recognises is a REPLY — the engine's correction receipt
 * states the new birth value in prose, and the only structural way to spot
 * it is that the turn before it is a `field_correction` answer. A host given
 * only this bubble would have to match the prose.
 */
export function resolveAssistantOverride(
  message: Message,
  previous: Message | undefined,
  assistantText?: (message: Message, previous: Message | undefined) => string | undefined,
): string | undefined {
  return assistantText ? assistantText(message, previous) : undefined;
}

/**
 * …and how that replacement lands: IT REPLACES THE PROSE, NOT THE REPLY.
 *
 * The first shape of this dropped `contentBlocks` wholesale, which broke a
 * real case rather than a hypothetical one (Role-3, NEW-4): the engine's
 * reply to a correction can carry a RE-ASK — an `input_request` widget — and
 * a wholesale replacement deleted the widget, so a user whose correction was
 * refused was left with a sentence and nothing to answer it with. The form
 * is not prose and is not the thing being hidden; it renders through the
 * host's own masked-request path.
 *
 * So: every non-text block survives in its original order, and the text
 * blocks collapse into ONE carrying the override, placed where the FIRST
 * text block was (at the front when there is none, so the sentence is never
 * lost below a widget).
 *
 * `override === undefined` returns the blocks UNTOUCHED — the same array,
 * so a host that supplies nothing cannot even be told this function ran.
 */
export function applyAssistantOverride(
  blocks: ContentBlock[],
  override: string | undefined,
): ContentBlock[] {
  if (override === undefined) return blocks;
  const replacement: ContentBlock = { type: 'text', content: override };
  const firstText = blocks.findIndex((b) => b.type === 'text');
  if (firstText === -1) return [replacement, ...blocks];
  const out: ContentBlock[] = [];
  blocks.forEach((b, i) => {
    if (b.type !== 'text') { out.push(b); return; }
    if (i === firstText) out.push(replacement);
  });
  return out;
}
