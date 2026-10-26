"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowUpRight, LogOut, Settings } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BottomNav } from "@/components/layout/BottomNav";

interface NavbarProps {
  user?: { id?: string } | null;
  isAdmin?: boolean;
  isAuthConfigured?: boolean;
  loading?: boolean;
}

export function Navbar(props: NavbarProps) {
  const pathname = usePathname();
  return <RouteNavbar key={pathname} {...props} pathname={pathname} />;
}

function RouteNavbar({ user, isAdmin = false, loading = false, pathname }: NavbarProps & { pathname: string }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const marketing = pathname === "/" || pathname === "/login";
  const settings = pathname === "/settings" || pathname === "/profile";
  const startHref = user ? "/dashboard" : "/login";
  const links = marketing ? [
    { label: "Features", href: "/#features" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Resources", href: "/#resources" },
  ] : [
    { label: "Discover peers", href: "/peers" },
    { label: "Resources", href: "/resources" },
    ...(user && isAdmin ? [{ label: "Admin reports", href: "/admin/reports" }] : []),
  ];
  const isActive = (href: string) => !href.includes("#") && pathname.startsWith(href);

  return <>
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <header className={`site-header ${marketing ? "is-marketing" : ""}`} onKeyDown={event => { if (event.key === "Escape") { setIsMobileMenuOpen(false); document.getElementById("mobile-menu-toggle")?.focus(); } }}>
      <div className="nav-container">
        <Link href={marketing ? "/" : "/dashboard"} aria-label={marketing ? "Peerly Home" : "Peerly dashboard"} className="brand-lockup" onClick={() => setIsMobileMenuOpen(false)}><BrandMark className="brand-symbol" /><BrandWordmark className="brand-wordmark" /></Link>
        <nav aria-label="Main Navigation" className="hidden xl:flex items-center gap-1">{links.map(link => <Link key={link.href} href={link.href} aria-current={isActive(link.href) ? "page" : undefined} className={`nav-link ${isActive(link.href) ? "active" : ""}`}>{link.label}</Link>)}</nav>
        <div className="header-account-actions">
          {!marketing && <div className="hidden xl:block"><ThemeToggle compact /></div>}
          {marketing ? <div className="hidden xl:flex items-center gap-4"><Link href={startHref} className="nav-link">{user ? "Your workspace" : "Log in"}</Link><Link href={startHref} className="nav-join">{user ? "Open platform" : "Get started"}<ArrowUpRight size={15} /></Link></div> : user ? !settings && <Link href="/settings" aria-label="Open account settings" title="Account settings" className="settings-link"><Settings size={19} aria-hidden="true" /></Link> : <Link href="/login" className="nav-join hidden xl:flex">Sign in</Link>}
          <button type="button" id="mobile-menu-toggle" className="mobile-menu-button xl:hidden" disabled={loading} aria-busy={loading || undefined} aria-controls="mobile-navigation" aria-expanded={isMobileMenuOpen} aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"} onClick={() => setIsMobileMenuOpen(open => !open)}>{isMobileMenuOpen ? <X size={23} /> : <Menu size={23} />}</button>
        </div>
      </div>
      {isMobileMenuOpen && <nav id="mobile-navigation" aria-label="Mobile Navigation" className="mobile-navigation xl:hidden">{links.map(link => <Link key={link.href} href={link.href} className={`nav-link ${isActive(link.href) ? "active" : ""}`} onClick={() => setIsMobileMenuOpen(false)}>{link.label}<ArrowUpRight size={14} /></Link>)}<div className="mobile-user">{!marketing && <div className="mobile-theme"><span>Theme</span><ThemeToggle compact /></div>}{user && !marketing ? <LogoutButton className="nav-link">Sign Out <LogOut size={15} /></LogoutButton> : <Link href={startHref} className="nav-join" onClick={() => setIsMobileMenuOpen(false)}>{user ? "Open platform" : "Get started"}<ArrowUpRight size={15} /></Link>}</div></nav>}
    </header>
    {user && !marketing && !loading && <BottomNav pathname={pathname} />}
  </>;
}
