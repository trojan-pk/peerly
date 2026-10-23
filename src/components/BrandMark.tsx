export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className={className}>
      <path d="M9 33V9h12a8 8 0 0 1 0 16H9" stroke="currentColor" strokeWidth="5" />
      <path d="M19 9v8h10" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
