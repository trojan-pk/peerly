import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div><Link href="/" className="brand-lockup" aria-label="Peerly Home"><BrandMark className="brand-symbol" /><span>peerly<span className="brand-period">.</span></span></Link><p>A little help goes a long way.<br />A place to learn it. A place to share it.</p></div>
        <div className="footer-links"><div><span>EXPLORE</span><Link href="/peers">Find a peer <ArrowUpRight size={12} /></Link><Link href="/resources">Study resources <ArrowUpRight size={12} /></Link><Link href="/#how-it-works">How it works</Link></div><div><span>YOUR CIRCLE</span><Link href="/profile">Your profile</Link><Link href="/dashboard">Study requests</Link><Link href="/resources/manage">Share a resource</Link></div><div><span>GOOD TO KNOW</span><Link href="/#questions">Common questions</Link><Link href="/login">Join Peerly</Link><p>Contact stays private.<br />Knowledge gets shared.</p></div></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Peerly</span><span>Different strengths. Better together.<span className="footer-dot" /></span><Link href="#main-content">Back to top ↑</Link></div>
    </footer>
  );
}
