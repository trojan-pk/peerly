import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { UiShowcase } from "./UiShowcase";

export const metadata: Metadata = { title: "UI primitives — Peerly", robots: { index: false, follow: false } };

/**
 * Development reference for the Paper & Ink primitives. Not part of the product:
 * production builds return 404 unless PEERLY_UI_SHOWCASE=1 (used only by browser tests).
 * It renders static examples and never reads user data.
 */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production" && process.env.PEERLY_UI_SHOWCASE !== "1") notFound();
  return <UiShowcase />;
}
