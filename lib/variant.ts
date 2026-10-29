import type { Variant } from "@/lib/catalog";

/** Display name for a variant option, e.g. 18" or 330 or 100ml. Safe to use in client components. */
export function variantLabel(v: Pick<Variant, "name" | "hair_length" | "color" | "shade" | "size">) {
  return v.name ?? v.hair_length ?? v.shade ?? v.size ?? v.color ?? "Standard";
}
