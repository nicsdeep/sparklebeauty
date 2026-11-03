"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Coins, Copy, CreditCard, FileText, Mail, MapPin, ReceiptText, ShoppingBag, ShoppingCart, Truck, X } from "lucide-react";
import { kes, PAYMENT_LABEL, type PaymentMethod } from "@/lib/format";

/**
 * "Thank you, Grace!" order confirmation (Nicholas's design, 2026-11-03), shown over the checkout
 * once an order is placed and paid (or set to pay on delivery).
 */
const PINK = "#E6007E";
const NAVY = "#0F1738";

/** Small pink and yellow strokes around the check, decoration only. */
function Confetti() {
  const bits: [number, number, number, string, "line" | "dot"][] = [
    [-120, -22, 0, "#F9A8D4", "dot"], [-92, 12, 20, "#FACC15", "line"], [-68, -36, 55, PINK, "line"], [-60, 44, -35, "#F472B6", "line"],
    [-100, 58, 0, "#F9A8D4", "dot"], [-40, -52, 0, "#FBCFE8", "dot"], [42, -50, 0, "#FBCFE8", "dot"], [66, -12, -55, "#FACC15", "line"],
    [92, 22, -20, PINK, "line"], [118, -28, 0, "#F9A8D4", "dot"], [104, 60, 0, "#FBCFE8", "dot"], [56, 52, 0, "#FBCFE8", "dot"],
  ];
  return (
    <svg aria-hidden viewBox="-150 -70 300 140" className="pointer-events-none absolute left-1/2 top-1/2 h-[140px] w-[300px] -translate-x-1/2 -translate-y-1/2">
      {bits.map(([x, y, r, c, kind], i) => kind === "dot"
        ? <circle key={i} cx={x} cy={y} r={4} fill={c} />
        : <rect key={i} x={x - 9} y={y - 2.5} width={18} height={5} rx={2.5} fill={c} transform={`rotate(${r} ${x} ${y})`} />)}
    </svg>
  );
}

