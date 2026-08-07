// The Order Book — a reseller's khata, digitized. Spec docs/33; read
// SKILLS/whatsapp-order-book.md before changing behaviour here.
//
// Five screens (§7): Book (pipeline + the planner's strip), Review, Dues
// (receivables), Numbers, Loops (rules). Mobile-first: the owner is on a
// phone behind a counter — bottom tab bar, thumb-sized targets, horizontal
// snap columns. Mark-paid is two taps (R28): tap a due row, tap confirm.
// Nothing on this page sends anything to a customer (R24/R32) — reminder
// drafts are copied to the clipboard for the owner to paste into WhatsApp.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3, BookOpenText, CircleAlert, HandCoins, Repeat2,
} from "lucide-react";

import {
  compileRule, createDemand, dryRunRule, fetchNumbers, fetchOutbox,
  fetchPipeline, fetchPlan, fetchReceivables, fetchReview, fulfillOrder,
  listRules, markOutboxSent, patchRule, recordPayment, runDue, saveRule,
  setPrice, setState,
  type DemandOrder, type PlanAction, type Receivable, type Rule,
} from "@/services/orderbook-service";
import "./orderbook.css";

const TABS = [
  { id: "book", label: "Book", icon: BookOpenText },
  { id: "review", label: "Review", icon: CircleAlert },
  { id: "dues", label: "Dues", icon: HandCoins },
  { id: "numbers", label: "Numbers", icon: BarChart3 },
  { id: "loops", label: "Loops", icon: Repeat2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

const NEXT_STATE: Record<string, string> = {
  requested: "accepted", quoted: "accepted", accepted: "procured",
  procured: "shipped", shipped: "delivered",
};

const rupee = (n: number) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function OrderBook() {
  const [tab, setTab] = useState<TabId>("book");
  const [outstanding, setOutstanding] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const bump = useCallback(() => setRefresh((n) => n + 1), []);

  useEffect(() => {
    fetchReceivables()
      .then((r) => setOutstanding(r.total_outstanding))
      .catch(() => undefined);
  }, [refresh]);

  return (
    <div className="khata">
      <header className="khata-head">
        <h1 className="khata-title">
          Order Book
          <span className="khata-devanagari">खाता · the daily ledger</span>
        </h1>
        <div className="khata-owing">
          <span className="amt">{rupee(outstanding)}</span>
          <span className="lbl">owed to you</span>
        </div>
      </header>

      <nav className="khata-tabs" aria-label="Order book sections">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className="khata-tab" data-active={tab === id}
                  onClick={() => setTab(id)}>
            <Icon size={17} strokeWidth={2.2} />
            {label}
          </button>
        ))}
      </nav>

      <main className="khata-body">
        {tab === "book" && <BookScreen refresh={refresh} bump={bump} />}
        {tab === "review" && <ReviewScreen refresh={refresh} bump={bump} />}
        {tab === "dues" && <DuesScreen refresh={refresh} bump={bump} />}
        {tab === "numbers" && <NumbersScreen refresh={refresh} />}
        {tab === "loops" && <LoopsScreen />}
      </main>

      <NewEntryFab bump={bump} />
    </div>
  );
}

/* ── Book: the planner strip + pipeline board ─────────────────────────── */

