"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { whatsappHref, type StorePhone } from "@/lib/store-types";
import { WhatsAppLogo } from "@/components/shop/social-icons";

/** Four-point sparkle, as in the Sparkle brand. */
function Sparkle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden>
      <path d="M12 0c.6 5.4 3.6 8.4 9 9-5.4.6-8.4 3.6-9 9-.6-5.4-3.6-8.4-9-9 5.4-.6 8.4-3.6 9-9z" transform="translate(0 3)" />
    </svg>
  );
}

/**
 * Floating WhatsApp button: the WhatsApp logo on a light Sparkle pink-to-blue, with twinkling sparkles. With one WhatsApp contact it opens that chat; with
 * several (e.g. Support, Sales, Admin, set in Admin → Settings) the customer picks who to message.
 */
export function WhatsAppChat({ contacts, storeName }: { contacts: StorePhone[]; storeName: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  if (!contacts.length) return null;

  const message = `Hi ${storeName}, I'd like help with…`;
  const button = "sparkle-glow relative grid size-14 place-items-center rounded-full bg-gradient-to-br from-[#f074b2] via-[#ea5ea3] to-[#5ac7f7] text-white ring-4 ring-white/80 transition hover:scale-105";
  // Small sparkles around the button, twinkling one after another.
  const sparkles = (
    <>
      <Sparkle className="sparkle-twinkle absolute -left-1.5 -top-1 size-4 text-[#f074b2]" />
      <Sparkle className="sparkle-twinkle absolute -right-2 top-1 size-3 text-[#5ac7f7]" style={{ animationDelay: "0.8s" }} />
      <Sparkle className="sparkle-twinkle absolute -bottom-1 -left-2 size-3 text-[#ea5ea3]" style={{ animationDelay: "1.6s" }} />
    </>
  );
  return (
    <div ref={box} className="fixed bottom-20 right-4 z-30 md:bottom-6">
      {contacts.length === 1 ? (
        <a href={whatsappHref(contacts[0].number, message)} target="_blank" rel="noopener" className={button} aria-label="Chat with us on WhatsApp" title="Chat with us on WhatsApp">
          <WhatsAppLogo className="size-8" />{sparkles}
        </a>
      ) : (
        <>
          {open && (
            <div className="absolute bottom-full right-0 mb-3 w-72 overflow-hidden rounded-2xl border border-line bg-white shadow-xl" role="dialog" aria-label="Choose who to chat with">
              <p className="flex items-center gap-2 bg-gradient-to-r from-[#ea5ea3] to-[#5ac7f7] px-4 py-3 text-sm font-semibold text-white"><Sparkle className="size-4" /> Who would you like to chat with?</p>
              <ul>
                {contacts.map((c) => (
                  <li key={c.number}>
                    <a href={whatsappHref(c.number, message)} target="_blank" rel="noopener" onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-brand-50">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#f074b2] to-[#5ac7f7] text-white"><WhatsAppLogo className="size-5" /></span>
                      <span><span className="block font-semibold">{c.label}</span><span className="text-sm text-ink-muted">{c.number}</span></span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={() => setOpen((o) => !o)} className={button} aria-expanded={open} aria-label="Chat with us on WhatsApp" title="Chat with us on WhatsApp">
            {open ? <X className="size-7" /> : <WhatsAppLogo className="size-8" />}{sparkles}
          </button>
        </>
      )}
    </div>
  );
}
