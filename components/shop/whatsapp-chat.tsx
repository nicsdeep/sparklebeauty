"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { whatsappHref, type StorePhone } from "@/lib/store-types";

/** The WhatsApp logo (glyph from Simple Icons, CC0), shown in WhatsApp's own green. */
function WhatsAppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/**
 * Floating WhatsApp button (the logo only). With one WhatsApp contact it opens that chat; with
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
  const button = "grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg ring-4 ring-white/70 transition hover:scale-105 hover:bg-[#1ebe5b]";
  return (
    <div ref={box} className="fixed bottom-20 right-4 z-30 md:bottom-6">
      {contacts.length === 1 ? (
        <a href={whatsappHref(contacts[0].number, message)} target="_blank" rel="noopener" className={button} aria-label="Chat with us on WhatsApp" title="Chat with us on WhatsApp">
          <WhatsAppLogo className="size-8" />
        </a>
      ) : (
        <>
          {open && (
            <div className="absolute bottom-full right-0 mb-3 w-72 overflow-hidden rounded-2xl border border-line bg-white shadow-xl" role="dialog" aria-label="Choose who to chat with">
              <p className="border-b border-line px-4 py-3 text-sm font-semibold">Who would you like to chat with?</p>
              <ul>
                {contacts.map((c) => (
                  <li key={c.number}>
                    <a href={whatsappHref(c.number, message)} target="_blank" rel="noopener" onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-brand-50">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#25D366] text-white"><WhatsAppLogo className="size-5" /></span>
                      <span><span className="block font-semibold">{c.label}</span><span className="text-sm text-ink-muted">{c.number}</span></span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={() => setOpen((o) => !o)} className={button} aria-expanded={open} aria-label="Chat with us on WhatsApp" title="Chat with us on WhatsApp">
            {open ? <X className="size-7" /> : <WhatsAppLogo className="size-8" />}
          </button>
        </>
      )}
    </div>
  );
}
