"use client";

import { useRef, useState, useTransition } from "react";
import { Download, Trash2 } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { Dialog } from "@/components/ui/Dialog";
import { deleteMyAccountAction } from "@/app/actions/account";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

/** Data export and permanent account deletion (typed confirmation). */
export function DangerZone() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();

  function confirm() {
    setError(undefined);
    startTransition(async () => {
      let result: { success: boolean; message?: string };
      try { result = await deleteMyAccountAction(typed); } catch { result = { success: false, message: "We couldn't reach the server. Nothing was removed." }; }
      if (result.success) { toast.show({ tone: "success", title: "Your account has been deleted." }); router.replace("/"); router.refresh(); }
      else setError(result.message);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted max-w-xl">Download a JSON copy of your profile, requests, resources, votes, notifications and reports.</p>
        <a className="ui-button is-secondary is-md" href="/api/account/export" download><Download size={16} aria-hidden="true" />Download my data</a>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="text-sm text-muted max-w-xl">Delete your account permanently. Your profile and resources are removed; people you studied with keep their history, shown with “Deleted user”.</p>
        <Button variant="danger" onClick={() => { setTyped(""); setError(undefined); setOpen(true); }} icon={<Trash2 size={16} aria-hidden="true" />}>Delete account</Button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        role="alertdialog"
        busy={pending}
        size="sm"
        initialFocusRef={inputRef}
        title="Delete your Peerly account?"
        description="This can't be undone. Your profile, resources, votes, notifications and pending requests are removed. Problem descriptions and review comments you wrote are erased; star ratings stay so helpers' averages don't change."
        footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button><Button variant="danger" onClick={confirm} pending={pending} pendingLabel="Deleting…" disabled={typed !== "DELETE"}>Delete permanently</Button></>}
      >
        <Field label="Type DELETE to confirm" error={error}>{(p) => <Input {...p} ref={inputRef} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />}</Field>
      </Dialog>
    </div>
  );
}
