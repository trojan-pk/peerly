"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto my-16 max-w-lg rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
      <p className="mb-3 text-sm font-semibold text-accent">Peerly</p>
      <h1 className="page-title">Something interrupted this page</h1>
      <p className="my-4 text-sm leading-relaxed text-muted">Your session may have expired, or the service may be temporarily unavailable. Try again in a moment.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="rounded-xl bg-action-hover px-5 py-3 font-semibold text-white">Try again</button>
        <Link href="/" className="rounded-xl border border-edge px-5 py-3 font-semibold">Go home</Link>
      </div>
    </div>
  );
}
