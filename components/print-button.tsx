"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

/** Prints the page; on receipt pages only the receipt prints, at till-roll width (globals.css). */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return <Button className="no-print" onClick={() => window.print()}><Printer className="size-4" /> {label}</Button>;
}
