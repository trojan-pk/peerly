"use client";

import Link from "next/link";
import { BookOpen, LayoutDashboard, Settings, Users } from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Requests", Icon: LayoutDashboard },
  { href: "/peers", label: "Peers", Icon: Users },
  { href: "/resources", label: "Resources", Icon: BookOpen },
  { href: "/settings", label: "Settings", Icon: Settings },
] as const;

function isCurrent(pathname: string, href: string) {
  if (href === "/settings") return pathname === "/settings" || pathname === "/profile";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Thumb-reachable primary navigation for signed-in workspace pages below the desktop breakpoint. */
export function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Workspace" className="bottom-nav xl:hidden">
      <ul>
        {ITEMS.map(({ href, label, Icon }) => {
          const current = isCurrent(pathname, href);
          return (
            <li key={href}>
              {current ? (
                // The current page is shown, not linked: no workspace page links to itself.
                <span aria-current="page" className="is-current">
                  <Icon size={20} aria-hidden="true" />
                  <span>{label}</span>
                </span>
              ) : (
                <Link href={href}>
                  <Icon size={20} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
