// Report a problem, from anywhere in the app (docs/49 ASTRAL-163).
//
// The SHEET is `@wealthai/chat-native`'s — the same one apps/mobile opens,
// posting to the same `/bug-reports` endpoint into the same /admin/bugs
// queue. What this file adds is the two things only this app knows: where
// the report was filed FROM, and what to photograph.
//
// ── capture before open, and it is not negotiable ─────────────────────────
//
// `captureRef` runs on the mounted screen BEFORE the sheet is shown, so the
// sheet is never in its own screenshot — a report whose picture is the
// report form is a report with no evidence in it. A capture FAILURE still
// opens the sheet: the words matter more than the picture, and a reporter
// who is told "no" by a screenshot library simply does not report.
//
// The provider wraps the whole navigator, so every screen is capturable and
// every screen can raise the sheet. Screen 1 (the ceremonial onboarding
// frame) deliberately offers no entry — a bug sheet over the first frame of
// a first launch is noise — but it is inside the provider, so a report filed
// a moment later still photographs whatever is on screen.

import Constants from 'expo-constants';
import { usePathname } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View } from 'react-native';

import { BugReportSheet } from '@wealthai/chat-native';

import { astroChatTheme } from './chat-theme';
import { lastChatId } from './chat-session';
import { track } from './analytics';
import { tokens } from '@/theme';

interface BugReportApi {
  /** Photograph the current screen, then open the sheet over it. */
  report: () => void;
}

const BugReportContext = createContext<BugReportApi | null>(null);

/** The build a report came from — an app-store build number is what a
 *  triager needs to know which bundle they are looking at. */
const BUILD =
  `${Constants.expoConfig?.version ?? '?'}` +
  `(${Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? '?'})`;

export function BugReportProvider({ children }: { children: ReactNode }) {
  const rootRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const route = usePathname();

  // The transcript to attach, read from the one place that knows it.
  useEffect(() => {
    if (!open) return;
    lastChatId().then(setChatId).catch(() => setChatId(null));
  }, [open]);

  const report = useCallback(async () => {
    let captured: string | null = null;
    try {
      const vs = await import('react-native-view-shot');
      // captureRef on the mounted view is far more reliable than
      // captureScreen (which flakes on new-arch / static frameworks and was
      // silently returning null → no auto-attached screenshot). Fall back to
      // captureScreen only if the ref capture is unavailable.
      if (rootRef.current && vs.captureRef) {
        captured = await vs.captureRef(rootRef, { format: 'jpg', quality: 0.85 });
      } else if (vs.captureScreen) {
        captured = await vs.captureScreen({ format: 'jpg', quality: 0.85 });
      }
    } catch (e) {
      // Surfaced, not swallowed: the on-device console shows the real cause,
      // and the sheet still opens.
      console.warn('[reportBug] screen capture failed:', e);
    }
    setShot(captured);
    setOpen(true);
    track('bug_report_opened', { route, captured: captured ? 1 : 0 });
  }, [route]);

  return (
    <BugReportContext.Provider value={{ report: () => void report() }}>
      <View ref={rootRef} collapsable={false} style={styles.fill}>
        {children}
      </View>
      <BugReportSheet
        visible={open}
        onClose={() => setOpen(false)}
        screenShotUri={shot}
        chatId={chatId}
        theme={astroChatTheme}
        brand={tokens.wordmark}
        subtitle="Your reading and this screen are attached automatically."
        context={{
          // `url` is what /admin/bugs already displays for a report's origin;
          // `route` and `build` are named separately so triage can filter.
          url: `astro://${route}`,
          route,
          build: BUILD,
        }}
      />
    </BugReportContext.Provider>
  );
}

/**
 * Raise the sheet from any screen inside the provider.
 *
 * Throws outside it rather than returning a no-op: a "Report a problem"
 * button that silently does nothing is worse than no button, and this is a
 * wiring mistake that only a developer can make.
 */
export function useReportProblem(): () => void {
  const api = useContext(BugReportContext);
  if (!api) {
    throw new Error(
      '[bug-report] useReportProblem used outside <BugReportProvider> ' +
        '(mount it in app/_layout.tsx — docs/49 ASTRAL-163).',
    );
  }
  return api.report;
}

const styles = { fill: { flex: 1 } } as const;
