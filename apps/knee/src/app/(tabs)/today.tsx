// UNREACHABLE in this build: `capabilities.today` is false (no user_progress
// store), so the tabs layout gives this route `href: null` — no bar item and
// no way to navigate here. The file exists because expo-router declares
// screens by file name; it renders nothing on purpose rather than a
// placeholder, per the capability rule.

export default function Today() {
  return null;
}
