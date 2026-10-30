// Demo photography from Unsplash (free licence: https://unsplash.com/license), plus Sparkle's
// own photos under /public.
// Product photos live in products.image_urls; these are the category tiles and the
// fallback used when a product has no photo yet.

const U = "https://images.unsplash.com/photo-";

export const CATEGORY_IMAGES: Record<string, string> = {
  hair: `${U}1645736279976-59f8fd22720c`,
  wigs: `${U}1645736279976-59f8fd22720c`,
  "hair-pieces": `${U}1707162740897-cf2f057d2a41`,
  braids: `${U}1606416132922-22ab37c1231e`,
  // Brand poster Sparkle posted on Facebook (public/products/kids/).
  "kids-braids": "/products/kids/little-angels-poster.jpg",
  extensions: `${U}1560869713-bf165a9cfac1`,
  "hair-care": `${U}1643123158858-eac2aabaa1ec`,
  cosmetics: `${U}1657563920440-0ac6d8932f20`,
  skincare: `${U}1586212653598-40f9046fe5e3`,
  perfumes: `${U}1676347929093-6614fb45bd90`,
  accessories: `${U}1776969824686-f3ccd3f53649`,
};

/** Unsplash CDN URL at a given width (it crops and compresses on the fly). */
export function sized(url: string, width: number, height?: number) {
  if (!url.startsWith("https://images.unsplash.com/")) return url;
  const h = height ? `&h=${height}` : "";
  return `${url}?auto=format&fit=crop&w=${width}${h}&q=75`;
}

export function productImageUrl(image: string | null | undefined, category: string) {
  return image ?? CATEGORY_IMAGES[category] ?? null;
}
