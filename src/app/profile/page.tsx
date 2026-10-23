import { AvatarEditor } from "@/components/AvatarEditor";
import { LogoutButton } from "@/components/LogoutButton";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { isDatabaseConfigured, connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Mail, AlertTriangle, AlertCircle, Send, Inbox, Archive, BookOpen, LogOut } from "lucide-react";
import ProfileForm, { ProfileFormData } from "./ProfileForm";
import { LearningMode, PricingPreference, ContactMethod } from "@/types/user";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");

  if (!isDatabaseConfigured()) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="rounded-2xl border border-warning/25 bg-warning/10 p-6 sm:p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-warning/15 text-warning flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h1 className="text-base font-semibold text-warning">
              Database Configuration Required
            </h1>
            <p className="text-xs text-warning leading-relaxed">
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
        <div className="rounded-2xl border border-danger/25 bg-danger/10 p-6 sm:p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-danger/15 text-danger flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h1 className="text-base font-semibold text-danger">
              Unable to Load Profile
            </h1>
            <p className="text-xs text-danger leading-relaxed">
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
    <div className="workspace-page settings-page max-w-4xl mx-auto space-y-8 py-8">
      <div className="border-b border-line/80 pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
          Profile &amp; settings
        </h1>
        <p className="text-sm text-muted mt-1">
          Your name, photo, study preferences and private contact details.
        </p>
      </div>

      <nav className="settings-shortcuts" aria-label="Your account activity">
        <Link href="/dashboard?tab=outgoing"><Send size={17} />Sent requests</Link>
        <Link href="/dashboard?tab=incoming"><Inbox size={17} />Received requests</Link>
        <Link href="/dashboard?tab=outgoing&view=archived"><Archive size={17} />Archived</Link>
        <Link href="/resources/manage"><BookOpen size={17} />My resources</Link>
      </nav>
      <section className="settings-account" aria-labelledby="account-title">
        <div className="settings-section-heading"><div><h2 id="account-title">Your account</h2><p>Your photo and name appear on your peer profile.</p></div><LogoutButton className="workspace-secondary-button"><LogOut size={16} />Log out</LogoutButton></div>
        <AvatarEditor image={dbUser.image || ""} name={name} />
        <div className="settings-identity"><strong>{name}</strong><span><Mail size={15} />{email}<small>Private sign-in email</small></span></div>
      </section>

      {/* Profile Form */}
      <ProfileForm initialData={initialFormData} />
    </div>
  );
}
