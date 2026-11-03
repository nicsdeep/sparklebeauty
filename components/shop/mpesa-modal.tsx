"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, RotateCw, Smartphone, X, XCircle } from "lucide-react";
import { cx } from "@/components/ui";
import { kes } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { payOrder } from "@/app/(shop)/actions";

/**
 * M-Pesa "Check your phone" modal (Nicholas's design, 2026-11-03). After the STK request is sent it
 * counts down, watches the order and changes state by itself: waiting → paid, cancelled, expired
 * or failed. No page refresh.
 *
 * Payments are simulated (there's no M-Pesa/Daraja integration yet), so a separate demo strip
 * under the modal plays the customer's phone: approve or decline. The modal itself looks exactly
 * like the real flow. When Daraja is added, set DEMO_PAYMENTS to false and send the STK request
 * from placeOrder / resend; this modal's watching and states stay the same.
 */
export const DEMO_PAYMENTS = true;

const PINK = "#E6007E";
const EXPIRES_SECONDS = 5 * 60;
const RESEND_COOLDOWN = 30;

type Status = "waiting" | "paid" | "cancelled" | "expired" | "failed";

/** 0712345678 / 254712345678 → +254 712 345 678 */
export function intlPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  const n = d.startsWith("254") ? d.slice(3) : d.replace(/^0/, "");
  return `+254 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`.trim();
}

function MpesaMark() {
  return (
    <span className="mx-auto grid h-16 w-[4.5rem] place-items-center rounded-2xl bg-[#E8F7EC]" aria-label="M-Pesa">
      <span className="text-[17px] font-extrabold tracking-tight text-[#2E9E43]">M<span className="text-[#E2231A]">-</span>PESA</span>
    </span>
  );
}

function Ring({ seconds }: { seconds: number }) {
  const r = 34, c = 2 * Math.PI * r;
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0"), ss = String(seconds % 60).padStart(2, "0");
  return (
    <div className="relative mx-auto size-[84px]" role="timer" aria-label={`${mm} minutes ${ss} seconds left`}>
      <svg viewBox="0 0 80 80" className="size-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#EEEEF2" strokeWidth="4" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={PINK} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - seconds / EXPIRES_SECONDS)} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[17px] font-bold tabular-nums text-[#111827]">{mm}:{ss}</span>
    </div>
  );
}

