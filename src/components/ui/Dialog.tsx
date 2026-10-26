"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** alertdialog for destructive confirmations; dialog otherwise. */
  role?: "dialog" | "alertdialog";
  /** Prevents closing (Escape, close button) while work is in progress. */
  busy?: boolean;
  /** Element focused on open; defaults to the first focusable control. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  size?: "sm" | "md" | "lg";
  hideCloseButton?: boolean;
}

/**
 * Modal built on the native <dialog> top layer: the rest of the page becomes inert,
 * Escape closes it, Tab is wrapped inside, and focus returns to the trigger on close.
 * Entry/exit uses CSS (@starting-style), which respects reduced motion.
 */
export function Dialog({ open, onClose, title, description, children, footer, role = "dialog", busy = false, initialFocusRef, size = "md", hideCloseButton = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      const target = initialFocusRef?.current
        ?? dialog.querySelector<HTMLElement>("[data-autofocus]")
        ?? dialog.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not(.ui-dialog-close)")
        ?? dialog;
      target.focus();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = previousOverflow; };
    }
    if (!open && dialog.open) {
      dialog.close();
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
    }
  }, [open, initialFocusRef]);

  // Close a dialog that unmounts while open (e.g. route change).
  useEffect(() => () => { if (ref.current?.open) ref.current.close(); }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    event.stopPropagation();
    if (event.key !== "Tab") return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')).filter((el) => el.getClientRects().length > 0);
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return (
    <dialog
      ref={ref}
      role={role}
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      aria-busy={busy || undefined}
      className={`ui-dialog is-${size}`}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onKeyDown={onKeyDown}
    >
      {open && (
        <>
          <div className="ui-dialog-header">
            <h2 id={`${id}-title`}>{title}</h2>
            {!hideCloseButton && (
              <button type="button" className="ui-dialog-close" onClick={onClose} disabled={busy} aria-label="Close dialog"><X size={18} aria-hidden="true" /></button>
            )}
          </div>
          {description && <p id={`${id}-description`} className="ui-dialog-description">{description}</p>}
          {children && <div className="ui-dialog-body">{children}</div>}
          {footer && <div className="ui-dialog-footer">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
