// Shared in-app event names (dispatched over the core platform bus).
//
// They are DEFINED in `@wealthai/chat-native` now and re-exported here
// (docs/49 ASTRAL-105): the same two channels were declared twice — mobile's
// `chat-quick-reply` and astro's `astral-widget-answer` — for the same hop,
// which is how a widget works on one surface and quietly does nothing on the
// other. One definition, and the surviving VALUES are the shipped ones, so
// nothing on the live app changes.
export { CHAT_SEND_EVENT as QUICK_REPLY_EVENT, CHAT_RETRY_EVENT as RETRY_EVENT } from '@wealthai/chat-native';
