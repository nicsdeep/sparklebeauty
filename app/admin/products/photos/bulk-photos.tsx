"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";
import { PHOTO_BUCKET, shrink } from "@/components/admin/photo-manager";
import { Button, Card, cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { addProductPhotos } from "../../actions";
import type { PhotoTarget } from "./data";

type Item = {
  key: string; file: File; preview: string; code: string;
  target: PhotoTarget | null; matchedBy: "barcode" | "SKU" | "product code" | null;
  status: "ready" | "no-match" | "full" | "uploading" | "done" | "failed"; error?: string;
};
const MAX_PHOTOS = 10;

/** "2155.jpg", "2155-2.jpg", "2155 (3).JPG", "ANG-0323-01.png" → the code to match. */
function codeOf(name: string) {
  return name.replace(/\.[a-z0-9]+$/i, "").trim().replace(/\s*\(\d+\)$/, "").replace(/[-_ ](?:[2-9]|10)$/, "").trim().toLowerCase();
}

/**
 * Drop many photos at once; each is matched by its file name to a product (shelf-label code, SKU
 * or product code) and shown for checking. Only matched photos are uploaded.
 */
export function BulkPhotos({ targets }: { targets: PhotoTarget[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const [running, setRunning] = useState(false);

  const index = useMemo(() => {
    const barcode = new Map<string, PhotoTarget>(), sku = new Map<string, PhotoTarget>(), product = new Map<string, PhotoTarget>();
    for (const t of targets) {
      if (t.barcode) barcode.set(t.barcode.toLowerCase(), t);
      sku.set(t.sku.toLowerCase(), t);
      product.set(t.sku.toLowerCase().replace(/-\d{2}$/, ""), t);
    }
    return { barcode, sku, product };
  }, [targets]);

  useEffect(() => () => items.forEach((i) => URL.revokeObjectURL(i.preview)), [items]);

  function add(files: FileList | null) {
    if (!files?.length) return;
    const next = [...files].filter((f) => f.type.startsWith("image/")).map((file): Item => {
      const code = codeOf(file.name);
      const hit = index.barcode.get(code) ? ["barcode", index.barcode.get(code)] as const
        : index.sku.get(code) ? ["SKU", index.sku.get(code)] as const
        : index.product.get(code) ? ["product code", index.product.get(code)] as const : [null, null] as const;
      return { key: `${file.name}-${file.size}-${file.lastModified}`, file, preview: URL.createObjectURL(file), code,
        target: hit[1] ?? null, matchedBy: hit[0], status: hit[1] ? "ready" : "no-match" };
    });
    setItems((cur) => {
      const all = [...cur.filter((c) => !next.some((n) => n.key === c.key)), ...next];
      // A product keeps at most 10 photos: count what it has plus what is queued for it.
      const queued = new Map<string, number>();
      return all.map((i) => {
        if (!i.target || i.status === "done") return i;
        const n = (queued.get(i.target.productId) ?? 0) + 1;
        queued.set(i.target.productId, n);
        return { ...i, status: i.target.photos + n > MAX_PHOTOS ? "full" : i.status === "full" ? "ready" : i.status };
      });
    });
    if (input.current) input.current.value = "";
  }

  async function upload() {
    setRunning(true);
    const supabase = createClient();
    const set = (key: string, patch: Partial<Item>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...patch } : i)));
    const ready = items.filter((i) => i.status === "ready" || i.status === "failed");
    // Upload a few at a time; add each product's photos in one save.
    const byProduct = new Map<string, Item[]>();
    for (const i of ready) byProduct.set(i.target!.productId, [...(byProduct.get(i.target!.productId) ?? []), i]);
    const queue = [...byProduct.entries()];
    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const [productId, photos] = job;
        const urls: string[] = [];
        for (const p of photos) {
          set(p.key, { status: "uploading", error: undefined });
          try {
            const blob = await shrink(p.file);
            const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
            const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
            if (error) throw error;
            urls.push(supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl);
          } catch (e) {
            set(p.key, { status: "failed", error: (e as Error).message || "Upload failed" });
          }
        }
        if (!urls.length) continue;
        const res = await addProductPhotos(productId, urls);
        for (const p of photos) {
          if (res.ok) setItems((cur) => cur.map((i) => (i.key === p.key && i.status === "uploading" ? { ...i, status: "done" } : i)));
          else set(p.key, { status: "failed", error: res.error });
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setRunning(false);
    router.refresh();
  }

  const count = (s: Item["status"]) => items.filter((i) => i.status === s).length;
  const ready = count("ready") + count("failed");
  const BADGE: Record<Item["status"], [string, string]> = {
    ready: ["Ready", "bg-mint-bg text-mint-fg"], "no-match": ["No product with this code", "bg-rose-bg text-rose-fg"],
    full: ["Product already has 10 photos", "bg-amber-bg text-amber-fg"], uploading: ["Uploading…", "bg-info-bg text-info-fg"],
    done: ["Added", "bg-mint-bg text-mint-fg"], failed: ["Failed: try again", "bg-rose-bg text-rose-fg"],
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => input.current?.click()} disabled={running}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        className={cx("flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
          over ? "border-brand-500 bg-brand-50" : "border-line bg-white hover:border-brand-200")}>
        <ImagePlus className="size-8 text-brand-600" aria-hidden />
        <span className="font-semibold">Drop product photos here, or click to choose</span>
        <span className="text-sm text-ink-muted">Many at once · JPG, PNG or WebP · named by the shelf-label code</span>
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => add(e.target.files)} />

      {items.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <p className="text-[15px]">
              <strong>{items.length}</strong> photo{items.length === 1 ? "" : "s"} · <span className="text-mint-fg">{count("ready") + count("done")} matched</span>
              {count("no-match") > 0 && <> · <span className="text-rose-fg">{count("no-match")} not matched</span></>}
              {count("done") > 0 && <> · {count("done")} added</>}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={running} onClick={() => setItems((cur) => cur.filter((i) => i.status !== "done" && i.status !== "no-match"))}>Clear finished</Button>
              <Button disabled={running || ready === 0} onClick={upload}>
                {running ? <><Loader2 className="size-4 animate-spin" /> Uploading…</> : `Upload ${ready} photo${ready === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
          <ul className="divide-y divide-line">
            {items.map((i) => (
              <li key={i.key} className="flex items-center gap-4 px-5 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.preview} alt="" className="size-14 shrink-0 rounded-lg border border-line object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm">{i.file.name}</p>
                  {i.target
                    ? <p className="truncate text-[15px] font-semibold">{i.target.productName}{i.target.variant ? <span className="font-normal text-ink-muted"> · {i.target.variant}</span> : null}
                        <span className="ml-2 text-xs font-normal text-ink-muted">matched by {i.matchedBy} · {i.target.photos} photo{i.target.photos === 1 ? "" : "s"} now</span></p>
                    : <p className="text-sm text-ink-muted">Rename the file to the product&apos;s shelf-label code, SKU or product code.</p>}
                  {i.error && <p className="text-xs text-rose-fg">{i.error}</p>}
                </div>
                <span className={cx("flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", BADGE[i.status][1])}>
                  {i.status === "done" ? <CheckCircle2 className="size-3.5" /> : i.status === "no-match" || i.status === "failed" ? <AlertTriangle className="size-3.5" /> : null}
                  {BADGE[i.status][0]}
                </span>
                {!running && i.status !== "done" && (
                  <button type="button" onClick={() => setItems((cur) => cur.filter((x) => x.key !== i.key))} aria-label={`Remove ${i.file.name}`}
                    className="rounded-full p-1.5 text-ink-muted hover:bg-surface"><X className="size-4" /></button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
