import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import { auth } from "@/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getAuthConfigStatus } from "@/lib/auth-config";
import { getCurrentDbUser } from "@/lib/auth-guards";
import { countUnreadFor } from "@/lib/notifications";
import type mongoose from "mongoose";
import localFont from "next/font/local";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { MotionSafe } from "@/components/ui/MotionSafe";
import { ToastProvider } from "@/components/ui/Toast";

// All fonts are self-hosted Latin subsets (WOFF2) with their OFL licences in ./fonts.
const manrope = localFont({
  src: "./fonts/Manrope-Variable.woff2",
  variable: "--font-manrope",
  display: "swap",
  weight: "200 800",
});

const instrumentSerif = localFont({
  src: [
    { path: "./fonts/InstrumentSerif-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/InstrumentSerif-Italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
  // Mono is used for small numerals and course codes, never above the fold's largest text.
  preload: false,
  adjustFontFallback: false,
});

function metadataBase() {
  try {
    const configured = new URL(process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000");
    if (["http:", "https:"].includes(configured.protocol)) return new URL(configured.origin);
  } catch {
    // Keep public pages available while local configuration is incomplete.
  }
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: metadataBase(),
  applicationName: "Peerly",
  title: "Peerly — Student Peer-Learning Platform",
  description:
    "Connect with fellow university students for subject-specific study help, exchange academic resources, and review completed study sessions.",
  openGraph: {
    type: "website",
    siteName: "Peerly",
    title: "Peerly — Study help from university peers",
    description: "Find peers. Share resources. Learn together.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Peerly — Study help from university peers",
    description: "Find peers. Share resources. Learn together.",
  },
};

async function DynamicNavbar() {
  const authStatus = getAuthConfigStatus();
  const dbContext = await getCurrentDbUser();
  const session = dbContext?.session ?? (await auth());
  let unreadCount = 0;
  if (dbContext) {
    try { unreadCount = await countUnreadFor(dbContext.user._id as mongoose.Types.ObjectId); } catch { unreadCount = 0; }
  }

  return (
    <Navbar
      user={session?.user ? { id: session.user.id } : undefined}
      isAdmin={dbContext?.isAdmin ?? false}
      isAuthConfigured={authStatus.isConfigured}
      unreadCount={unreadCount}
    />
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authStatus = getAuthConfigStatus();

  return (
    <html
      lang="en"
      className={`${manrope.variable} ${instrumentSerif.variable} ${geistMono.variable}`}
      data-theme="paper"
      data-theme-preference="system"
      // The pre-paint script below updates data-theme before hydration.
      suppressHydrationWarning
    >
      <head>
        <script id="peerly-theme-init" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex flex-col min-h-screen bg-canvas text-ink antialiased">
        <MotionSafe>
          <ToastProvider>
            <Suspense fallback={<Navbar user={null} isAdmin={false} isAuthConfigured={authStatus.isConfigured} loading />}>
              <DynamicNavbar />
            </Suspense>
            <main id="main-content" tabIndex={-1} className="flex-1 w-full px-4 sm:px-6 lg:px-8 outline-none">
              {children}
            </main>
            <Footer />
          </ToastProvider>
        </MotionSafe>
      </body>
    </html>
  );
}
