"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { BadgeCheck, Gift, Heart, MapPin, Package, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { cx } from "@/components/ui";
import type { AnnouncementIcon } from "@/lib/announcement-types";

export type BarMessage = { id: string; text: string; mobileText: string; icon: AnnouncementIcon; href: string | null };

const ICONS = { truck: Truck, "badge-check": BadgeCheck, sparkles: Sparkles, "map-pin": MapPin, package: Package, shield: ShieldCheck, gift: Gift, heart: Heart };
const EVERY_MS = 4500;
const FADE_MS = 450;

/** "Free delivery over *KES 10,000*" → the starred phrase as a soft white pill. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("*").map((part, i) =>
        i % 2 ? <span key={i} className="mx-0.5 rounded-full bg-white/95 px-2 py-px font-bold text-brand-700">{part}</span> : <Fragment key={i}>{part}</Fragment>)}
    </>
  );
}

/**
 * Slim storefront announcement bar: one short message at a time, changing every 4.5 s with a soft
 * fade and a slight upward slide. It pauses while hovered or focused and when the tab is hidden.
 * With reduced motion the message changes without any movement or fade.
 */
export function AnnouncementBar({ messages }: { messages: BarMessage[] }) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (messages.length < 2 || paused) return;
    let fade: ReturnType<typeof setTimeout>;
    const tick = setInterval(() => {
      if (document.hidden) return;
      if (still) { setIndex((i) => (i + 1) % messages.length); return; }
      setLeaving(true);
      fade = setTimeout(() => { setIndex((i) => (i + 1) % messages.length); setLeaving(false); }, FADE_MS);
    }, EVERY_MS);
    return () => { clearInterval(tick); clearTimeout(fade); };
  }, [messages.length, paused, still]);

  if (!messages.length) return null;
  const m = messages[index % messages.length];
  const Icon = ICONS[m.icon];
  const body = (
    <>
      <Icon className="size-4 shrink-0 opacity-95" aria-hidden />
      <span className="hidden h-3.5 w-px shrink-0 bg-white/40 sm:block" aria-hidden />
      <span className="truncate sm:hidden"><Rich text={m.mobileText} /></span>
      <span className="hidden truncate sm:inline"><Rich text={m.text} /></span>
    </>
  );

  return (
    <section aria-label="Announcements" aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      className="relative overflow-hidden bg-brand-600 text-white">
      {/* Soft sheen, as in the brand banners */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_180%_at_0%_0%,rgba(255,255,255,0.18),transparent_45%),radial-gradient(120%_180%_at_100%_100%,rgba(255,255,255,0.12),transparent_45%)]" />
      <div className="relative mx-auto flex h-9 max-w-7xl items-center justify-center px-4 sm:h-10">
        <div key={m.id} aria-live="off"
          className={cx("flex min-w-0 items-center gap-2.5 text-[13px] font-medium sm:text-sm",
            !still && "transition-[opacity,transform] ease-out motion-reduce:transition-none",
            !still && (leaving ? "-translate-y-1.5 opacity-0" : "announce-in translate-y-0 opacity-100"))}
          style={{ transitionDuration: `${FADE_MS}ms` }}>
          {m.href ? <Link href={m.href} className="flex min-w-0 items-center gap-2.5 underline-offset-4 hover:underline">{body}</Link> : body}
        </div>
        {messages.length > 1 && (
          <div className="absolute right-4 hidden items-center gap-1.5 md:flex" role="group" aria-label="Choose announcement">
            {messages.map((x, i) => (
              <button key={x.id} type="button" onClick={() => { setLeaving(false); setIndex(i); }} aria-label={`Announcement ${i + 1} of ${messages.length}`}
                aria-current={i === index % messages.length ? "true" : undefined}
                className={cx("size-1.5 rounded-full transition-colors", i === index % messages.length ? "bg-white" : "bg-white/45 hover:bg-white/70")} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
