"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, MailCheck } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { confirmVerificationCodeAction, removeUniversityEmailAction, sendVerificationCodeAction } from "@/app/actions/courses";
import type { VerificationStatus } from "@/lib/courses";

/** Verify control of a university email address with a one-time code. */
export function UniversityEmailSection({ status }: { status: VerificationStatus }) {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState(status.pending?.email ?? "");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(status.pending?.email ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  if (status.verified) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-ink font-semibold"><BadgeCheck size={18} className="text-success" aria-hidden="true" />University email verified — {status.verified.universityName}</p>
        <p className="text-sm text-muted">Verified address (private): <span className="text-body">{status.verified.email}</span>. Your profile shows the badge and university name, never the address.</p>
        <Button variant="danger" size="sm" pending={pending} onClick={() => startTransition(async () => {
          const result = await removeUniversityEmailAction();
          toast.show({ tone: result.success ? "success" : "error", title: result.message ?? "Done." });
          router.refresh();
        })}>Remove verification</Button>
      </div>
    );
  }

  if (!status.available) {
    return <p className="text-sm text-muted">Verification codes are sent by email, which isn’t set up on this Peerly server yet. Once an administrator configures email, you can verify here.</p>;
  }

  function send() {
    setErrors({});
    startTransition(async () => {
      const result = await sendVerificationCodeAction(email);
      if (result.success) { setSentTo(result.data?.email ?? email); toast.show({ tone: "success", title: result.message ?? "Code sent." }); }
      else setErrors(result.errors ?? { email: result.message ?? "Couldn't send the code." });
    });
  }

  function confirm() {
    setErrors({});
    startTransition(async () => {
      const result = await confirmVerificationCodeAction(code);
      if (result.success) { toast.show({ tone: "success", title: result.message ?? "Verified." }); router.refresh(); }
      else setErrors(result.errors ?? { code: result.message ?? "That code didn't work." });
    });
  }

  return (
    <div className="space-y-4">
      <div className="inline-form">
        <Field label="University email" hint="Must be on a domain your university uses, e.g. you@nu.edu.pk." error={errors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />}
        </Field>
        <Button variant="secondary" onClick={send} disabled={pending || !email.trim()} icon={<MailCheck size={16} aria-hidden="true" />}>{sentTo ? "Send a new code" : "Send code"}</Button>
      </div>
      {sentTo && (
        <div className="inline-form">
          <Field label={`6-digit code sent to ${sentTo}`} hint="Expires 10 minutes after sending. 5 attempts." error={errors.code}>
            {(p) => <Input {...p} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="tabular" />}
          </Field>
          <Button onClick={confirm} disabled={pending || code.length !== 6}>Verify</Button>
        </div>
      )}
      <p className="text-xs text-muted">The badge says “University email verified”. It shows you control an address on that domain; it doesn’t prove you’re currently enrolled.</p>
    </div>
  );
}
