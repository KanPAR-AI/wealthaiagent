// Pure half of lib/tiers.ts — testable at the workspace root without the
// native auth module.

/** "a@b.co", "+9198…", or a uid — what the server's lookup accepts. Pure. */
export function looksLikePerson(who: string): boolean {
  const s = who.trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) || /^\+\d{8,15}$/.test(s) || /^[A-Za-z0-9]{20,40}$/.test(s);
}
