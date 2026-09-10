// Hindi mode — one setting, the whole app follows (owner ask 2026-09-05;
// the canvas's Language board is the spec). Pure string tables + a tiny
// store; screens read `t()` and subscribe. Exercise NAMES stay bilingual by
// design (corpus doctrine: one English corpus, language at the edges) — the
// English term is what the video says and what a doctor recognises.

import { getPlatform } from '@wealthai/core';

export type Lang = 'en' | 'hi';

const KEY = 'knee.lang';
let current: Lang = 'en';
const listeners = new Set<(l: Lang) => void>();

export function initLang(): void {
  void getPlatform().storage.getItem(KEY).then((v) => {
    if (v === 'hi' || v === 'en') {
      current = v;
      listeners.forEach((fn) => fn(current));
    }
  });
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  void getPlatform().storage.setItem(KEY, lang);
  listeners.forEach((fn) => fn(lang));
}

export function subscribeLang(fn: (l: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The BCP-47 voice for expo-speech. */
export function speechLocale(lang: Lang): string {
  return lang === 'hi' ? 'hi-IN' : 'en-US';
}

const STRINGS: Record<string, { en: string; hi: string }> = {
  // tabs
  'tab.today': { en: 'Today', hi: 'आज' },
  'tab.library': { en: 'Library', hi: 'लाइब्रेरी' },
  'tab.coach': { en: 'Coach', hi: 'कोच' },
  'tab.progress': { en: 'Progress', hi: 'प्रगति' },
  'tab.profile': { en: 'Profile', hi: 'प्रोफ़ाइल' },
  // library
  'library.title': { en: 'Exercise library', hi: 'व्यायाम लाइब्रेरी' },
  'library.completeSet': { en: 'the complete set', hi: 'पूरा सेट' },
  'library.exercises': { en: 'exercises', hi: 'व्यायाम' },
  'library.about': { en: 'About this phase', hi: 'इस फ़ेज़ के बारे में' },
  'library.phase': { en: 'Phase', hi: 'फ़ेज़' },
  'phase.eyebrow': { en: 'YOUR RECOVERY', hi: 'आपकी रिकवरी' },
  'phase.title': { en: 'Which phase am I in?', hi: 'मैं किस फ़ेज़ में हूँ?' },
  'phase.sub': { en: 'Dr. David’s program, one phase at a time. You move up when your body is ready.', hi: 'डॉ. डेविड का प्रोग्राम, एक बार में एक फ़ेज़। शरीर तैयार होने पर ही आगे बढ़ें।' },
  'phase.youreHere': { en: 'YOU’RE HERE', hi: 'आप यहाँ हैं' },
  'phase.exercises': { en: 'exercises', hi: 'व्यायाम' },
  'phase.find': { en: 'Not sure? Find my phase', hi: 'पक्का नहीं? मेरा फ़ेज़ खोजें' },
  'phase.findSub': { en: 'A 30-second check against Dr. David’s phase chart.', hi: 'डॉ. डेविड के चार्ट से 30 सेकंड की जाँच।' },
  'phase.flagsTitle': { en: 'Still flaring up — any one means Phase 1', hi: 'अब भी तकलीफ़ — कोई एक भी मतलब फ़ेज़ 1' },
  'phase.signalsTitle': { en: 'Signs of progress', hi: 'प्रगति के संकेत' },
  'phase.result': { en: 'WE’D PLACE YOU IN', hi: 'हम आपको रखेंगे' },
  'phase.setPhase': { en: 'Set as my phase', hi: 'मेरा फ़ेज़ बनाएँ' },
  'phase.notDiagnosis': { en: 'This mirrors Dr. David’s phase chart — a guide to start in the right place, not a medical diagnosis. It’s fine to be placed a step back.', hi: 'यह डॉ. डेविड का चार्ट है — सही जगह से शुरू करने की गाइड, कोई मेडिकल निदान नहीं। एक कदम पीछे रखा जाना भी ठीक है।' },
  'phase.forThis': { en: 'What this phase is for', hi: 'यह फ़ेज़ किसलिए है' },
  'phase.whyHere': { en: 'Why you’re here', hi: 'आप यहाँ क्यों हैं' },
  'phase.intoNext': { en: 'Your way into', hi: 'आगे बढ़ने का रास्ता:' },
  'phase.watchBrief': { en: 'Watch the phase brief', hi: 'फ़ेज़ का ब्रीफ़ देखें' },
  'phase.viewing': { en: 'VIEWING', hi: 'देख रहे हैं' },
  'phase.next': { en: 'Next', hi: 'आगे' },
  'phase.back': { en: 'Back', hi: 'पीछे' },
  'phase.close': { en: 'Close', hi: 'बंद करें' },
  'phase.seeResult': { en: 'See my phase', hi: 'मेरा फ़ेज़ देखें' },
  'phase.startOver': { en: 'Start over', hi: 'फिर से' },
  'phase.askCoach': { en: 'Ask the coach about this phase', hi: 'इस फ़ेज़ के बारे में कोच से पूछें' },
  'library.noFootage': { en: 'no footage yet', hi: 'वीडियो उपलब्ध नहीं' },
  'library.at': { en: 'at', hi: 'समय' },
  // section headings — the stamped non-exercise categories (SEG-5, docs/59).
  // One key per category the promoted vocabulary can send; an unknown future
  // category falls back to its own name in the screen, never a raw key.
  'library.section.activity': { en: 'Activities to keep up', hi: 'जारी रखने वाली गतिविधियाँ' },
  'library.section.equipment': { en: 'Walking aids & equipment', hi: 'सहायक उपकरण' },
  'library.section.instruction': { en: 'Technique notes', hi: 'तकनीक के निर्देश' },
  'library.section.program': { en: 'Program guides', hi: 'प्रोग्राम गाइड' },
  'library.section.other': { en: 'Also in this phase', hi: 'इस फ़ेज़ में और भी' },
  // today
  'today.title': { en: 'Pick today’s session', hi: 'आज का सत्र चुनें' },
  'today.full': { en: 'The full session', hi: 'पूरा सत्र' },
  'today.fullSub': { en: 'every exercise, the program’s own order', hi: 'सारे व्यायाम, प्रोग्राम के क्रम में' },
  'today.short': { en: 'Short on time', hi: 'समय कम है' },
  'today.shortSub': { en: 'the core moves only', hi: 'सिर्फ़ मुख्य व्यायाम' },
  'today.gentle': { en: 'Gentle · sore day', hi: 'हल्का · दर्द वाला दिन' },
  'today.gentleSub': { en: 'low-load holds only', hi: 'सिर्फ़ हल्के होल्ड' },
  'today.start': { en: 'Start the session', hi: 'सत्र शुरू करें' },
  'today.custom': { en: 'Build my own', hi: 'खुद चुनें' },
  'today.customSub': { en: 'pick exercises from the library', hi: 'लाइब्रेरी से व्यायाम चुनिए' },
  'today.customPick': { en: 'Tap to include — the program’s order is kept', hi: 'शामिल करने के लिए टैप करें — क्रम प्रोग्राम का ही रहेगा' },
  'today.dupTitle': { en: 'Very similar picks', hi: 'बहुत मिलते-जुलते विकल्प' },
  'today.dupBody': { en: 'are basically the same movement. Keep both or swap one — your call.', hi: 'लगभग एक ही व्यायाम हैं। दोनों रखें या एक बदलें — आपकी मर्ज़ी।' },
  'today.recommended': { en: 'RECOMMENDED', hi: 'सुझावित' },
  'today.done': { en: 'Today’s session is done', hi: 'आज का सत्र पूरा हो गया' },
  'today.minutes': { en: 'min', hi: 'मिनट' },
  // session
  'session.exercise': { en: 'Exercise', hi: 'व्यायाम' },
  'session.next': { en: 'Next exercise', hi: 'अगला व्यायाम' },
  'session.finish': { en: 'Finish session', hi: 'सत्र पूरा करें' },
  'session.hurts': { en: 'Hurts? Ask the coach', hi: 'दर्द हो रहा है? कोच से पूछें' },
  'session.reps': { en: 'reps', hi: 'बार' },
  'session.sets': { en: 'sets', hi: 'सेट' },
  'session.hold': { en: 'hold', hi: 'होल्ड' },
  'session.seconds': { en: 'seconds', hi: 'सेकंड' },
  'session.followVideo': { en: 'Follow the video', hi: 'वीडियो के साथ करें' },
  'session.loop': { en: 'loops this move', hi: 'यही मूव दोहराता है' },
  'session.fullVideo': { en: 'Full video', hi: 'पूरा वीडियो' },
  'session.complete': { en: 'Session complete!', hi: 'सत्र पूरा!' },
  'session.recorded': { en: 'Today is recorded', hi: 'आज का सत्र दर्ज हो गया' },
  'session.painQ': { en: 'How much pain right now?', hi: 'अभी दर्द कितना है?' },
  'session.doneBtn': { en: 'Done', hi: 'हो गया' },
  'session.streak': { en: 'day streak', hi: 'दिन की स्ट्रीक' },
  // progress
  'progress.title': { en: 'Your recovery', hi: 'आपकी रिकवरी' },
  'progress.gate': { en: 'Towards the next phase', hi: 'अगले फ़ेज़ की ओर' },
  'progress.gateDays': { en: 'pain-free days', hi: 'बिना दर्द के दिन' },
  'progress.painTrend': { en: 'Pain check-outs', hi: 'दर्द का रिकॉर्ड' },
  'progress.sessions': { en: 'sessions recorded', hi: 'सत्र दर्ज' },
  'progress.empty': { en: 'Finish your first session and this screen comes alive.', hi: 'पहला सत्र पूरा कीजिए — यह स्क्रीन जीवित हो जाएगी।' },
  // profile
  'profile.language': { en: 'Language · भाषा', hi: 'भाषा · Language' },
  'profile.credits': { en: 'Credits', hi: 'क्रेडिट' },
  'profile.reportBug': { en: 'Report a bug', hi: 'बग रिपोर्ट करें' },
  'profile.bugPlaceholder': { en: 'What went wrong? The more detail, the faster we can fix it.', hi: 'क्या गड़बड़ हुई? जितना ज़्यादा विवरण, उतनी जल्दी ठीक होगा।' },
  'profile.bugSend': { en: 'Send report', hi: 'रिपोर्ट भेजें' },
  'profile.bugSent': { en: 'Thanks — your report reached the team. 🙏', hi: 'धन्यवाद — आपकी रिपोर्ट टीम तक पहुँच गई। 🙏' },
  'profile.bugFailed': { en: 'Couldn’t send just now — please try again.', hi: 'अभी नहीं भेज सके — कृपया फिर से कोशिश करें।' },
  'profile.requestCredits': { en: 'Request more credits', hi: 'और क्रेडिट माँगें' },
  'profile.creditsRequested': { en: 'Request sent — the team will top you up.', hi: 'अनुरोध भेज दिया गया — जल्द क्रेडिट मिलेंगे।' },
};

export function t(key: string, lang: Lang = current): string {
  const row = STRINGS[key];
  if (!row) return key;
  return row[lang] ?? row.en;
}
