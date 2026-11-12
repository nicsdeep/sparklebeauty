import { Download } from "lucide-react";
import { BackLink } from "@/components/admin/back-link";
import { Card } from "@/components/ui";
import { BulkPhotos } from "./bulk-photos";
import { loadPhotoTargets } from "./data";

export const metadata = { title: "Add Product Photos" };

/**
 * Bulk product photos: staff photograph products and name each file by the code on its shelf
 * label (the old POS code, now the barcode) or by its SKU or product code. Every file is matched to
 * its product before anything is uploaded, so a photo never lands on the wrong product.
 */
export default async function ProductPhotosPage() {
  const targets = await loadPhotoTargets();
  const products = new Map(targets.map((t) => [t.productId, t.photos]));
  const withPhotos = [...products.values()].filter((n) => n > 0).length;
  return (
    <div className="space-y-6">
      <div>
        <BackLink fallback="/admin/products" label="Products" />
        <h1 className="mt-3 text-2xl font-bold">Add Product Photos</h1>
        <p className="mt-1 text-ink-muted">{withPhotos} of {products.size} products have a photo. Products without one show their category&apos;s picture in the shop.</p>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold">How it works</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[15px] text-ink-muted">
          <li>Photograph each product on a plain, light background (square photos look best).</li>
          <li>Name each photo by the code on its shelf label, e.g. <code className="rounded bg-surface px-1">2155.jpg</code>. The SKU (<code className="rounded bg-surface px-1">ANG-0323-01</code>) or product code (<code className="rounded bg-surface px-1">ANG-0323</code>) also works. For more photos of the same product add <code className="rounded bg-surface px-1">-2</code>, <code className="rounded bg-surface px-1">-3</code>…</li>
          <li>Drop all the photos below. Check the matches, then press Upload.</li>
        </ol>
        <a href="/admin/products/photos/missing" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
          <Download className="size-4" /> Download the list of products without photos (with their codes)
        </a>
      </Card>

      <BulkPhotos targets={targets} />
    </div>
  );
}
