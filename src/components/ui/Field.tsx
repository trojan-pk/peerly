import { useId, type ComponentProps, type ReactNode } from "react";

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** Marks the field as required for assistive tech and shows a visible marker. */
  required?: boolean;
  className?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: true; required?: boolean }) => ReactNode;
}

/**
 * Label + control + hint + error wiring. The control receives id/aria props so the
 * label, hint and error are always programmatically associated.
 */
export function Field({ label, hint, error, required, className = "", children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`ui-field ${className}`.trim()}>
      <label htmlFor={id}>{label}{required && <span className="ui-required" aria-hidden="true"> *</span>}</label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, required })}
      {hint && <p id={hintId} className="ui-hint">{hint}</p>}
      {error && <p id={errorId} className="ui-error" role="alert">{error}</p>}
    </div>
  );
}

export function Input({ className = "", ...rest }: ComponentProps<"input">) {
  return <input {...rest} className={`ui-input ${className}`.trim()} />;
}

export function Textarea({ className = "", ...rest }: ComponentProps<"textarea">) {
  return <textarea {...rest} className={`ui-input ui-textarea ${className}`.trim()} />;
}

export function Select({ className = "", children, ...rest }: ComponentProps<"select">) {
  return <select {...rest} className={`ui-input ui-select ${className}`.trim()}>{children}</select>;
}
