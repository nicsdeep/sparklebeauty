"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { StoreSettings } from "@/lib/store-types";

const StoreContext = createContext<StoreSettings | null>(null);

/** Makes the shop settings (read on the server) available to client components. */
export function StoreProvider({ settings, children }: { settings: StoreSettings; children: ReactNode }) {
  return <StoreContext.Provider value={settings}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
