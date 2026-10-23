import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto my-16 max-w-lg rounded-2xl border border-line bg-surface p-8 text-center">
      <p className="text-sm font-semibold text-accent">404 · Peerly</p>
      <h1 className="mt-3 text-2xl font-bold">We couldn&apos;t find that page</h1>
      <p className="my-4 text-sm text-muted">The link may have changed, or this profile is no longer available.</p>
      <Link href="/peers" className="inline-flex rounded-xl bg-action-hover px-5 py-3 font-semibold text-white">Discover peers</Link>
    </div>
  );
}
