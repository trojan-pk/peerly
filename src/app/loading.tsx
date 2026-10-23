export default function Loading() {
  return (
    <div role="status" className="mx-auto max-w-4xl space-y-5 py-12">
      <p className="text-sm font-medium text-stone-600">Loading your workspace…</p>
      {[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl border border-stone-200 bg-white" aria-hidden="true" />)}
    </div>
  );
}
