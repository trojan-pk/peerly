import { Shield, BookOpen, GraduationCap } from "lucide-react";
import { getAuthConfigStatus } from "@/lib/auth-config";
import { isDatabaseConfigured } from "@/lib/db";

export function Footer() {
  const isDev = process.env.NODE_ENV === "development";
  const authStatus = getAuthConfigStatus();
  const dbConfigured = isDatabaseConfigured();

  return (
    <footer
      role="contentinfo"
      className="mt-auto border-t border-stone-200/80 bg-[#FAF8F5] text-stone-600 text-sm"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Column 1: Brand & Purpose */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-stone-900 tracking-tight text-base">
              <GraduationCap className="w-5 h-5 text-emerald-600" aria-hidden="true" />
              <span>Peerly</span>
            </div>
            <p className="text-stone-600 text-xs leading-relaxed max-w-sm">
              A university peer-learning network where students exchange subject-specific study help, share academic resources, and learn together.
            </p>
          </div>

          {/* Column 2: Privacy Guarantee */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-medium text-stone-900 text-xs uppercase tracking-wider">
              <Shield className="w-4 h-4 text-emerald-700" aria-hidden="true" />
              <span>Contact Privacy</span>
            </div>
            <p className="text-stone-600 text-xs leading-relaxed max-w-sm">
              Personal contact details are never public. WhatsApp and meeting links unlock strictly between participants after a study request is confirmed.
            </p>
          </div>

          {/* Column 3: Academic Standards */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-medium text-stone-900 text-xs uppercase tracking-wider">
              <BookOpen className="w-4 h-4 text-emerald-700" aria-hidden="true" />
              <span>Student Feedback</span>
            </div>
            <p className="text-stone-600 text-xs leading-relaxed max-w-sm">
              Study ratings and reviews derive exclusively from sessions confirmed by both students. Feedback helps you choose the right peer.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-stone-200/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <p>© {new Date().getFullYear()} Peerly. Learn something. Share something.</p>

          {/* Development Environment Info (Only visible in development mode) */}
          {isDev && (
            <div className="flex items-center gap-3 text-[11px] text-stone-500 font-mono bg-stone-100/80 px-2.5 py-1 rounded-md border border-stone-200">
              <span className="font-sans font-medium text-stone-700">Dev Environment:</span>
              <span>DB: {dbConfigured ? "Ready" : "Pending"}</span>
              <span>•</span>
              <span>Auth: {authStatus.isConfigured ? "Ready" : "Pending"}</span>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