export function MpesaModal({ orderId, phone, amount, merchant, onPaid, onClose }: {
  orderId: string; phone: string; amount: number; merchant: string;
  onPaid: (reference?: string) => void; onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>("waiting");
  const [left, setLeft] = useState(EXPIRES_SECONDS);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [message, setMessage] = useState<string | null>(null);
  const [reference, setReference] = useState<string | undefined>();
  const [demoBusy, setDemoBusy] = useState(false);
  const done = useRef(false);
  const continued = useRef(false);

  const proceed = useCallback((ref?: string) => {
    if (continued.current) return;
    continued.current = true;
    onPaid(ref);
  }, [onPaid]);

  const succeed = useCallback((ref?: string) => {
    if (done.current) return;
    done.current = true;
    setReference(ref);
    setStatus("paid");
    setTimeout(() => proceed(ref), 2200); // continue to the confirmation by itself
  }, [proceed]);

  // Countdown and resend cooldown.
  useEffect(() => {
    if (status !== "waiting") return;
    const t = setInterval(() => {
      setLeft((s) => { if (s <= 1) { setStatus("expired"); return 0; } return s - 1; });
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  // Watch the order: it turns paid when M-Pesa confirms (the real callback, or the demo strip).
  useEffect(() => {
    if (status !== "waiting") return;
    const supabase = createClient();
    let live = true;
    const check = async () => {
      const { data } = await supabase.from("orders").select("payment_status, payments(provider_reference, status)").eq("id", orderId).maybeSingle();
      if (!live || !data) return;
      if (data.payment_status === "paid") {
        const paid = (data.payments as { provider_reference: string | null; status: string }[] | null)?.find((p) => p.status === "paid");
        succeed(paid?.provider_reference ?? undefined);
      } else if (data.payment_status === "failed") {
        setStatus("failed"); setMessage("M-Pesa declined the payment.");
      }
    };
    const t = setInterval(check, 3000);
    return () => { live = false; clearInterval(t); };
  }, [status, orderId, succeed]);

  // Escape closes (the order stays waiting for payment).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && status !== "paid") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, onClose]);

  function resend() {
    // A new STK request (demo: there is none to send, so the countdown starts again).
    setStatus("waiting"); setLeft(EXPIRES_SECONDS); setCooldown(RESEND_COOLDOWN); setMessage(null);
  }

  async function demo(approve: boolean) {
    if (!approve) { setStatus("failed"); setMessage("The payment was declined on the phone."); return; }
    setDemoBusy(true);
    const res = await payOrder(orderId, phone);
    setDemoBusy(false);
    if (res.ok) succeed(res.data.reference);
    else { setStatus("failed"); setMessage(res.error); }
  }

  const number = intlPhone(phone);
  const heading = { waiting: "Check your phone", paid: "Payment successful", cancelled: "Payment cancelled", expired: "Request expired", failed: "Payment failed" }[status];
  const canResend = status !== "paid";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#111827]/45 backdrop-blur-[2px]"
      role="dialog" aria-modal="true" aria-labelledby="mpesa-title">
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-4">
      <div className="relative overflow-hidden rounded-[28px] bg-white text-center shadow-[0_24px_60px_-20px_rgba(17,24,39,0.35)]" style={{ width: "min(92vw, 520px)" }}>
        {status !== "paid" && (
          <button onClick={onClose} aria-label="Close" className="absolute right-5 top-5 z-10 rounded-full p-1.5 text-[#111827] transition hover:bg-[#F5F5F7]"><X className="size-6" /></button>
        )}
        <div className="relative z-[1] px-5 pb-12 pt-8 sm:px-10 sm:pt-9">
          {status === "paid" ? (
            <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#E8F7EC]"><CheckCircle2 className="size-9 text-[#2E9E43]" /></span>
          ) : status === "failed" || status === "cancelled" ? (
            <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#FDECEC]"><XCircle className="size-9 text-[#C2410C]" /></span>
          ) : status === "expired" ? (
            <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#F5F5F7]"><Clock className="size-8 text-[#6B7280]" /></span>
          ) : <MpesaMark />}

          <h3 id="mpesa-title" className="mt-5 text-[24px] sm:text-[26px] font-bold leading-tight text-[#111827]">{heading}</h3>

          {status === "waiting" && (
            <>
              <p className="mt-3 text-[16px] text-[#374151]">We&apos;ve sent an M-Pesa payment request to<br /><strong className="whitespace-nowrap text-[#111827]">{number}.</strong></p>
              <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[#F5F5F7] p-4 text-left sm:gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#FCE7F3]"><Smartphone className="size-6" style={{ color: PINK }} /></span>
                <span className="h-10 w-px shrink-0 bg-[#E5E7EB]" aria-hidden />
                <p className="text-[15px] leading-relaxed text-[#374151]">
                  On your phone, open M-Pesa, enter your PIN and confirm payment of <strong className="whitespace-nowrap text-[16px] text-[#111827]">{kes(amount)}</strong> to <strong style={{ color: PINK }}>{merchant}</strong>.
                </p>
              </div>
              <div className="mt-6 sm:mt-7"><Ring seconds={left} /></div>
              <p className="mt-3 text-[16px] font-medium text-[#111827]" aria-live="polite">Waiting for payment…</p>
            </>
          )}

          {status === "paid" && (
            <div aria-live="polite">
              <p className="mt-3 text-[16px] text-[#374151]"><strong className="text-[#111827]">{kes(amount)}</strong> received from {number}.</p>
              {reference && <p className="mt-1 text-[14px] text-[#6B7280]">M-Pesa reference {reference}</p>}
              <button onClick={() => proceed(reference)} className="mt-7 h-12 w-full rounded-full text-[15px] font-semibold text-white transition hover:opacity-90" style={{ background: PINK }}>Continue</button>
            </div>
          )}

          {status === "expired" && <p className="mt-3 text-[16px] text-[#374151]" aria-live="polite">The payment request to <strong className="text-[#111827]">{number}</strong> timed out. Send a new one to try again.</p>}
          {status === "cancelled" && <p className="mt-3 text-[16px] text-[#374151]" aria-live="polite">No payment was taken. Your order is saved; you can pay whenever you&apos;re ready.</p>}
          {status === "failed" && <p className="mt-3 text-[16px] text-[#374151]" aria-live="polite">{message ?? "The payment didn't go through."} No money was taken. Please try again.</p>}

          {canResend && (
            <>
              <button onClick={resend} disabled={status === "waiting" && cooldown > 0}
                className="mt-7 flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-[#F5F5F7] text-[15px] font-medium text-[#111827] transition hover:bg-[#EDEDF1] disabled:cursor-not-allowed disabled:text-[#9CA3AF]">
                <RotateCw className="size-5" />
                {status === "waiting" ? (cooldown > 0 ? `Resend Request (${cooldown}s)` : "Resend Request") : "Send New Request"}
              </button>
              {status === "waiting"
                ? <button onClick={() => setStatus("cancelled")} className="mt-4 text-[15px] font-medium text-[#111827] hover:underline">Cancel Payment</button>
                : <button onClick={onClose} className="mt-4 text-[15px] font-medium text-[#111827] hover:underline">Close</button>}
            </>
          )}
        </div>
        {/* Decoration only: a pale pink wave along the bottom edge. */}
        <svg aria-hidden viewBox="0 0 520 90" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full">
          <path d="M0 50 C 110 20, 220 80, 340 48 S 470 20, 520 36 L 520 90 L 0 90 Z" fill="#FCE7F3" opacity="0.55" />
          <path d="M0 70 C 140 45, 260 95, 380 66 S 490 50, 520 60 L 520 90 L 0 90 Z" fill="#FCE7F3" opacity="0.8" />
        </svg>
      </div>

      {DEMO_PAYMENTS && status === "waiting" && (
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-dashed border-white/40 bg-[#111827]/70 px-4 py-2.5 text-center text-[13px] text-white/85" style={{ width: "min(92vw, 520px)" }}>
          <span><span className="font-semibold text-white">Demo mode:</span> no real M-Pesa request is sent. Play the customer&apos;s phone:</span>
          <button onClick={() => demo(true)} disabled={demoBusy} className="rounded-full bg-white/15 px-3 py-1 font-semibold text-white hover:bg-white/25 disabled:opacity-50">{demoBusy ? "Approving…" : "Approve"}</button>
          <button onClick={() => demo(false)} disabled={demoBusy} className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white hover:bg-white/20 disabled:opacity-50">Decline</button>
        </div>
      )}
      </div>
    </div>
  );
}