function BookScreen({ refresh, bump }: { refresh: number; bump: () => void }) {
  const [plan, setPlan] = useState<PlanAction[]>([]);
  const [columns, setColumns] = useState<Record<string, DemandOrder[]>>({});
  const [fulfilling, setFulfilling] = useState<DemandOrder | null>(null);
  const [always, setAlways] = useState(false);

  useEffect(() => {
    fetchPlan().then((p) => setPlan(p.actions)).catch(() => undefined);
    fetchPipeline().then((p) => setColumns(p.columns)).catch(() => undefined);
  }, [refresh]);

  const advance = async (order: DemandOrder) => {
    const next = NEXT_STATE[order.state];
    if (!next) return;
    try {
      await setState(order.order_id, next);
      toast.success(`${order.customer_name || order.order_id} → ${next}`);
      bump();
    } catch (e) {
      toast.error(String(e));
    }
  };

  // "Yes, fulfill" (R62): one tap accepts AND sends/queues the customer's
  // confirmation. The optional checkbox records a standing approval (R63).
  const confirmFulfill = async () => {
    if (!fulfilling) return;
    try {
      const res = await fulfillOrder(fulfilling.order_id, always);
      toast.success(res.message.status === "sent"
        ? "Confirmed — reply sent on WhatsApp"
        : "Confirmed — reply queued in Review › To send");
      if (res.standing_approval) {
        toast.info(`Always-fulfill is ON for ${fulfilling.customer_name}`);
      }
      setFulfilling(null); setAlways(false); bump();
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <>
      {plan.length > 0 && (
        <>
          <h2 className="khata-section-title">Today’s plan</h2>
          <div className="khata-plan">
            {plan.map((a) => (
              <div className="khata-plan-card" key={a.kind}>
                <div className="t">{a.title}</div>
                <div className="d">
                  {a.detail.slice(0, 4).map((d, i) => <div key={i}>· {d}</div>)}
                </div>
                {a.drafts?.length ? (
                  <button className="copy" onClick={() => {
                    navigator.clipboard.writeText(
                      a.drafts!.map((d) => d.message).join("\n\n"));
                    toast.success("Reminder drafts copied — paste in WhatsApp");
                  }}>
                    Copy {a.drafts.length} draft(s)
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="khata-section-title">Pipeline</h2>
      <div className="khata-board">
        {Object.entries(columns).map(([col, orders]) => (
          <section className="khata-col" key={col}>
            <div className="khata-col-head">
              <span>{col}</span><span className="n">{orders.length}</span>
            </div>
            {orders.length === 0 && <p className="khata-empty">empty page</p>}
            {orders.map((o) => (
              <article className="khata-slip" key={o.order_id}>
                <div className="who">{o.customer_name || o.customer_id}</div>
                <div className="what">
                  {o.lines.map((l, i) => (
                    <span key={i}>
                      {l.qty > 1 ? `${l.qty}× ` : ""}{l.text}
                      {l.link?.canonical_url && (
                        <> <a href={l.link.canonical_url} target="_blank"
                              rel="noopener noreferrer">
                          {l.link.marketplace}↗
                        </a></>
                      )}
                      {i < o.lines.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </div>
                <div className="row">
                  <span className="khata-amt">
                    {o.total ? rupee(o.total) : "—"}
                  </span>
                  <span className={`khata-stamp ${o.payment_state}`}>
                    {o.payment_state.replace("_", " ")}
                  </span>
                  {["requested", "quoted"].includes(o.state) && o.total > 0 ? (
                    <button className="khata-advance"
                            onClick={() => setFulfilling(o)}>
                      ✓ Fulfil
                    </button>
                  ) : NEXT_STATE[o.state] ? (
                    <button className="khata-advance" onClick={() => advance(o)}>
                      → {NEXT_STATE[o.state]}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>

      {fulfilling && (
        <Sheet onClose={() => { setFulfilling(null); setAlways(false); }}
               title={`Fulfil for ${fulfilling.customer_name || fulfilling.customer_id}?`}
               sub={`${rupee(fulfilling.total)} — your tap approves the order AND the WhatsApp confirmation to the customer.`}>
          <label style={{ display: "flex", alignItems: "center", gap: 10,
                          fontSize: 13.5, margin: "2px 0 14px", cursor: "pointer" }}>
            <input type="checkbox" checked={always}
                   onChange={(e) => setAlways(e.target.checked)}
                   style={{ width: 18, height: 18, accentColor: "var(--margin-red)" }} />
            Always fulfil for this customer (priced orders auto-confirm; you
            can switch it off any time)
          </label>
          <button className="khata-primary" onClick={confirmFulfill}>
            Yes, fulfil ✓
          </button>
        </Sheet>
      )}
    </>
  );
}

/* ── Review queue (O9) ────────────────────────────────────────────────── */

function ReviewScreen({ refresh, bump }: { refresh: number; bump: () => void }) {
  const [items, setItems] = useState<{ id: string; object_id: string; reason: string }[]>([]);
  const [toSend, setToSend] = useState<{ message_id: string; customer_name: string; text: string; authorized_by: string }[]>([]);
  const [pricing, setPricing] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    fetchReview().then((r) => setItems(r.items)).catch(() => undefined);
    fetchOutbox().then((r) => setToSend(r.pending)).catch(() => undefined);
  }, [refresh]);

  const submitPrice = async () => {
    if (!pricing || !amount) return;
    try {
      await setPrice(pricing, parseFloat(amount));
      toast.success("Quoted — the order moved on");
      setPricing(null); setAmount(""); bump();
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <>
      {toSend.length > 0 && (
        <>
          <h2 className="khata-section-title">To send — approved replies</h2>
          {toSend.map((m) => (
            <div className="khata-rule" key={m.message_id}>
              <div className="nl">{m.customer_name}</div>
              <div className="rb">{m.text}</div>
              <div className="foot">
                <button className="khata-ghost" onClick={() => {
                  navigator.clipboard.writeText(m.text);
                  toast.success("Copied — paste it in WhatsApp");
                }}>Copy</button>
                <button className="khata-ghost" onClick={async () => {
                  await markOutboxSent(m.message_id);
                  toast.success("Marked sent"); bump();
                }}>I sent it ✓</button>
                <span style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>
                  {m.authorized_by.startsWith("standing") ? "standing approval" : "your tap"}
                </span>
              </div>
            </div>
          ))}
        </>
      )}

      <h2 className="khata-section-title">Waiting on you</h2>
      {items.length === 0 && <p className="khata-empty">nothing needs review — clean page</p>}
      {items.map((it) => (
        <div className="khata-review-item" key={it.id}>
          <CircleAlert size={16} />
          <div style={{ flex: 1 }}>
            <div>{it.reason}</div>
            <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{it.object_id}</div>
          </div>
          {it.reason.includes("price") && (
            <button className="khata-ghost" onClick={() => setPricing(it.object_id)}>
              Set price
            </button>
          )}
        </div>
      ))}
      {pricing && (
        <Sheet onClose={() => setPricing(null)} title="Quote this order"
               sub={`Order ${pricing} — the customer sent a link; you set the price (the link is the line item).`}>
          <input className="khata-input khata-amount-input" inputMode="decimal"
                 placeholder="₹ amount" autoFocus value={amount}
                 onChange={(e) => setAmount(e.target.value)} />
          <button className="khata-primary" disabled={!amount} onClick={submitPrice}>
            Quote {amount ? rupee(parseFloat(amount) || 0) : ""}
          </button>
        </Sheet>
      )}
    </>
  );
}

/* ── Dues: receivables + two-tap mark-paid (R28) ──────────────────────── */

function DuesScreen({ refresh, bump }: { refresh: number; bump: () => void }) {
  const [rows, setRows] = useState<Receivable[]>([]);
  const [buckets, setBuckets] = useState<Record<string, number>>({});
  const [paying, setPaying] = useState<Receivable | null>(null);
  const [mode, setMode] = useState("upi");
  const [amount, setAmount] = useState<string>("");

  useEffect(() => {
    fetchReceivables().then((r) => {
      setRows(r.rows); setBuckets(r.buckets);
    }).catch(() => undefined);
  }, [refresh]);

  const confirm = async () => {
    if (!paying) return;
    try {
      // Amount untouched -> omitted -> server records full outstanding (R28).
      const custom = amount && parseFloat(amount) !== paying.outstanding
        ? parseFloat(amount) : undefined;
      const res = await recordPayment(paying.order_id, mode, custom);
      toast.success(`${rupee(res.amount)} received — ${res.payment_state}`);
      setPaying(null); setAmount(""); bump();
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <>
      <h2 className="khata-section-title">Aging</h2>
      <div className="khata-buckets">
        {["0-7", "8-15", "16-30", "30+"].map((b) => (
          <div className={`khata-bucket${b === "30+" && buckets[b] ? " hot" : ""}`} key={b}>
            <div className="b">{b} days</div>
            <div className="v">{rupee(buckets[b] || 0)}</div>
          </div>
        ))}
      </div>

      <h2 className="khata-section-title">Who owes what</h2>
      {rows.length === 0 && <p className="khata-empty">nobody owes you — rare and beautiful</p>}
      {rows.map((r) => (
        <button className="khata-due-row" key={r.order_id}
                onClick={() => { setPaying(r); setAmount(String(r.outstanding)); }}>
          <div>
            <div className="who">{r.customer_name || r.customer_id}</div>
            <div className="meta">
              {r.age_days}d · {r.terms.replace("_", " ")} · paid {rupee(r.paid)} of {rupee(r.total)}
            </div>
          </div>
          <div className="owed">{rupee(r.outstanding)}</div>
        </button>
      ))}

      {paying && (
        <Sheet onClose={() => setPaying(null)}
               title={`${paying.customer_name || paying.customer_id} paid you`}
               sub={`Order ${paying.order_id} · ${rupee(paying.outstanding)} outstanding`}>
          <input className="khata-input khata-amount-input" inputMode="decimal"
                 value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="khata-modes">
            {["cash", "upi", "bank"].map((m) => (
              <button key={m} className="khata-mode" data-on={mode === m}
                      onClick={() => setMode(m)}>
                {m.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="khata-primary" onClick={confirm}>
            Received {amount ? rupee(parseFloat(amount) || 0) : ""} ✓
          </button>
        </Sheet>
      )}
    </>
  );
}

/* ── Numbers (O12–O14) ────────────────────────────────────────────────── */

function NumbersScreen({ refresh }: { refresh: number }) {
  const [n, setN] = useState<any>(null);

  useEffect(() => {
    fetchNumbers().then(setN).catch(() => undefined);
  }, [refresh]);

  if (!n) return <p className="khata-empty">counting…</p>;
  return (
    <>
      <h2 className="khata-section-title">Today</h2>
      <div className="khata-stats">
        <div className="khata-stat"><div className="v">{n.today.orders}</div><div className="l">orders</div></div>
        <div className="khata-stat"><div className="v">{rupee(n.today.revenue)}</div><div className="l">revenue</div></div>
        <div className="khata-stat"><div className="v">{rupee(n.today.collected)}</div><div className="l">collected</div></div>
        <div className="khata-stat"><div className="v">{n.month.repeat_customers}</div><div className="l">repeat customers</div></div>
      </div>
      <h2 className="khata-section-title">This month</h2>
      <div className="khata-stats">
        <div className="khata-stat"><div className="v">{n.month.orders}</div><div className="l">orders</div></div>
        <div className="khata-stat"><div className="v">{rupee(n.month.revenue)}</div><div className="l">revenue</div></div>
        <div className="khata-stat"><div className="v">{rupee(n.month.aov)}</div><div className="l">avg order</div></div>
        <div className="khata-stat"><div className="v">{n.month.customers}</div><div className="l">customers</div></div>
      </div>
      {n.velocity?.length > 0 && (
        <>
          <h2 className="khata-section-title">What’s moving</h2>
          {n.velocity.slice(0, 8).map((v: any) => (
            <div className="khata-line-item" key={v.item}>
              <span>{v.item}</span>
              <span className="m">{v.qty_7d} / 7d · {v.qty_28d} / 28d</span>
            </div>
          ))}
        </>
      )}
      {n.margins?.length > 0 && (
        <>
          <h2 className="khata-section-title">Margin per order</h2>
          {n.margins.slice(0, 8).map((m: any) => (
            <div className="khata-line-item" key={m.order_id}>
              <span>{m.order_id}{m.approximate_split ? " (split ~)" : ""}</span>
              <span className="m">{rupee(m.revenue)} − {rupee(m.cost)} = {rupee(m.margin)}</span>
            </div>
          ))}
        </>
      )}
    </>
  );
}

/* ── Loops: the rule manager + NL compile flow (§4) ───────────────────── */

function LoopsScreen() {
  const [nl, setNl] = useState("");
  const [busy, setBusy] = useState(false);
  const [compiled, setCompiled] = useState<Awaited<ReturnType<typeof compileRule>> | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [starters, setStarters] = useState<Rule[]>([]);
  const [preview, setPreview] = useState<string>("");

  const reload = useCallback(() => {
    listRules().then((r) => { setRules(r.rules); setStarters(r.starters); })
      .catch(() => undefined);
  }, []);
  useEffect(reload, [reload]);

  const doCompile = async () => {
    setBusy(true); setCompiled(null);
    try {
      setCompiled(await compileRule(nl));
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!compiled?.rule) return;
    try {
      await saveRule(compiled.rule);
      toast.success("Loop is live");
      setCompiled(null); setNl(""); reload();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const toggle = async (rule: Rule, on: boolean) => {
    try {
      await patchRule(rule.rule_id, on); reload();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const test = async (rule: Rule) => {
    try {
      const r = await dryRunRule(rule.rule_id);
      setPreview(`${rule.rule_id} — would match ${r.matched_now} now\n\n${r.preview}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const checkNow = async () => {
    try {
      const r = await runDue();
      if (!r.fired.length) {
        toast.info("Nothing new to tell you");
      }
      setPreview(r.fired.map((f) => f.digest).join("\n\n") || "");
      r.fired.forEach((f) => toast.success(`Fired: ${f.rule_id}`));
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <>
      <h2 className="khata-section-title">Write a loop</h2>
      <textarea className="khata-textarea" rows={2} value={nl}
                placeholder='e.g. "every 3 hours remind me about amazon orders I still need to place"'
                onChange={(e) => setNl(e.target.value)} />
      <button className="khata-primary" disabled={!nl.trim() || busy} onClick={doCompile}>
        {busy ? "Compiling…" : "Compile — I confirm before it goes live"}
      </button>

      {compiled?.clarify && (
        <div className="khata-clarify">🤔 {compiled.clarify}</div>
      )}
      {compiled?.error && (
        <div className="khata-clarify">⚠️ {compiled.error}</div>
      )}
      {compiled?.rule && (
        <div className="khata-rule" style={{ marginTop: 12 }}>
          <div className="nl">Read-back</div>
          <div className="rb">{compiled.read_back}</div>
          {compiled.dry_run && (
            <div className="khata-preview">{compiled.dry_run.preview}</div>
          )}
          <div className="foot">
            <button className="khata-primary" style={{ width: "auto", padding: "10px 18px" }}
                    onClick={approve}>
              Approve & enable
            </button>
            <button className="khata-ghost" onClick={() => setCompiled(null)}>Discard</button>
          </div>
        </div>
      )}

      <h2 className="khata-section-title">Your loops</h2>
      <button className="khata-ghost" style={{ marginBottom: 10 }} onClick={checkNow}>
        ▶ Check all loops now
      </button>
      {rules.length === 0 && <p className="khata-empty">no loops yet — start from a starter below</p>}
      {rules.map((r) => (
        <div className="khata-rule" key={r.rule_id}>
          <div className="nl">{r.nl_source || r.rule_id}</div>
          <div className="foot">
            <button className="khata-toggle" data-on={r.enabled}
                    aria-label={r.enabled ? "Disable" : "Enable"}
                    onClick={() => toggle(r, !r.enabled)} />
            <button className="khata-ghost" onClick={() => test(r)}>Dry run</button>
          </div>
        </div>
      ))}

      {starters.length > 0 && (
        <>
          <h2 className="khata-section-title">Starters — flip one on</h2>
          {starters.map((s) => (
            <div className="khata-rule" key={s.rule_id}>
              <div className="nl">{s.nl_source}</div>
              <div className="foot">
                <button className="khata-toggle" data-on={false}
                        aria-label="Enable starter"
                        onClick={() => toggle(s, true)} />
                <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>off</span>
              </div>
            </div>
          ))}
        </>
      )}

      {preview && <div className="khata-preview">{preview}</div>}
    </>
  );
}

/* ── shared: bottom sheet + new-entry FAB ─────────────────────────────── */

function Sheet({ title, sub, children, onClose }: {
  title: string; sub?: string; children: React.ReactNode; onClose: () => void;
}) {
  return (
    <>
      <div className="khata-sheet-back" onClick={onClose} />
      <div className="khata-sheet" role="dialog" aria-label={title}>
        <h3>{title}</h3>
        {sub && <div className="sub">{sub}</div>}
        {children}
      </div>
    </>
  );
}

function NewEntryFab({ bump }: { bump: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [total, setTotal] = useState("");

  const submit = async () => {
    try {
      const res = await createDemand(name, message, total ? parseFloat(total) : 0);
      toast.success(`Order ${res.order_id} in the book`);
      setOpen(false); setName(""); setMessage(""); setTotal(""); bump();
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <>
      <button className="khata-fab" aria-label="New order" onClick={() => setOpen(true)}>＋</button>
      {open && (
        <Sheet title="New order" onClose={() => setOpen(false)}
               sub="Paste the customer's message — product links are captured automatically; their words become the line item.">
          <input className="khata-input" placeholder="Customer name" value={name}
                 onChange={(e) => setName(e.target.value)} autoFocus />
          <textarea className="khata-textarea" rows={3} value={message}
                    placeholder="What they asked for (paste the WhatsApp message, links and all)"
                    onChange={(e) => setMessage(e.target.value)} />
          <input className="khata-input khata-amount-input" inputMode="decimal"
                 placeholder="₹ price (leave blank to quote later)" value={total}
                 onChange={(e) => setTotal(e.target.value)} />
          <button className="khata-primary" disabled={!name || !message} onClick={submit}>
            Write it in the book
          </button>
        </Sheet>
      )}
    </>
  );
}
