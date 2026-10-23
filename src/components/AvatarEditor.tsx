"use client";

import Image from "next/image";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateAvatar } from "@/app/profile/avatar-actions";

export function AvatarEditor({ image, name }: { image: string; name: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const router = useRouter();
  function save(file?: File) {
    setFeedback(null);
    if (file && file.size > 2 * 1024 * 1024) { setFeedback({ success: false, message: "Choose a photo up to 2 MB." }); return; }
    const data = new FormData();
    if (file) data.set("photo", file); else data.set("action", "remove");
    startTransition(async () => {
      try {
        const result = await updateAvatar(data); setFeedback(result);
        if (result.success) router.refresh();
      } catch { setFeedback({ success: false, message: "Photo upload failed. Please try again." }); }
      if (input.current) input.current.value = "";
    });
  }
  return <div className="avatar-editor">
    <div className="settings-avatar">{image ? <Image unoptimized src={image} width={80} height={80} alt={`${name} profile photo`} /> : <UserRound size={30} aria-hidden="true" />}</div>
    <div><div className="avatar-actions"><button type="button" onClick={() => input.current?.click()} disabled={pending} className="workspace-secondary-button">{pending ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} Change photo</button>{image && <button type="button" onClick={() => save()} disabled={pending} className="workspace-text-button">Remove photo</button>}</div><p className="workspace-caption">JPG, PNG or WebP · up to 2 MB. Photos are cropped to a square.</p><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload profile photo" tabIndex={-1} className="sr-only" disabled={pending} onChange={event => { const file = event.target.files?.[0]; if (file) save(file); }} />{feedback && <p role={feedback.success ? "status" : "alert"} className={feedback.success ? "text-accent text-sm mt-2" : "text-danger text-sm mt-2"}>{feedback.message}</p>}</div>
  </div>;
}
