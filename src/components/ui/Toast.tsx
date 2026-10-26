"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info";
interface ToastItem { id: number; tone: ToastTone; title: string; description?: string }
interface ToastApi { show: (toast: Omit<ToastItem, "id">) => void; dismiss: (id: number) => void }

const ToastContext = createContext<ToastApi | null>(null);
const DURATION_MS = 5000;
const MAX_VISIBLE = 3;

/**
 * Toasts announce results of user actions without moving focus.
 * - Success/info go to a polite live region; errors to an assertive one.
 * - Live regions exist before any toast so screen readers reliably announce changes.
 * - Auto-dismiss pauses while hovered or focused (WCAG 2.2.1); errors stay until dismissed.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const show = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = nextId.current++;
    setToasts((all) => [...all, { ...toast, id }].slice(-MAX_VISIBLE));
  }, []);
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  const polite = toasts.filter((t) => t.tone !== "error");
  const assertive = toasts.filter((t) => t.tone === "error");

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ui-toast-viewport">
        <ol role="status" aria-live="polite" aria-label="Notifications" className="ui-toast-list">
          <AnimatePresence initial={false}>{polite.map((t) => <ToastCard key={t.id} toast={t} onDismiss={dismiss} />)}</AnimatePresence>
        </ol>
        <ol role="alert" aria-live="assertive" aria-label="Errors" className="ui-toast-list">
          <AnimatePresence initial={false}>{assertive.map((t) => <ToastCard key={t.id} toast={t} onDismiss={dismiss} />)}</AnimatePresence>
        </ol>
      </div>
    </ToastContext.Provider>
  );
}

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info } as const;

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || toast.tone === "error") return;
    const timer = window.setTimeout(() => onDismiss(toast.id), DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [paused, toast, onDismiss]);
  const Icon = ICONS[toast.tone];
  return (
    <m.li
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
      className={`ui-toast is-${toast.tone}`}
      data-toast-tone={toast.tone}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon size={18} aria-hidden="true" className="ui-toast-icon" />
      <div className="ui-toast-copy">
        <strong>{toast.title}</strong>
        {toast.description && <span>{toast.description}</span>}
      </div>
      <button type="button" onClick={() => onDismiss(toast.id)} aria-label={`Dismiss: ${toast.title}`} className="ui-toast-dismiss"><X size={15} aria-hidden="true" /></button>
    </m.li>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>.");
  return api;
}
