"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowUpRight, LogOut, UserRound } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";

interface NavbarProps {
  user?: { id?: string; name?: string | null; email?: string | null; image?: string | null; role?: string } | null;
  isAdmin?: boolean;
  isAuthConfigured?: boolean;
}

export function Navbar(props: NavbarProps) {
  const pathname = usePathname();
  return <RouteNavbar key={pathname} {...props} pathname={pathname} />;
}

// Navigation state belongs to the current page, including after auth redirects.
function RouteNavbar({ user, isAdmin = false, pathname }: NavbarProps & { pathname: string }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const marketing = pathname === "/" || pathname === "/login";
  const startHref = user ? "/dashboard" : "/login";
  const links = marketing ? [
    { label: "Features", href: "/#features" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Resources", href: "/#resources" },
  ] : [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Discover peers", href: "/peers" },
    { label: "Resources", href: "/resources" },
    ...(user && isAdmin ? [{ label: "Admin reports", href: "/admin/reports" }] : []),
  ];
  const isActive = (href: string) => !href.includes("#") && pathname.startsWith(href);

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className={`site-header ${marketing ? "is-marketing" : ""}`} onKeyDown={event => { if (event.key === "Escape") { setIsMobileMenuOpen(false); document.getElementById("mobile-menu-toggle")?.focus(); } }}>
        <div className="nav-container">
          <Link href="/" aria-label="Peerly Home" className="brand-lockup" onClick={() => setIsMobileMenuOpen(false)}><BrandMark className="brand-symbol" /><BrandWordmark className="brand-wordmark" /></Link>
          <nav aria-label="Main Navigation" className="hidden xl:flex items-center gap-1">
            {links.map(link => <Link key={link.href} href={link.href} aria-current={isActive(link.href) ? "page" : undefined} className={`nav-link ${isActive(link.href) ? "active" : ""}`}>{link.label}</Link>)}
          </nav>
          <div className="hidden xl:flex items-center gap-4">
            {marketing ? <><Link href={startHref} className="nav-link">{user ? "Your workspace" : "Log in"}</Link><Link href={startHref} className="nav-join">{user ? "Open platform" : "Get started"}<ArrowUpRight size={15} /></Link></> : user ? <><Link href="/profile" className="nav-profile" aria-label={`View profile for ${user.name || "Student"}`}><UserRound size={16} /><span>{user.name || "Your profile"}</span></Link><LogoutButton className="nav-signout" ariaLabel="Sign out of Peerly"><LogOut size={16} /><span className="sr-only">Sign Out</span></LogoutButton></> : <><Link href="/login" className="nav-link">Sign in</Link><Link href="/login" className="nav-join">Join the circle <ArrowUpRight size={15} /></Link></>}
          </div>
          <button type="button" id="mobile-menu-toggle" className="mobile-menu-button xl:hidden" aria-controls="mobile-navigation" aria-expanded={isMobileMenuOpen} aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"} onClick={() => setIsMobileMenuOpen(open => !open)}>{isMobileMenuOpen ? <X size={23} /> : <Menu size={23} />}</button>
        </div>
        {isMobileMenuOpen && <nav id="mobile-navigation" aria-label="Mobile Navigation" className="mobile-navigation xl:hidden">{links.map(link => <Link key={link.href} href={link.href} className={`nav-link ${isActive(link.href) ? "active" : ""}`} aria-current={isActive(link.href) ? "page" : undefined} onClick={() => setIsMobileMenuOpen(false)}>{link.label}<ArrowUpRight size={14} /></Link>)}<div className="mobile-user">{user && !marketing ? <><Link href="/profile" className="nav-profile" onClick={() => setIsMobileMenuOpen(false)}><UserRound size={17} />{user.name || "Your profile"}</Link><LogoutButton className="nav-link">Sign Out <LogOut size={15} /></LogoutButton></> : <Link href={startHref} className="nav-join" onClick={() => setIsMobileMenuOpen(false)}>{user ? "Open platform" : "Get started"}<ArrowUpRight size={15} /></Link>}</div></nav>}
      </header>
    </>
  );
}
