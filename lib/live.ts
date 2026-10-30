"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Live updates from the database (Supabase Realtime broadcasts sent by triggers):
 *  - "catalog" (public): `stock` {variant_id, available} and `catalog` (a product/price changed).
 *  - "admin" (private, staff only by RLS on realtime.messages): `change` {table} for orders,
 *    payments and customers.
 * The database stays the source of truth: listeners re-read from it, they never patch copies.
 * Each topic is joined once per browser tab and shared by every listener (joining the same
 * topic twice on one connection makes Realtime drop one of them).
 */
export type LiveStatus = "connecting" | "live" | "offline";
type Topic = "catalog" | "admin";
type Handler = (event: string, payload: Record<string, unknown>) => void;

const topics = new Map<Topic, { handlers: Set<Handler>; statuses: Set<(s: LiveStatus) => void>; status: LiveStatus; close: () => void }>();

function join(topic: Topic) {
  const existing = topics.get(topic);
  if (existing) return existing;
  const supabase = createClient();
  const entry = { handlers: new Set<Handler>(), statuses: new Set<(s: LiveStatus) => void>(), status: "connecting" as LiveStatus, close: () => {} };
  const setStatus = (s: LiveStatus) => { entry.status = s; entry.statuses.forEach((f) => f(s)); };
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let closed = false;
  (async () => {
    if (topic === "admin") await supabase.realtime.setAuth(); // private topic: send the staff session
    if (closed) return;
    channel = supabase
      .channel(topic, { config: { private: topic === "admin" } })
      .on("broadcast", { event: "*" }, (msg) => entry.handlers.forEach((h) => h(msg.event, (msg.payload ?? {}) as Record<string, unknown>)))
      .subscribe((s) => setStatus(s === "SUBSCRIBED" ? "live" : s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED" ? "offline" : "connecting"));
  })();
  entry.close = () => { closed = true; if (channel) supabase.removeChannel(channel); topics.delete(topic); };
  topics.set(topic, entry);
  return entry;
}

export function useLiveTopic(topic: Topic, onEvent: Handler) {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const [status, setStatus] = useState<LiveStatus>("connecting");

  useEffect(() => {
    const entry = join(topic);
    const h: Handler = (e, p) => handler.current(e, p);
    entry.handlers.add(h);
    entry.statuses.add(setStatus);
    setStatus(entry.status);
    return () => {
      entry.handlers.delete(h);
      entry.statuses.delete(setStatus);
      if (!entry.handlers.size) entry.close();
    };
  }, [topic]);

  return status;
}
