// Page number and size for admin lists (?page=, ?size=), read by server pages.

/** Page number and size from the URL (size 10, 20 or 50; default 20). */
export function pageParams(sp: Record<string, string | string[] | undefined>) {
  const size = [10, 20, 50].includes(Number(sp.size)) ? Number(sp.size) : 20;
  const page = Math.max(1, Math.floor(Number(sp.page) || 1));
  return { page, size, from: (page - 1) * size, to: page * size - 1 };
}
