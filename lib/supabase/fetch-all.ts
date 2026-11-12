// Supabase (PostgREST) returns at most 1,000 rows per request. Lists that can be longer than that
// (the real catalogue has ~3,600 variants) are read in pages with a stable order, so nothing is
// silently cut off.

const PAGE = 1000;

/**
 * Every row of a query. `page(from, to)` must build a fresh query each time, with a stable order
 * (e.g. `.order("id")`), and apply `.range(from, to)`.
 */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return { data: rows, error: null };
  }
}

/** Splits a long list (e.g. variant ids sent to a function) into chunks, to keep each request small. */
export function chunks<T>(items: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
