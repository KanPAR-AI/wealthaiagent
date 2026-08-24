// What this device has already ASKED (docs/49 ASTRAL-137).
//
// One thing only: whether the birth-time upgrade path has been offered on the
// profile screen. The row's negative space is "no second ask", and an ask
// that re-renders on every open is a second ask however politely it is
// worded. The STATEMENT that the time is unknown is not stored here, because
// it is not an ask — it is the explanation for the rows that are absent, and
// it stays for ever.
//
// Device-local on purpose: this is a UI courtesy, not a fact about the user.
// A fact would belong in the People store, behind `reconcile` (INV-1).

import { getPlatform } from '@wealthai/core';

const KEY = 'astro.profile.timeAskOffered';

function keyFor(personId: string): string {
  return `${KEY}:${personId}`;
}

export async function timeAskAlreadyOffered(personId: string): Promise<boolean> {
  return (await getPlatform().storage.getItem(keyFor(personId))) === '1';
}

export function rememberTimeAskOffered(personId: string): void {
  void getPlatform().storage.setItem(keyFor(personId), '1');
}
