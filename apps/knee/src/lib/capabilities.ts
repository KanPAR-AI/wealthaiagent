// What this build can actually DO — declared once, in one place.
//
// The house rule (apps/astro/src/lib/capabilities.ts states it in full): a
// capability marked absent REMOVES its tab, row or tile — not greyed, not
// "coming soon". This map is the only thing a surface may consult, and every
// `false` carries its reason. A capability map that lies is worse than a
// missing screen.
//
// This map is also the checked-in twin of the design canvas's honesty note
// ("KneeFit App Design", App screens page): what the boards drew as
// backend-ready ships true; what they marked as needing the user_progress
// store ships false.

export interface Capabilities {
  /**
   * Today's routine — the Home tab.
   *
   * FALSE: there is no user_progress store anywhere in chatservice. "Today's
   * 4 exercises", done-marks, resume-mid-routine and the streak all need
   * per-user writes that do not exist yet; a Home tab rendering them would
   * be inventing state client-side, which is the one thing the client never
   * does. The tab is ABSENT until the store ships.
   */
  today: boolean;

  /**
   * The exercise library — phases, complete sets, videos.
   *
   * TRUE: `GET /api/v1/knee/program` and `/program/{phase}` are live
   * (chatservice 86dee84). The counts are server truth (phase facet catalog,
   * cross-checked), the playback URLs are the same signed contract the chat
   * player uses, and the Hindi tracks ride as `dub_langs`. The capability IS
   * the read.
   */
  library: boolean;

  /** The coach chat — the knee_arthritis agent, pinned. TRUE: it is the
   *  yourfinadvisor chat wearing this brand, same as Astral's (the shared
   *  surface + a pinned agent), and the agent has been live for months. */
  coach: boolean;

  /**
   * Progress — adherence, pain trend, the phase gate.
   *
   * FALSE for exactly the reason `today` is: every number on that screen
   * (sessions done, pain check-outs, pain-free-day count) is user_progress
   * data with no store behind it. Same ship-together flag.
   */
  progress: boolean;

  /** Sign in / sign out / account state. TRUE — `lib/auth.ts`,
   *  anonymous-first, the astro pattern trimmed of native providers. */
  accountSettings: boolean;

  /**
   * The voice coach (spoken rep counts, 5-second check-ins, "next"/"pause").
   *
   * FALSE: no on-device speech recognition or TTS is wired in this build —
   * no module, no mic permission in app.json. The design's own rule makes
   * this cheap to hold: every voice action has an on-screen twin, so the
   * player ships complete without it.
   */
  voiceCoach: boolean;

  /**
   * X-ray upload from the chat composer.
   *
   * FALSE for the same reason astro's composer ships without an attach
   * button: this app has no native multipart upload path (the one that
   * exists lives in apps/mobile and has not been extracted). The knee
   * agent's KL-grading works today through apps/mobile and the web app; the
   * composer here ships with no attach affordance rather than a dead one.
   */
  xrayUpload: boolean;
}

export const CAPABILITIES: Capabilities = {
  today: false,
  library: true,
  coach: true,
  progress: false,
  accountSettings: true,
  voiceCoach: false,
  xrayUpload: false,
};
