/** Shown the moment an admin link is clicked, while the next page loads. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-56 rounded-xl bg-white" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-28 rounded-2xl border border-line bg-white" />)}
      </div>
      <div className="h-96 rounded-2xl border border-line bg-white" />
    </div>
  );
}
