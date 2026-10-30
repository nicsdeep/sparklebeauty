"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return <Button variant="secondary" className="no-print" onClick={() => window.print()}><Printer className="size-4" /> {label}</Button>;
}
