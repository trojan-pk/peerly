"use client";

import Image from "next/image";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Settings, UserRound, Send, Inbox, Archive, BookOpen, LogOut } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";

export function AccountMenu({ name, image }: { name?: string | null; image?: string | null }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  const links = [
    { href: "/settings", label: "Profile & settings", Icon: UserRound },
    { href: "/dashboard?tab=outgoing", label: "Sent requests", Icon: Send },
    { href: "/dashboard?tab=incoming", label: "Received requests", Icon: Inbox },
    { href: "/dashboard?tab=outgoing&view=archived", label: "Archived requests", Icon: Archive },
    { href: "/resources/manage", label: "My resources", Icon: BookOpen },
  ];
  return <div ref={root} className="account-menu" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
    <button ref={trigger} type="button" className="account-trigger" aria-label="Open account settings" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span className="account-avatar">{image ? <Image unoptimized src={image} width={28} height={28} alt="" /> : <UserRound size={17} />}</span><span className="account-trigger-name">{name || "Your account"}</span><Settings size={18} />
    </button>
    {open && <div className="account-panel" id={id}><div className="account-panel-heading"><strong>{name || "Your account"}</strong><span>Your Peerly workspace</span></div><nav aria-label="Account settings">{links.map(({ href, label, Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)}><Icon size={17} aria-hidden="true" />{label}</Link>)}</nav><div className="account-panel-logout"><LogoutButton className="account-logout" ariaLabel="Sign out of Peerly"><LogOut size={17} />Log out</LogoutButton></div></div>}
  </div>;
}
