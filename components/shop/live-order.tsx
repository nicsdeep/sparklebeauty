"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useLiveTopic } from "@/lib/live";

/**
 * Re-renders the tracking page in place (no reload) the moment staff move the order on: the
 * database broadcasts on the order's private topic. If the live connection is down it checks
 * every 30 s instead, and again when the customer comes back to the tab.
 */
export function LiveOrder({ orderId }: { orderId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const status = useLiveTopic(`order:${orderId}`, () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 300);
  });

  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", tick);
    const poll = status === "live" ? null : setInterval(tick, 30_000);
    return () => { document.removeEventListener("visibilitychange", tick); if (poll) clearInterval(poll); };
  }, [router, status]);

  return null;
}
