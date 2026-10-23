import Link from "next/link";
import { auth } from "@/auth";
import { isDatabaseConfigured, connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Lock, Mail, ArrowRight, Shield, AlertTriangle, AlertCircle } from "lucide-react";
import ProfileForm, { ProfileFormData } from "./ProfileForm";
import { LearningMode, PricingPreference, ContactMethod } from "@/types/user";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="rounded-2xl border border-stone-200/90 bg-white p-8 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-stone-900">Sign in to View Profile</h1>
            <p className="text-xs text-stone-600">
              Please sign in with your Google account to view and edit your peer profile and study preferences.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              Sign In with Google
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isDatabaseConfigured()) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 sm:p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h1 className="text-base font-semibold text-amber-900">
              Database Configuration Required
            </h1>
            <p className="text-xs text-amber-800 leading-relaxed">
              Profile editing is temporarily unavailable because the database is not configured.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Load current user from database, explicitly selecting +contact
  let dbUser = null;
  let dbError = false;
  try {
    await connectToDatabase();
    if (session.user.id) {
      dbUser = await User.findById(session.user.id).select("+contact").lean();
    } else if (session.user.email) {
      dbUser = await User.findOne({ email: session.user.email.toLowerCase().trim() })
        .select("+contact")
        .lean();
    }
    if (!dbUser) {
      dbError = true;
    }
  } catch (err) {
    console.error("[ProfilePage] Error reading user from database:", err);
    dbError = true;
  }

  if (dbError || !dbUser) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-6 sm:p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-800 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h1 className="text-base font-semibold text-red-900">
              Unable to Load Profile
            </h1>
            <p className="text-xs text-red-800 leading-relaxed">
              We encountered a temporary database error while retrieving your saved profile. To protect your existing data, the profile editor cannot be displayed right now.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/profile"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold transition-colors min-h-[44px]"
            >
              Retry
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const name = dbUser?.name || session.user.name || "Student";
  const email = dbUser?.email || session.user.email || "";
  const role = dbUser?.role || session.user.role || "student";

  const initialFormData: ProfileFormData = {
    name: dbUser?.name || session.user.name || "",
    bio: dbUser?.bio || "",
    university: dbUser?.university || "",
    campus: dbUser?.campus || "",
    topics: Array.isArray(dbUser?.topics) ? dbUser.topics : [],
    subjects: Array.isArray(dbUser?.subjects) ? dbUser.subjects : [],
    mode: (dbUser?.mode as LearningMode) || "both",
    availability: dbUser?.availability || "",
    pricingPreference: (dbUser?.pricingPreference as PricingPreference) || "free",
    contact: {
      whatsapp: dbUser?.contact?.whatsapp || "",
      meetingLink: dbUser?.contact?.meetingLink || "",
      preferredMethod: (dbUser?.contact?.preferredMethod as ContactMethod) || "unspecified",
    },
    isProfileComplete: Boolean(dbUser?.isProfileComplete),
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-6">
      <div className="border-b border-stone-200/80 pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
          Your Profile &amp; Settings
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Manage your peer helper information, topics of expertise, and private contact preferences.
        </p>
      </div>

      {/* Account Overview Header */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {session.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt=""
                className="w-14 h-14 rounded-full object-cover border border-stone-200"
                aria-hidden="true"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg">
                {name[0]?.toUpperCase() || "S"}
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-900">{name}</h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-stone-100 text-stone-700">
                  {role}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{email}</span>
                <span className="text-emerald-700 font-medium">(Private identity)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-stone-600 sm:text-right">
            <Shield className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>Google Account Authenticated</span>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <ProfileForm initialData={initialFormData} />
    </div>
  );
}
