import { BadgeCheck } from "lucide-react";

/**
 * Shown only after the person confirmed a code sent to an address on this
 * university's email domain. It proves control of that address, not enrolment.
 */
export function VerifiedBadge({ university, className = "" }: { university: string; className?: string }) {
  return (
    <span className={`verified-badge ${className}`.trim()} title={`Confirmed an email address on ${university}'s domain. This doesn't prove current enrolment.`}>
      <BadgeCheck size={14} aria-hidden="true" />
      University email verified
      <span className="sr-only"> for {university}</span>
    </span>
  );
}
