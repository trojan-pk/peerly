import { OPEN_PAGE_PATHS, PEERLY_WORDMARK_PATHS } from "@/lib/brand";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="currentColor" aria-hidden="true" className={className}>
      {OPEN_PAGE_PATHS.map(d => <path key={d} d={d} />)}
    </svg>
  );
}

export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 672 220" fill="currentColor" fillRule="evenodd" aria-hidden="true" className={className}>
      {PEERLY_WORDMARK_PATHS.map(d => <path key={d} d={d} />)}
    </svg>
  );
}
