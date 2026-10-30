"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { Button, cx, inputClass } from "@/components/ui";
import { submitReview } from "@/app/(shop)/actions";

/** Star rating and comment; submit_review() checks the customer bought the product. */
export function ReviewForm({ productId, slug }: { productId: string; slug: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) return <p className="rounded-xl bg-mint-bg px-4 py-3 text-mint-fg" role="status">Thank you! Your review is published.</p>;

  return (
    <form
      className="space-y-3 rounded-2xl bg-surface p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return setError("Choose a star rating.");
        setError(null);
        startTransition(async () => {
          const res = await submitReview(productId, slug, rating, body);
          if (res.ok) setDone(true);
          else setError(res.error);
        });
      }}
    >
      <p className="font-semibold">Write a review</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} className="p-0.5">
            <Star className={cx("size-7", n <= (hover || rating) ? "fill-amber-400 text-amber-400" : "text-line")} aria-hidden />
          </button>
        ))}
      </div>
      <label className="block">
        <span className="sr-only">Your review</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={1000} required minLength={3}
          placeholder="How did you find it?" className={cx(inputClass, "h-auto py-3")} />
      </label>
      {error && <p className="text-sm text-rose-fg" role="alert">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Posting…" : "Post review"}</Button>
    </form>
  );
}
