/**
 * Runs non-critical work after the response is sent.
 *
 * Inside a Next.js request this uses `after()` so emails never slow down an action.
 * Outside a request scope (unit tests, scripts) the task starts immediately and is
 * tracked so tests can await it. Errors are logged, never thrown to the caller.
 */
import { after } from "next/server";

const pending = new Set<Promise<void>>();

export function runAfterResponse(task: () => Promise<void>): void {
  const safe = async () => {
    try {
      await task();
    } catch (error) {
      console.error("[background] Task failed:", error instanceof Error ? error.message : "unknown error");
    }
  };
  try {
    after(safe);
  } catch {
    const promise = safe().finally(() => pending.delete(promise));
    pending.add(promise);
  }
}

/** Test helper: waits for tasks started outside a request scope. */
export async function flushBackgroundTasks(): Promise<void> {
  while (pending.size > 0) await Promise.all([...pending]);
}
