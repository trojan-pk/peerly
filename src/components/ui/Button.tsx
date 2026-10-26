import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

function classes(variant: ButtonVariant, size: ButtonSize, className = "") {
  return `ui-button is-${variant} is-${size} ${className}`.trim();
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, sets aria-busy and blocks repeat activation. */
  pending?: boolean;
  pendingLabel?: ReactNode;
  icon?: ReactNode;
};

/** Accessible button with consistent sizing (≥44px targets at md/lg) and a pending state. */
export function Button({ variant = "primary", size = "md", pending = false, pendingLabel, icon, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button {...rest} type={type} disabled={disabled || pending} aria-busy={pending || undefined} className={classes(variant, size, className)}>
      {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : icon}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode };

/** Navigation styled as a button. Uses a real link so it keeps link semantics. */
export function ButtonLink({ variant = "primary", size = "md", icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link {...rest} className={classes(variant, size, className)}>
      {icon}
      {children}
    </Link>
  );
}
