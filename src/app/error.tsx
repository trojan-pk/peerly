"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto my-16 max-w-lg rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
      <p className="mb-3 text-sm font-semibold text-emerald-700">Peerly</p>
      <h1 className="text-2xl font-bold tracking-tight">Something interrupted this page</h1>
      <p className="my-4 text-sm leading-relaxed text-stone-600">Your session may have expired, or the service may be temporarily unavailable. Try again in a moment.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white">Try again</button>
        <Link href="/" className="rounded-xl border border-stone-300 px-5 py-3 font-semibold">Go home</Link>
      </div>
    </div>
  );
}
