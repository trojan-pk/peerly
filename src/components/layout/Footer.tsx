"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";

/** Marketing footer, shown on the landing and login pages only. */
export function Footer() {
  const pathname = usePathname();
  const marketing = pathname === "/" || pathname === "/login";
  if (!marketing) return null;
  return (
    <footer className="site-footer marketing-footer">
      <div className="footer-main">
        <div>
          <Link href="/" className="brand-lockup" aria-label="Peerly Home"><BrandMark className="brand-symbol" /><BrandWordmark className="brand-wordmark" /></Link>
          <p>Study help from students who’ve taken your course.</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <div><span>Peerly</span><Link href="/#how-it-works">How it works</Link><Link href="/#privacy">Privacy</Link><Link href="/#resources">Resources</Link></div>
          <div><span>Get started</span><Link href="/login">Sign in with Google</Link><Link href="/#helpers">Become a helper</Link><Link href="/#questions">Questions</Link></div>
        </nav>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Peerly</span><span>No payments, no file uploads, no AI answers — just peers.</span></div>
    </footer>
  );
}
