"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, Menu, X, LogIn, LogOut, User as UserIcon } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

interface NavbarProps {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  } | null;
  isAdmin?: boolean;
  isAuthConfigured?: boolean;
}

export function Navbar({ user, isAdmin = false }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Discover Peers", href: "/peers" },
    { label: "Resources", href: "/resources" },
  ];

  if (user) {
    navLinks.push({ label: "Dashboard", href: "/dashboard" });
    if (isAdmin) {
      navLinks.push({ label: "Admin Reports", href: "/admin/reports" });
    }
  }

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Skip to Content link for keyboard accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-700 focus:text-white focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        Skip to main content
      </a>

      <header role="banner" className="sticky top-0 z-40 w-full border-b border-stone-200/80 bg-[#FAF8F5]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link
                href="/"
                className="flex items-center gap-2.5 rounded-lg px-2 py-1 text-stone-900 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:outline-none min-h-[44px]"
                aria-label="Peerly Home"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
                  <GraduationCap className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-lg leading-tight tracking-tight text-stone-900">
                    Peerly
                  </span>
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-700">
                    Peer Learning
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav aria-label="Main Navigation" className="hidden xl:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] flex items-center ${
                    isActive(link.href)
                      ? "text-emerald-700 bg-emerald-50/80 font-semibold"
                      : "text-stone-700 hover:text-stone-900 hover:bg-stone-100/60"
                  }`}
                  aria-current={isActive(link.href) ? "page" : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Desktop User Section */}
            <div className="hidden xl:flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-2">
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-stone-800 hover:bg-stone-100 min-h-[44px] focus-visible:ring-2 focus-visible:ring-emerald-600"
                    aria-label={`View profile for ${user.name || "Student"}`}
                  >
                    {user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.image}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover border border-stone-200"
                        aria-hidden="true"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-semibold">
                        {(user.name || "U")[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-medium text-stone-700 max-w-[120px] truncate">
                      {user.name || "Student"}
                    </span>
                  </Link>

                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-emerald-600 cursor-pointer"
                      aria-label="Sign out of Peerly"
                    >
                      <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                      Sign Out
                    </button>
                  </form>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shadow-xs min-h-[44px] focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <LogIn className="w-4 h-4" aria-hidden="true" />
                  Sign In
                </Link>
              )}
            </div>

            {/* Mobile Menu Toggle Button */}
            <div className="flex xl:hidden items-center">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-stone-700 hover:text-stone-900 hover:bg-stone-100 min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-emerald-600"
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-navigation"
                aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" aria-hidden="true" />
                ) : (
                  <Menu className="w-6 h-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <nav
            id="mobile-navigation"
            aria-label="Mobile Navigation"
            className="xl:hidden border-t border-stone-200 bg-[#FAF8F5] px-4 pt-3 pb-6 shadow-md"
          >
            <div className="flex flex-col space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-3 py-2.5 rounded-md text-base font-medium min-h-[44px] flex items-center ${
                    isActive(link.href)
                      ? "text-emerald-700 bg-emerald-50 font-semibold"
                      : "text-stone-700 hover:text-stone-900 hover:bg-stone-100"
                  }`}
                  aria-current={isActive(link.href) ? "page" : undefined}
                >
                  {link.label}
                </Link>
              ))}

              <div className="pt-4 mt-2 border-t border-stone-200">
                {user ? (
                  <div className="space-y-2">
                    <Link
                      href="/profile"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-stone-800 hover:bg-stone-100 min-h-[44px]"
                    >
                      <UserIcon className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                      <div>
                        <div className="text-sm font-medium text-stone-900">
                          {user.name || "Student"}
                        </div>
                        <div className="text-xs text-stone-500">{user.email}</div>
                      </div>
                    </Link>

                    <form action={logoutAction}>
                      <button
                        type="submit"
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-100 min-h-[44px] cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-stone-500" aria-hidden="true" />
                        Sign Out
                      </button>
                    </form>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 min-h-[44px]"
                  >
                    <LogIn className="w-4 h-4" aria-hidden="true" />
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          </nav>
        )}
      </header>
    </>
  );
}
