import type { ComponentProps, ElementType, ReactNode } from "react";

type CardProps<T extends ElementType> = { as?: T; padded?: boolean; interactive?: boolean; className?: string; children?: ReactNode } & Omit<ComponentProps<T>, "as" | "className" | "children">;

/** Surface container. Renders a <div> by default; pass `as="article"`/`"section"` for semantics. */
export function Card<T extends ElementType = "div">({ as, padded = true, interactive = false, className = "", children, ...rest }: CardProps<T>) {
  const Tag = (as ?? "div") as ElementType;
  return <Tag {...rest} className={`ui-card ${padded ? "is-padded" : ""} ${interactive ? "is-interactive" : ""} ${className}`.trim()}>{children}</Tag>;
}

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "highlight";

/** Short status label. Colour is never the only signal: the text always names the state. */
export function Badge({ tone = "neutral", icon, className = "", children, ...rest }: ComponentProps<"span"> & { tone?: BadgeTone; icon?: ReactNode }) {
  return <span {...rest} className={`ui-badge is-${tone} ${className}`.trim()}>{icon}{children}</span>;
}

/** Placeholder block shown while content loads. Hidden from assistive tech; pair with an aria-busy region. */
export function Skeleton({ className = "", ...rest }: ComponentProps<"span">) {
  return <span {...rest} aria-hidden="true" className={`ui-skeleton ${className}`.trim()} />;
}

/** Honest empty state: what is missing and the next useful step. */
export function EmptyState({ icon, title, children, action, className = "" }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`ui-empty ${className}`.trim()}>
      {icon && <span className="ui-empty-icon" aria-hidden="true">{icon}</span>}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="ui-empty-action">{action}</div>}
    </div>
  );
}