function Row({ Icon, label, children, last }: { Icon: typeof Coins; label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-3.5 ${last ? "" : "border-b border-[#F5D5E5]"}`}>
      <span className="flex items-center gap-2.5 text-[15px] text-[#374151] sm:gap-3.5 sm:text-[16px]"><Icon className="size-6 shrink-0 text-[#4B5563]" strokeWidth={1.5} />{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export function OrderConfirmedModal({ firstName, orderNumber, total, method, reference, delivery, onClose, onDone }: {
  firstName?: string; orderNumber: string; total: number; method: PaymentMethod; reference?: string;
  /** City, or "Store pickup". */
  delivery: string;
  onClose: () => void;
  /** Clears the finished checkout before leaving the page. */
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const paid = method !== "cash";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy() {
    if (!reference) return;
    let ok = false;
    try { await navigator.clipboard.writeText(reference); ok = true; } catch {
      // Clipboard API blocked (older browsers, some in-app browsers): copy through a hidden field.
      const t = document.createElement("textarea");
      t.value = reference; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      ok = document.execCommand("copy");
      t.remove();
    }
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#111827]/40 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="order-confirmed-title">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative overflow-hidden rounded-[32px] border border-[#F8D7E8] bg-white text-center shadow-[0_24px_60px_-24px_rgba(230,0,126,0.25)]" style={{ width: "min(94vw, 600px)" }}>
          <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 grid size-11 place-items-center rounded-full bg-[#F3F4F6] text-[#111827] transition hover:bg-[#E5E7EB] sm:right-5 sm:top-5">
            <X className="size-5" strokeWidth={2.5} />
          </button>

          <div className="relative z-[1] px-5 pb-16 pt-8 sm:px-12 sm:pt-10">
            <div className="relative mx-auto size-[72px]">
              <Confetti />
              <span className="relative grid size-full place-items-center rounded-full border-[5px] border-[#22A845] bg-white shadow-[0_6px_18px_-4px_rgba(34,168,69,0.45)]">
                <Check className="size-9 text-[#22A845]" strokeWidth={3.5} />
              </span>
            </div>

            <h2 id="order-confirmed-title" className="mt-5 text-[30px] font-extrabold leading-tight tracking-tight sm:text-[38px]" style={{ color: NAVY }}>
              Thank you{firstName ? `, ${firstName}` : ""}!
            </h2>
            <p className="mt-1 text-[18px] font-medium text-[#4B5563] sm:text-[20px]">Your order is confirmed.</p>

            <div className="mx-auto mt-5 inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border border-[#F8C9DF] bg-[#FDF2F8] px-4 py-2.5 sm:gap-4 sm:px-7">
              <ShoppingBag className="size-5 shrink-0" style={{ color: PINK }} strokeWidth={1.75} />
              <span className="text-[14px] text-[#374151] sm:text-[16px]">Order Number</span>
              <span className="h-6 w-px bg-[#F3B8D3]" aria-hidden />
              <span className="text-[19px] font-bold tracking-wide sm:text-[24px]" style={{ color: PINK }}>{orderNumber}</span>
            </div>

            <div className="mt-6 rounded-3xl bg-[#FDF2F8] px-4 py-1 text-left sm:px-7">
              <Row Icon={Coins} label="Total"><strong className="text-[18px] font-bold tabular-nums" style={{ color: NAVY }}>{kes(total)}</strong></Row>
              <Row Icon={CreditCard} label="Payment">
                {paid ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DCF5E3] px-3 py-1 text-[14px] font-semibold text-[#15803D]">
                    <span className="grid size-[18px] place-items-center rounded-full bg-[#22A845]"><Check className="size-3 text-white" strokeWidth={3.5} /></span>
                    {PAYMENT_LABEL[method]} – Paid
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-[#FEF3C7] px-3 py-1 text-[14px] font-semibold text-[#92400E]">{delivery === "Store pickup" ? "Pay at the shop" : "Cash on delivery"}</span>
                )}
              </Row>
              {reference && (
                <Row Icon={ReceiptText} label="Reference">
                  <span className="inline-flex items-center gap-2">
                    <strong className="text-[16px] font-semibold tracking-wide" style={{ color: NAVY }}>{reference}</strong>
                    <button onClick={copy} aria-label="Copy payment reference" title={copied ? "Copied" : "Copy"} className="rounded-md p-1 transition hover:bg-white" style={{ color: PINK }}>
                      {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
                    </button>
                  </span>
                </Row>
              )}
              <Row Icon={MapPin} label="Delivery" last><strong className="text-[16px] font-semibold" style={{ color: NAVY }}>{delivery}</strong></Row>
            </div>
            {copied && <p className="sr-only" aria-live="polite">Reference copied</p>}

            <p className="mt-5 flex items-center justify-center gap-2.5 text-[14px] text-[#6B7280] sm:text-[15px]">
              <Mail className="size-5 shrink-0" style={{ color: PINK }} strokeWidth={1.75} />
              We&apos;ll send updates by SMS and to your account notifications.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
              <Link href={`/order/${orderNumber}#tracking`} onClick={onDone}
                className="flex h-14 items-center justify-center gap-2.5 rounded-full text-[17px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(230,0,126,0.6)] transition hover:opacity-90" style={{ background: PINK }}>
                <Truck className="size-5" /> Track Order
              </Link>
              <Link href="/shop" onClick={onDone}
                className="flex h-14 items-center justify-center gap-2.5 rounded-full border-2 bg-white text-[17px] font-semibold transition hover:bg-[#FDF2F8]" style={{ borderColor: PINK, color: PINK }}>
                <ShoppingCart className="size-5" /> Continue Shopping
              </Link>
            </div>

            <Link href={`/order/${orderNumber}`} onClick={onDone} className="mt-5 inline-flex items-center gap-2 text-[16px] font-semibold underline underline-offset-4 hover:no-underline" style={{ color: PINK }}>
              <FileText className="size-5" strokeWidth={1.75} /> View Order Details
            </Link>
          </div>

          {/* Decoration only: a pale pink wave along the bottom edge. */}
          <svg aria-hidden viewBox="0 0 600 90" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full">
            <path d="M0 52 C 130 22, 260 82, 390 50 S 540 20, 600 34 L 600 90 L 0 90 Z" fill="#FCE7F3" opacity="0.5" />
            <path d="M0 72 C 160 46, 300 96, 440 68 S 560 52, 600 62 L 600 90 L 0 90 Z" fill="#FCE7F3" opacity="0.85" />
          </svg>
        </div>
      </div>
    </div>
  );
}
