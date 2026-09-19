/**
 * Capture a `match_report` stream from the RUNNING engine, as a test fixture.
 *
 * A hand-written scorecard proves the client parses what somebody imagined.
 * This drives the shipped §3a sequence against the local backend and writes
 * the raw SSE, then deletes the chat it created.
 *
 * The person is SYNTHETIC and deliberately TIME-LESS, which is the case the
 * snapshot path meets most: a matrimonial page almost never shows a birth
 * time, so the reading that comes back is the 15-firm/21-pending one and the
 * chips have to answer from it.
 *
 *   cd wealthaiagent/apps/astromatch && node e2e/capture-stream.mjs
 */

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'src', 'lib', '__tests__', 'fixtures', 'stream-match-firm-only.sse');
const API = 'http://localhost:8080/api/v1';
const TOKEN = 'dev_token';

const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function stream(chatId) {
  const res = await fetch(`${API}/chats/${chatId}/stream?force_agent=astrology_ai`, { headers });
  return res.text();
}

const deltas = (raw) =>
  raw
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => {
      try {
        return JSON.parse(l.slice(6));
      } catch {
        return null;
      }
    })
    .filter((e) => e && e.type === 'message_delta')
    .map((e) => e.delta)
    .join('');

const created = await api('/chats', {
  method: 'POST',
  body: JSON.stringify({
    title: 'FIXTURE — firm only',
    firstMessage: { content: 'Match my kundli with theirs.', attachments: [] },
  }),
});
const chatId = created.body?.chat?.id;
if (!chatId) throw new Error(`no chat id: ${JSON.stringify(created)}`);
console.log(`  chat ${chatId}`);

// The opener's turn can come back empty when the stream is opened before
// the engine has queued it; one retry is the difference between a flaky
// capture script and a wrong conclusion about the engine.
let first = await stream(chatId);
let ask = /```input_request\n([\s\S]*?)\n```/.exec(deltas(first));
for (let i = 0; i < 4 && !ask; i += 1) {
  await new Promise((r) => setTimeout(r, 2000));
  first = await stream(chatId);
  ask = /```input_request\n([\s\S]*?)\n```/.exec(deltas(first));
}
if (!ask) throw new Error(`no input_request on the first turn:\n${deltas(first).slice(0, 800)}`);
const request = JSON.parse(ask[1]);
console.log(`  asked for: ${request.fields.map((f) => f.key).join(', ')}`);

const values = {
  person2_dob: process.env.DOB || '1990-08-02',
  person2_tob: null,
  person2_pob: process.env.POB || 'Ranchi, Jharkhand, India',
  person2_name: 'Fixture Person',
  capture_source: 'snapshot',
  capture_edited: [],
};
const answered = Object.fromEntries(
  Object.entries(values).filter(([k]) => request.fields.some((f) => f.key === k) || k.startsWith('capture_')),
);
const payload = { type: 'input_response', ask: request.ask, echo: 'Fixture', values: answered };
await api(`/chats/${chatId}/messages?auto_reply=false`, {
  method: 'POST',
  body: JSON.stringify({
    content: `Fixture\n\n\`\`\`input_response\n${JSON.stringify(payload)}\n\`\`\``,
    attachments: [],
  }),
});

let second = await stream(chatId);
let text = deltas(second);
let report = /```match_report\n([\s\S]*?)\n```/.exec(text);
for (let i = 0; i < 5 && !report && !text.trim(); i += 1) {
  await new Promise((r) => setTimeout(r, 3000));
  second = await stream(chatId);
  text = deltas(second);
  report = /```match_report\n([\s\S]*?)\n```/.exec(text);
}
if (!report) {
  console.log('=== TURN TEXT ===\n' + text.slice(0, 2500) + '\n=== END ===');
  const gone = await fetch(`${API}/chats/${chatId}`, { method: 'DELETE', headers });
  console.log(`  deleted the fixture chat → ${gone.status}`);
  throw new Error('no match_report on the second turn');
}
const parsed = JSON.parse(report[1]);
console.log(
  `  time_known=${parsed.time_known} total=${parsed.total} firm=${parsed.firm_total}/${parsed.firm_max} ` +
    `pending_max=${parsed.pending_max} doshas=${parsed.doshas.length} reasons=${parsed.pending_reasons.length}`,
);

writeFileSync(OUT, second);
console.log(`  wrote ${OUT}`);

const gone = await fetch(`${API}/chats/${chatId}`, { method: 'DELETE', headers });
console.log(`  deleted the fixture chat → ${gone.status}`);
