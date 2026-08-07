// Order Book API (spec docs/33, skill SKILLS/whatsapp-order-book.md).
// Tenant comes from the auth token — nothing here names a tenant (R43).

import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

async function call(path: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(getApiUrl(`/orderbook${path}`), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      const parsed = JSON.parse(body);
      message = parsed?.error?.message || parsed?.detail || body;
    } catch { /* raw body stands */ }
    throw new Error(message);
  }
  return res.json();
}

export interface OrderLine {
  text: string;
  qty: number;
  unit_price?: number;
  link?: { url: string; canonical_url: string; product_id: string; marketplace: string };
}

export interface DemandOrder {
  order_id: string;
  customer_id: string;
  customer_name: string;
  lines: OrderLine[];
  state: string;
  total: number;
  created_at?: string;
  payment_state: string;
  outstanding: number;
  supply_ids?: string[];
}

export interface SupplyOrder {
  order_id: string;
  marketplace: string;
  marketplace_order_id?: string;
  state: string;
  cost: number;
  demand_ids?: string[];
}

export interface Receivable {
  order_id: string;
  customer_id: string;
  customer_name: string;
  total: number;
  paid: number;
  outstanding: number;
  payment_state: string;
  terms: string;
  age_days: number;
  bucket: string;
}

export interface PlanAction {
  kind: string;
  priority: number;
  title: string;
  detail: string[];
  order_ids: string[];
  drafts?: { order_id: string; customer_id: string; message: string }[];
}

export interface Rule {
  rule_id: string;
  nl_source?: string;
  enabled: boolean;
  starter?: boolean;
  trigger?: Record<string, unknown>;
  filter?: Record<string, unknown>;
  action?: { type?: string; template?: string };
  dedupe?: { suppress_repeat_hours?: number };
}

export const fetchPipeline = () =>
  call("/pipeline") as Promise<{ columns: Record<string, DemandOrder[]>; supply: SupplyOrder[] }>;
export const fetchReceivables = () =>
  call("/receivables") as Promise<{ rows: Receivable[]; buckets: Record<string, number>; total_outstanding: number }>;
export const fetchReview = () =>
  call("/review") as Promise<{ items: { id: string; object_id: string; reason: string }[] }>;
export const fetchNumbers = () => call("/numbers");
export const fetchPlan = () =>
  call("/plan") as Promise<{ outstanding_total: number; actions: PlanAction[] }>;

export const createDemand = (customer_name: string, message: string, total?: number) =>
  call("/demand", { method: "POST", body: JSON.stringify({ customer_name, message, total: total || 0 }) });
export const setPrice = (orderId: string, total: number) =>
  call(`/orders/${orderId}/price`, { method: "POST", body: JSON.stringify({ total }) });
export const setState = (orderId: string, state: string) =>
  call(`/orders/${orderId}/state`, { method: "POST", body: JSON.stringify({ state }) });
export const createSupply = (marketplace: string, marketplace_order_id: string, cost: number, demand_ids: string[]) =>
  call("/supply", { method: "POST", body: JSON.stringify({ marketplace, marketplace_order_id, cost, demand_ids }) });

/** Mark-paid (R28): amount omitted = full outstanding, server-side. */
export const recordPayment = (order_id: string, mode: string, amount?: number) =>
  call("/payments", { method: "POST", body: JSON.stringify({ order_id, mode, ...(amount != null ? { amount } : {}) }) });

/** "Yes, fulfill" (R62): accepts + queues the confirmation, authorized by
 *  this tap. `always` records a standing approval for the customer (R63). */
export const fulfillOrder = (orderId: string, always: boolean) =>
  call(`/orders/${orderId}/fulfill`, { method: "POST", body: JSON.stringify({ always }) }) as
  Promise<{ state: string; message: { text: string; status: string }; standing_approval: boolean }>;
export const fetchOutbox = () =>
  call("/outbox") as Promise<{ pending: { message_id: string; customer_name: string; text: string; authorized_by: string }[] }>;
export const markOutboxSent = (messageId: string) =>
  call(`/outbox/${messageId}/mark-sent`, { method: "POST" });

export interface PaymentSuggestion {
  suggestion_id: string;
  amount: number;
  payer: string;
  raw: string;
  candidates: { order_id: string; customer_name: string; outstanding: number; why: string }[];
}
export const submitAlert = (text: string) =>
  call("/alerts", { method: "POST", body: JSON.stringify({ text }) }) as Promise<PaymentSuggestion>;
export const confirmMatch = (suggestionId: string, orderId: string) =>
  call(`/alerts/${suggestionId}/confirm`, { method: "POST", body: JSON.stringify({ order_id: orderId }) });
export const dismissMatch = (suggestionId: string) =>
  call(`/alerts/${suggestionId}/dismiss`, { method: "POST" });
export const exportCsvUrl = () => "/orderbook/export.csv";

export const compileRule = (nl: string) =>
  call("/rules/compile", { method: "POST", body: JSON.stringify({ nl }) }) as
  Promise<{ rule?: Rule; read_back?: string; clarify?: string; error?: string;
            dry_run?: { matched_now: number; preview: string } }>;
export const saveRule = (rule: Rule) =>
  call("/rules", { method: "POST", body: JSON.stringify({ rule }) });
export const listRules = () =>
  call("/rules") as Promise<{ rules: Rule[]; starters: Rule[] }>;
export const patchRule = (ruleId: string, enabled: boolean) =>
  call(`/rules/${ruleId}`, { method: "PATCH", body: JSON.stringify({ enabled }) });
export const dryRunRule = (ruleId: string) =>
  call(`/rules/${ruleId}/dry-run`, { method: "POST" }) as
  Promise<{ matched_now: number; preview: string; read_back: string }>;
export const runDue = () =>
  call("/rules/run-due", { method: "POST" }) as
  Promise<{ fired: { rule_id: string; digest: string }[] }>;
