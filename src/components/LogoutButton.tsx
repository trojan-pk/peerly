"use client";

import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { AlertTriangle, Loader2, LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

interface LogoutButtonProps {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function LogoutButton({ children, className, ariaLabel }: LogoutButtonProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  function showConfirmation() {
    setError("");
    dialog.current?.showModal();
    cancelButton.current?.focus();
    setOpen(true);
  }

  function closeConfirmation() {
    if (pending) return;
    dialog.current?.close();
    setOpen(false);
  }

  function confirmLogout() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      try {
        await logoutAction();
        dialog.current?.close();
        setOpen(false);
      } catch {
        setError("We couldn’t log you out. Please try again.");
      }
    });
  }

  function handleDialogKeys(event: KeyboardEvent<HTMLDialogElement>) {
    event.stopPropagation();
    if (event.key !== "Tab") return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    const first = buttons[0];
    const last = buttons.at(-1);
    if (!first || !last) event.preventDefault();
    else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  return (
    <>
      <button type="button" className={className} aria-label={ariaLabel} aria-haspopup="dialog" aria-controls={id} onClick={showConfirmation}>
        {children}
      </button>
      <dialog
        ref={dialog}
        id={id}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        aria-busy={pending}
        className="logout-dialog"
        onCancel={event => { event.preventDefault(); closeConfirmation(); }}
        onClose={() => setOpen(false)}
        onKeyDown={handleDialogKeys}
      >
        <div className="logout-dialog-icon"><AlertTriangle size={23} aria-hidden="true" /></div>
        <h2 id={`${id}-title`}>Log out of Peerly?</h2>
        <p id={`${id}-description`}>You’ll need to sign in again to access your workspace. Are you sure you want to log out?</p>
        {error && <p role="alert" className="logout-dialog-error">{error}</p>}
        <div className="logout-dialog-actions">
          <button ref={cancelButton} type="button" onClick={closeConfirmation} disabled={pending} className="logout-cancel">Cancel</button>
          <button type="button" onClick={confirmLogout} disabled={pending} className="logout-confirm">
            {pending ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <LogOut size={17} aria-hidden="true" />}
            {pending ? "Logging out…" : "Log out"}
          </button>
        </div>
      </dialog>
    </>
  );
}
