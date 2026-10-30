"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useLiveTopic } from "@/lib/live";

/**
 * Re-renders the current page in place (no browser reload, typed input is kept) when the
 * database reports a change: stock and products for the shop, plus orders and customers for
 * staff. Bursts of changes (e.g. a sale touching several products) cause one refresh.
 */
export function LiveRefresh({ staff = false }: { staff?: boolean }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 400);
  };
  useLiveTopic("catalog", refresh);
  return staff ? <StaffRefresh onChange={refresh} /> : null;
}

function StaffRefresh({ onChange }: { onChange: () => void }) {
  useLiveTopic("admin", onChange);
  return null;
}
