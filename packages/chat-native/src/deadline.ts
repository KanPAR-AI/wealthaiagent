// A bounded await (report 457096f8, Arthur1203: "the bug-report Submit
// button hung on a spinner").
//
// PURE — no React Native — so the root jest project can drive it. The sheet's
// submit awaited four things with no bound at all: the auth token, the image
// shrink, the multipart upload (`uploadAsync`) and the plain POST. Any one of
// them stalling — a dead cell connection mid-upload is the usual one — left
// `sending` true forever, because `finally` only runs once the await settles.
// Each step now has a deadline; missing it REJECTS with a named error the
// sheet shows, and `onExpire` lets the caller cancel the work it abandoned
// (the upload task) instead of leaving it running behind a closed sheet.

export class DeadlineError extends Error {
  constructor(what: string, ms: number) {
    super(`${what} took longer than ${Math.round(ms / 1000)}s`);
    this.name = 'TimeoutError';
  }
}

export function withDeadline<T>(
  work: Promise<T>,
  ms: number,
  what: string,
  onExpire?: () => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try {
        onExpire?.();
      } finally {
        reject(new DeadlineError(what, ms));
      }
    }, ms);
    work.then(
      (v) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** The line the sheet shows for a failed send — a deadline says what to do. */
export function reportFailureLine(e: unknown): string {
  if (e instanceof DeadlineError || (e as { name?: string })?.name === 'TimeoutError') {
    // "was not sent" would be false: a post or upload can LAND after its
    // deadline (Role-3, E2 round 4). Say what is actually known.
    return 'The connection is too slow right now — your report may not have been sent. Check your reports before sending it again.';
  }
  const msg = (e as { message?: string })?.message;
  return msg || 'Try again later.';
}
