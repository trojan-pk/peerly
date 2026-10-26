import { InitialsAvatar } from "@/components/InitialsAvatar";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EmailAlertsToggle } from "@/components/EmailAlertsToggle";
import { isEmailConfigured } from "@/lib/email";
import { CoursesSection } from "@/components/settings/CoursesSection";
import { UniversityEmailSection } from "@/components/settings/UniversityEmailSection";
import { getVerificationStatus, listCourses, listUniversities } from "@/lib/courses";
import { requireAuth } from "@/lib/auth-guards";
import { PublicPageSection } from "@/components/settings/PublicPageSection";
import { appOrigin } from "@/lib/email";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { isDatabaseConfigured, connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Mail, AlertTriangle, AlertCircle, LogOut } from "lucide-react";
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
              href="/settings"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold transition-colors min-h-[44px]"
            >
              Retry
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const context = await requireAuth().catch(() => null);
  const [universities, verification] = await Promise.all([
    listUniversities().catch(() => []),
    context ? getVerificationStatus(context.user).catch(() => null) : Promise.resolve(null),
  ]);
  const universityId = dbUser?.universityRef ? String(dbUser.universityRef) : null;
  const universityCourses = universityId ? await listCourses(universityId).catch(() => []) : [];
  const selectedCourses = (dbUser?.courses ?? []).map(String);

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
        <h1 className="page-title">
          Profile &amp; settings
        </h1>
        <p className="text-sm text-muted mt-1">
          Your name, study preferences and private contact details.
        </p>
      </div>

      <section className="settings-account" aria-labelledby="account-title">
        <div className="settings-section-heading"><div><h2 id="account-title">Your account</h2><p>Your avatar uses your name’s initials and updates when you save a new name.</p></div><LogoutButton className="workspace-secondary-button"><LogOut size={16} aria-hidden="true" />Log out</LogoutButton></div>
        <div className="settings-person"><InitialsAvatar name={name} decorative={false} className="settings-initials" /><div className="settings-identity"><strong>{name}</strong><span><Mail size={15} aria-hidden="true" />{email}</span><small>Private sign-in email</small></div></div>
      </section>

      <section className="settings-account" aria-labelledby="appearance-title">
        <div className="settings-section-heading"><div><h2 id="appearance-title">Appearance</h2><p>Paper is the light theme and Ink is the dark one. System follows your device setting. Your choice is saved in this browser.</p></div></div>
        <ThemeToggle />
      </section>

      <section className="settings-account" aria-labelledby="courses-title">
        <div className="settings-section-heading"><div><h2 id="courses-title">University and courses</h2><p>Students searching for a course code find helpers who list it. Topics below still work for anything not in the catalogue.</p></div></div>
        <CoursesSection universities={universities} initialUniversityId={universityId} initialCourses={universityCourses} initialSelected={selectedCourses} />
      </section>

      {verification && (
        <section className="settings-account" aria-labelledby="verify-title">
          <div className="settings-section-heading"><div><h2 id="verify-title">University email</h2><p>Optional. Adds a “University email verified” badge to your profile.</p></div></div>
          <UniversityEmailSection status={verification} />
        </section>
      )}

      <section className="settings-account" aria-labelledby="public-page-title">
        <div className="settings-section-heading"><div><h2 id="public-page-title">Shareable helper page</h2><p>A link you can add to your CV or LinkedIn. Off until you turn it on.</p></div></div>
        <PublicPageSection initialEnabled={Boolean(dbUser?.publicPageEnabled)} initialSlug={dbUser?.publicSlug ?? null} origin={appOrigin()} />
      </section>

      <section className="settings-account" aria-labelledby="notifications-title">
        <div className="settings-section-heading"><div><h2 id="notifications-title">Notifications</h2><p>Request updates always appear under the bell in the header.</p></div></div>
        <EmailAlertsToggle initialEnabled={dbUser?.emailAlerts !== false} emailConfigured={isEmailConfigured()} />
      </section>

      {/* Profile Form */}
      <ProfileForm initialData={initialFormData} />
    </div>
  );
}
