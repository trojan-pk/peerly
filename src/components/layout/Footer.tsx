"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";

export function Footer() {
  const pathname = usePathname();
  const marketing = pathname === "/" || pathname === "/login";
  if (!marketing) return null;
  return (
    <footer className="site-footer marketing-footer">
      <div className="footer-main">
        <div><Link href="/" className="brand-lockup" aria-label="Peerly Home"><BrandMark className="brand-symbol" /><BrandWordmark className="brand-wordmark" /></Link><p>A little help goes a long way.<br />A place to learn it. A place to share it.</p></div>
        <div className="footer-links"><div><span>MEET PEERLY</span><Link href="/#features">Features <ArrowUpRight size={12} /></Link><Link href="/#how-it-works">How it works</Link><Link href="/#resources">Resources</Link></div><div><span>YOUR NEXT STEP</span><Link href="/login">Get started <ArrowUpRight size={12} /></Link><Link href="/login">Log in</Link><Link href="/#questions">Common questions</Link></div><div><span>BRIGHTER TOGETHER</span><p>Different strengths.<br />New perspectives.<br />A little help goes a long way.</p></div></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Peerly</span><span>Different strengths. Better together.<span className="footer-dot" /></span></div>
    </footer>
  );
}
