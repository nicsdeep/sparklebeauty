/** Shown the moment a shop link is clicked, while the next page loads. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-64 rounded-xl bg-surface" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-line bg-white">
            <div className="aspect-square bg-surface" />
            <div className="space-y-2 p-3.5"><div className="h-3 w-1/3 rounded bg-surface" /><div className="h-4 w-4/5 rounded bg-surface" /><div className="h-5 w-1/2 rounded bg-surface" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
