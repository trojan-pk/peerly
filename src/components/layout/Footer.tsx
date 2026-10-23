"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export function Footer() {
  const pathname = usePathname();
  const marketing = pathname === "/" || pathname === "/login";
  return (
    <footer className={`site-footer ${marketing ? "marketing-footer" : ""}`}>
      <div className="footer-main">
        <div><Link href="/" className="brand-lockup" aria-label="Peerly Home"><BrandMark className="brand-symbol" /><span>peerly<span className="brand-period">.</span></span></Link><p>A little help goes a long way.<br />A place to learn it. A place to share it.</p></div>
        <div className="footer-links"><div><span>MEET PEERLY</span><Link href="/#features">Features <ArrowUpRight size={12} /></Link><Link href="/#how-it-works">How it works</Link><Link href="/#resources">Resources</Link></div><div><span>{marketing ? "YOUR NEXT STEP" : "YOUR CIRCLE"}</span>{marketing ? <><Link href="/login">Get started <ArrowUpRight size={12} /></Link><Link href="/login">Log in</Link><Link href="/#questions">Common questions</Link></> : <><Link href="/profile">Your profile</Link><Link href="/dashboard">Study requests</Link><Link href="/resources/manage">Share a resource</Link></>}</div><div><span>BRIGHTER TOGETHER</span><p>Different strengths.<br />New perspectives.<br />A little help goes a long way.</p></div></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Peerly</span><span>Different strengths. Better together.<span className="footer-dot" /></span></div>
    </footer>
  );
}
