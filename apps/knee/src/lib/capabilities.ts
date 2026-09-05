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
   * Today — session recipes + the follow-along.
   *
   * TRUE since 2026-09-05: POST /knee/session and GET /knee/progress are the
   * user_progress store this entry waited for (chatservice ed762fd), and the
   * program read carries doses + demo-clip URLs. The capability IS the write.
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

  /** Progress — streak, pain trend, the Flow-3 phase gate, all computed
   *  server-side by GET /knee/progress. TRUE with `today`, same store. */
  progress: boolean;

  /** Sign in / sign out / account state. TRUE — `lib/auth.ts`,
   *  anonymous-first, the astro pattern trimmed of native providers. */
  accountSettings: boolean;

  /**
   * The voice coach — announcements + counting (docs/55 tier 1).
   *
   * TRUE for the SPEAKING half: expo-speech announces each exercise and
   * counts reps/holds in EN or hi-IN, fully on-device, no mic. The LISTENING
   * half ("next"/"pause" commands) is still absent — no recognition module,
   * no mic permission — and every voice action keeps its on-screen twin, so
   * the session is complete without it.
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
  today: true,
  library: true,
  coach: true,
  progress: true,
  accountSettings: true,
  voiceCoach: true,
  xrayUpload: false,
};
