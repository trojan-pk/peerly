import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import { auth } from "@/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getAuthConfigStatus } from "@/lib/auth-config";
import { getCurrentDbUser } from "@/lib/auth-guards";
import localFont from "next/font/local";

const manrope = localFont({
  src: "./fonts/Manrope-Variable.ttf",
  variable: "--font-manrope",
  display: "swap",
  weight: "200 800",
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

  return (
    <Navbar
      user={session?.user ? { id: session.user.id } : undefined}
      isAdmin={dbContext?.isAdmin ?? false}
      isAuthConfigured={authStatus.isConfigured}
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
    <html lang="en" className={manrope.variable} data-theme="dark">
      <body className="flex flex-col min-h-screen bg-canvas text-ink antialiased">
        <Suspense fallback={<Navbar user={null} isAdmin={false} isAuthConfigured={authStatus.isConfigured} loading />}>
          <DynamicNavbar />
        </Suspense>
        <main id="main-content" tabIndex={-1} className="flex-1 w-full px-4 sm:px-6 lg:px-8 outline-none">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
