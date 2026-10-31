"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { whatsappHref, type StorePhone } from "@/lib/store-types";

/**
 * Floating "Chat on WhatsApp" button. With one WhatsApp contact it opens that chat; with several
 * (e.g. Support, Sales, Admin, set in Admin → Settings) the customer picks who to message.
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
  const button = "flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3 font-semibold text-white shadow-lg transition hover:bg-brand-700";
  return (
    <div ref={box} className="fixed bottom-20 right-4 z-30 md:bottom-6">
      {contacts.length === 1 ? (
        <a href={whatsappHref(contacts[0].number, message)} target="_blank" rel="noopener" className={button} aria-label="Chat with us on WhatsApp">
          <MessageCircle className="size-5" /> <span className="hidden sm:inline">Chat on WhatsApp</span>
        </a>
      ) : (
        <>
          {open && (
            <div className="absolute bottom-full right-0 mb-2 w-72 overflow-hidden rounded-2xl border border-line bg-white shadow-xl" role="dialog" aria-label="Choose who to chat with">
              <p className="border-b border-line px-4 py-3 text-sm font-semibold">Who would you like to chat with?</p>
              <ul>
                {contacts.map((c) => (
                  <li key={c.number}>
                    <a href={whatsappHref(c.number, message)} target="_blank" rel="noopener" onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-brand-50">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mint-bg text-mint-fg"><MessageCircle className="size-4" /></span>
                      <span><span className="block font-semibold">{c.label}</span><span className="text-sm text-ink-muted">{c.number}</span></span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={() => setOpen((o) => !o)} className={button} aria-expanded={open} aria-label="Chat with us on WhatsApp">
            {open ? <X className="size-5" /> : <MessageCircle className="size-5" />} <span className="hidden sm:inline">Chat on WhatsApp</span>
          </button>
        </>
      )}
    </div>
  );
}
