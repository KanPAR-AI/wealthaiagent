/**
 * The birth-details lock as a property of the SOURCE (owner ruling,
 * 2026-09-19).
 *
 * Three of these cannot be tested any other way from the root jest project.
 * A screen is a `.tsx` importing `react-native`, which this project cannot
 * load, so "every screen's module graph still loads on a binary WITHOUT the
 * authenticator" is asserted here as what makes it true — that no module in
 * the app imports `expo-local-authentication` at the top level, and that the
 * one module which requires it at all probes the native registry first. The
 * live proof is the simulator, whose dev binary also lacks the module.
 *
 * Source greps strip comments first: a comment explaining the rule must not
 * be what trips the rule (the trap docs/51 records).
 */

import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', '..');

const codeOf = (rel: string) =>
  fs
    .readFileSync(path.join(APP, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** every .ts/.tsx under apps/astro/src, tests excluded */
function sourceFiles(dir = APP, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(path.relative(APP, full));
    }
  }
  return out;
}

const ALL = sourceFiles();

// ══════════════════════════════════════════════════════════════════════════
// ONE OTA BUNDLE, TWO BINARIES — build 13 must not red-screen
// ══════════════════════════════════════════════════════════════════════════

describe('the native module is optional, and asked for as one', () => {
  it('found the app’s sources', () => {
    expect(ALL.length).toBeGreaterThan(30);
    expect(ALL).toContain('lib/birth-privacy.ts');
    expect(ALL).toContain(path.join('app', 'profile.tsx'));
  });

  it('NO file imports `expo-local-authentication` at the top level', () => {
    // A static import runs `requireNativeModule` at module evaluation, which
    // throws on a binary without the pod — and every OTA reaches build 13.
    // This is the assertion that keeps that bundle loadable.
    const offenders = ALL.filter((f) =>
      /^\s*import[\s\S]{0,120}?from\s+'expo-local-authentication'/m.test(codeOf(f)),
    );
    expect(offenders).toEqual([]);
  });

  it('exactly one module requires it, and only after the registry says yes', () => {
    const owners = ALL.filter((f) => /expo-local-authentication/.test(codeOf(f)));
    expect(owners).toEqual(['lib/birth-privacy.ts']);
    const code = codeOf('lib/birth-privacy.ts');
    // the probe, by the module's own native name (verified in the package:
    // `ios/LocalAuthenticationModule.swift` → Name("ExpoLocalAuthentication"))
    expect(code).toContain("requireOptionalNativeModule('ExpoLocalAuthentication')");
    // …and the require is guarded by it, in that order
    const probeAt = code.indexOf('requireOptionalNativeModule');
    const requireAt = code.indexOf("require('expo-local-authentication')");
    expect(probeAt).toBeGreaterThan(-1);
    expect(requireAt).toBeGreaterThan(probeAt);
  });

  it('the package and its config plugin are declared for build 14', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(APP, '..', 'package.json'), 'utf8'));
    expect(pkg.dependencies['expo-local-authentication']).toBe('~57.0.3');
    const app = JSON.parse(fs.readFileSync(path.join(APP, '..', 'app.json'), 'utf8'));
    const plugin = app.expo.plugins.find(
      (p: unknown) => Array.isArray(p) && p[0] === 'expo-local-authentication',
    );
    expect(plugin).toBeDefined();
    // Apple REQUIRES a usage description for Face ID; without it the module
    // silently downgrades to the passcode prompt.
    expect(String(plugin[1].faceIDPermission)).toMatch(/Face ID/);
    expect(String(plugin[1].faceIDPermission).length).toBeGreaterThan(30);
    // …and the binary that carries it is the next one.
    expect(app.expo.ios.buildNumber).toBe('14');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// the screens cannot reach past the mask
// ══════════════════════════════════════════════════════════════════════════

describe('every surface goes through the masking wrapper', () => {
  it('Profile builds its rows with `maskedFactRows`, not `factRows`', () => {
    const code = codeOf(path.join('app', 'profile.tsx'));
    expect(code).toContain('maskedFactRows(person,');
    expect(code).not.toMatch(/[^a-zA-Z]factRows\(/);
  });

  it('the chart screen builds its birth block with `maskedChartBirthLines`', () => {
    const code = codeOf(path.join('app', 'chart.tsx'));
    expect(code).toContain('maskedChartBirthLines(chart,');
    expect(code).not.toMatch(/[^a-zA-Z]birthLines\(/);
  });

  it('the chat screen hands the transcript a masked user bubble', () => {
    const code = codeOf(path.join('app', '(tabs)', 'chat.tsx'));
    expect(code).toContain('userText={userBubbleText}');
    expect(code).toContain('maskedUserBubbleText(');
  });

  it('the kundli card in chat asks the host at paint time', () => {
    expect(codeOf('lib/astral-host.ts')).toContain('maskBirthDetails: () => !birthDetailsRevealed()');
  });

  it('the correction form drops the pre-fill through the wrapper', () => {
    const code = codeOf(path.join('app', 'birth-details.tsx'));
    expect(code).toContain('maskedInputRequest(request, birthRevealed)');
    expect(code).toContain('request={shownRequest ?? request}');
    // …and NOT when the screen is collecting another person's details
    expect(code).toContain('request && !adding');
  });

  it('every OTHER input_request surface is named, and why it needs nothing', () => {
    // Only a `field_correction` ask carries a pre-filled value
    // (`graph.py::_input_request_block`, the `if reason == "field_correction"`
    // branch), and it reaches exactly two surfaces: the correction screen
    // and the chat block. The other three render asks that have no value to
    // hide — so they are listed here rather than wrapped, and this case goes
    // red if a fourth appears.
    const renderers = ALL.filter((f) => /<InputRequestView/.test(codeOf(f)));
    expect(renderers.sort()).toEqual([
      path.join('app', 'birth-details.tsx'),   // masked
      path.join('app', 'muhurta.tsx'),         // muhurta slots, no birth fact
      path.join('app', 'palm.tsx'),            // photo slots + handedness
      path.join('app', 'preferences.tsx'),     // priorities, `multi` fields
    ].sort());
    // the fifth is the chat block, in the binding, and it IS masked
    expect(codeOf('lib/astral-host.ts')).toContain('maskInputRequest');
  });

  it('the correction receipt goes through `outcomeBanner`, not the engine text', () => {
    // F345: `graph.py::_correction_outcome_line` states the new value in
    // prose. The banner must not render that string directly while locked.
    const code = codeOf(path.join('app', 'profile.tsx'));
    expect(code).toContain('outcomeBanner({');
    expect(code).toContain('field: outcomeField');
    // the raw engine sentence is read ONCE, and only to feed the decision
    expect(code).not.toMatch(/<Text style=\{s\.noticeText\}>\{outcome\}<\/Text>/);
    expect(code).toContain('{bannerText}');
    // …and the FIELD reaches the store structurally, from the route param
    const edit = codeOf(path.join('app', 'birth-details.tsx'));
    expect(edit).toMatch(/report\(outcomeLine\(last\.message\), false, field \?\? null\)/);
  });

  it('the chart screen’s DASHA tab goes through the wrapper too', () => {
    // A Vimshottari table starts on the birth date, so this tab printed the
    // date the Birth block one tab away shows as dots.
    const code = codeOf(path.join('app', 'chart.tsx'));
    expect(code).toContain('maskedDashaRows(chart, reveal.revealed)');
    expect(code).not.toMatch(/[^a-zA-Z]dashaRows\(/);
  });

  it('the Timeline uses the three masked builders and imports no other', () => {
    const code = codeOf(path.join('app', '(tabs)', 'timeline.tsx'));
    expect(code).toContain('maskedTimelineRows(artifact, year, reveal.revealed)');
    expect(code).toContain('maskedDashaAxis(artifact, reveal.revealed)');
    expect(code).toContain('maskedAntardashaBands(artifact, index, reveal.revealed)');
    // the unmasked builders are not in scope on this screen at all
    expect(code).not.toMatch(/[^a-zA-Z]rows\(artifact/);
    expect(code).not.toMatch(/[^a-zA-Z]dashaAxis\(artifact/);
    expect(code).not.toMatch(/[^a-zA-Z]antardashaBands\(artifact/);
  });

  it('the spoken band label carries the SAME masked range as the screen', () => {
    // The one leak a screenshot cannot catch: VoiceOver reads this string.
    const code = codeOf(path.join('app', '(tabs)', 'timeline.tsx'));
    expect(code).toMatch(/accessibilityLabel=\{`\$\{band\.planet\} mahadasha, \$\{band\.range\}`\}/);
  });

  it('the birth PLACE is named through `maskedPlaceName` on both screens', () => {
    for (const file of [path.join('app', '(tabs)', 'home.tsx'), path.join('app', 'day.tsx')]) {
      expect(codeOf(file)).toContain('maskedPlaceName(');
    }
    // Home's week line takes the DECIDED name, not the raw card field
    expect(codeOf(path.join('app', '(tabs)', 'home.tsx')))
      .toContain('placeLine(selfPlace, shownPlace)');
    expect(codeOf(path.join('app', '(tabs)', 'home.tsx')))
      .not.toContain('placeLine(selfPlace, view.place)');
  });

  it('the chat host masks a FORM’s pre-fill as well as a card', () => {
    const code = codeOf('lib/astral-host.ts');
    expect(code).toContain('maskBirthDetails: () => !birthDetailsRevealed()');
    expect(code).toMatch(/maskInputRequest:[\s\S]{0,200}maskedInputRequest\(/);
  });

  it('the transcript masks the ASSISTANT receipt as well as the echo', () => {
    const code = codeOf(path.join('app', '(tabs)', 'chat.tsx'));
    expect(code).toContain('assistantText={assistantBubbleText}');
    expect(code).toContain('maskedAssistantText({');
  });

  it('Home\u2019s "periods now" card goes through the wrapper, label included', () => {
    const code = codeOf(path.join('app', '(tabs)', 'home.tsx'));
    expect(code).toContain('maskedDashaLines(res.card, birthRevealed)');
    expect(code).not.toMatch(/[^a-zA-Z]dashaLines\(res\.card\)/);
    // the spoken label is built from the SAME masked value
    expect(code).toMatch(/accessibilityLabel=\{`\$\{line\.label\}: \$\{line\.value\}`\}/);
  });

  it('the add-a-member outcome reports a field that is NOT a locked fact', () => {
    // Otherwise the banner said "Your birth details were updated." about
    // somebody ELSE's record (Role-3 NEW-5).
    const code = codeOf(path.join('app', 'birth-details.tsx'));
    expect(code).toContain("const MEMBER_OUTCOME_FIELD = 'member_add'");
    for (const call of code.match(/report\(addMemberFailure[^;]{0,160}/g) ?? []) {
      expect(call).toContain('MEMBER_OUTCOME_FIELD');
    }
    expect(code).toMatch(/report\(plainSentence\([\s\S]{0,160}MEMBER_OUTCOME_FIELD\)/);
  });

  it('the app re-locks at the ROOT when it backgrounds', () => {
    // Not on the screens alone: iOS photographs the app for the switcher as
    // it leaves, and that photograph must already be masked.
    //
    // The old form of this test was VACUOUS — it pinned that two strings
    // co-occurred in the file, which every mutation Role-3 tried satisfied.
    // What replaces it: the layout REGISTERS a handler it does not own, and
    // that handler is driven for real in `birth-privacy-relock.test.ts`.
    const code = codeOf(path.join('app', '_layout.tsx'));
    expect(code).toContain('installBirthPrivacyRelock(AppState)');
    // …and the decision is NOT restated here, where no test could see it
    expect(code).not.toContain("!== 'active'");
    expect(code).not.toContain('app_backgrounded');
  });

  it('the hook registers the same seam rather than its own `if`', () => {
    const code = codeOf('lib/use-birth-reveal.ts');
    expect(code).toContain('installBirthPrivacyRelock(AppState, probe)');
    expect(code).toContain('onScreenBlur()');
    expect(code).not.toContain("!== 'active'");
    expect(code).not.toContain("=== 'active'");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// the BUBBLE actually calls the hooks it is given (Role-3 NEW-1)
// ══════════════════════════════════════════════════════════════════════════

describe('`packages/chat-native` uses what the host passes it', () => {
  // Source pins, and the reason is measured rather than stylistic: this
  // project cannot mount React Native, so three mutations —
  //   (1) the bubble ignoring `userText`,
  //   (2) the bubble ignoring `assistantText`,
  //   (3) the list not passing `previous`
  // each left the WHOLE root suite green while the user's own date and the
  // engine's receipt rendered in clear. The DECISIONS live in
  // `bubble-text.ts` and are driven for real by its own test; these three
  // cases are the other half — that the component still calls them.
  const CHAT_NATIVE = path.join(APP, '..', '..', '..', 'packages', 'chat-native', 'src');
  const nativeCode = (file: string) =>
    fs
      .readFileSync(path.join(CHAT_NATIVE, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  it('the USER branch resolves its text through the host\u2019s hook', () => {
    const code = nativeCode('message-bubble.tsx');
    expect(code).toContain('const shownUserText = resolveUserText(message, userText);');
    // \u2026and RENDERS that value, twice: the guard and the body
    expect(code).toContain('{shownUserText ? (');
    expect(code).toContain('{shownUserText}');
  });

  it('the ASSISTANT branch resolves WITH `previous`, and uses the result', () => {
    const code = nativeCode('message-bubble.tsx');
    expect(code).toContain(
      'const override = resolveAssistantOverride(message, previous, assistantText);',
    );
    expect(code).toMatch(/const blocks = applyAssistantOverride\(\s*rawBlocks\.flatMap/);
    expect(code).toMatch(/applyAssistantOverride\([\s\S]{0,120}override,\s*\);/);
  });

  it('the LIST hands each bubble the turn before it', () => {
    const code = nativeCode('message-list.tsx');
    expect(code).toContain('previous={index > 0 ? messages[index - 1] : undefined}');
    expect(code).toContain('assistantText={assistantText}');
    expect(code).toContain('userText={userText}');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// the rules live in a pure module, and the unlock is never written down
// ══════════════════════════════════════════════════════════════════════════

describe('purity, and the absence of persistence', () => {
  it('`birth-privacy-view.ts` is React-, RN- and Expo-free', () => {
    const code = codeOf('lib/birth-privacy-view.ts');
    expect(code).not.toMatch(/from\s+'react'/);
    expect(code).not.toMatch(/from\s+'react-native'/);
    expect(code).not.toMatch(/from\s+'expo/);
    expect(code).not.toContain('.tsx');
  });

  it('holds no clock of its own — every decision takes `now`', () => {
    // A module that read `Date.now()` could not be tested at a boundary,
    // and the 60-second window IS a boundary.
    expect(codeOf('lib/birth-privacy-view.ts')).not.toContain('Date.now');
    expect(codeOf('lib/birth-privacy-view.ts')).not.toContain('new Date');
  });

  it('NEITHER privacy module writes the unlock to storage', () => {
    // A persisted unlock is a lock that asks once, ever.
    for (const file of ['lib/birth-privacy-view.ts', 'lib/birth-privacy.ts']) {
      const code = codeOf(file);
      expect(code).not.toMatch(/AsyncStorage|setItem|getItem|SecureStore|MMKV/);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// nothing exact reaches analytics or a log line
// ══════════════════════════════════════════════════════════════════════════

describe('no birth value leaves through a counter or a log', () => {
  const VALUE_WORDS =
    /\b(dob|tob|pob|date_of_birth|time_of_birth|place_of_birth|birth_facts)\b/;

  it('no `track(...)` call names a birth value', () => {
    const offenders: string[] = [];
    for (const file of ALL) {
      for (const call of codeOf(file).match(/track\([^;]{0,300}/g) ?? []) {
        if (VALUE_WORDS.test(call)) offenders.push(`${file}: ${call.slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no console line names a birth value', () => {
    const offenders: string[] = [];
    for (const file of ALL) {
      for (const call of codeOf(file).match(/console\.\w+\([^;]{0,300}/g) ?? []) {
        if (VALUE_WORDS.test(call)) offenders.push(`${file}: ${call.slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
