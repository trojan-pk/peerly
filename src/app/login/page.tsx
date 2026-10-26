import { LogoutButton } from "@/components/LogoutButton";
import { BrandMark } from "@/components/BrandMark";
import { auth } from "@/auth";
import { loginWithGoogleAction } from "@/app/actions/auth";
import { getAuthConfigStatus } from "@/lib/auth-config";
import { isDatabaseConfigured } from "@/lib/db";
import Link from "next/link";
import { Shield, AlertTriangle, KeyRound, CheckCircle, Database, Clock, Lock, Star } from "lucide-react";

export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams: Promise<{
    error?: string;
    callbackUrl?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const authStatus = getAuthConfigStatus();
  const dbConfigured = isDatabaseConfigured();
  const params = await searchParams;
  const error = params?.error;
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="login-page">
      <section className="login-intro" aria-labelledby="login-intro-title">
        <p className="lp-kicker">Peerly</p>
        <h2 id="login-intro-title" className="lp-heading">Pick up where your course left off.</h2>
        <ul className="login-points">
          <li><Clock className="w-5 h-5" aria-hidden="true" /><span><strong>Urgent requests go first.</strong> Add your deadline; helpers see the countdown.</span></li>
          <li><Lock className="w-5 h-5" aria-hidden="true" /><span><strong>Contact stays private.</strong> It unlocks only for a request a helper accepts.</span></li>
          <li><Star className="w-5 h-5" aria-hidden="true" /><span><strong>Reviews are earned.</strong> Only completed sessions can be rated.</span></li>
        </ul>
      </section>
      <div className="login-card space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <span className="login-mark" aria-hidden="true"><BrandMark className="w-8 h-8" /></span>
          <h1 className="page-title">Sign in to Peerly</h1>
          <p className="text-sm text-muted leading-relaxed">
            Use your Google account to ask for help, offer it and share study links. You’ll set up your profile next.
          </p>
        </div>

        {/* Existing Session State */}
        {session?.user ? (
          <div className="rounded-xl border border-accent/25 bg-accent/10 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-accent mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-accent">
                  You are already signed in
                </h2>
                <p className="text-xs text-accent mt-0.5">
                  Signed in as <span className="font-medium">{session.user.name || "Student"}</span> ({session.user.email})
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Link
                href="/dashboard"
                className="ui-button is-primary is-md flex-1"
              >
                Go to Dashboard
              </Link>
              <LogoutButton
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-edge bg-surface text-body text-sm font-medium hover:bg-panel transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
              >
                Sign Out
              </LogoutButton>
            </div>
          </div>
        ) : (
          <>
            {/* Error Banners */}
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-danger/25 bg-danger/10 p-4 text-xs text-danger space-y-1"
              >
                <div className="font-semibold">Sign-in Notice:</div>
                <div>
                  {error === "ConfigurationRequired"
                    ? "Authentication requires environment credentials before sign-in can proceed."
                    : error === "AccessDenied"
                    ? "Sign-in was canceled, unverified, or access was denied."
                    : `Authentication failed (${error}). Please try again or verify configuration.`}
                </div>
              </div>
            )}

            {/* Authentication Action or Missing Config Banner */}
            {authStatus.isConfigured ? (
              <form action={loginWithGoogleAction} className="space-y-4">
                <button
                  type="submit"
                  className="ui-button is-secondary is-lg w-full"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                {isDev ? (
                  /* Developer Configuration Panel */
                  <div className="rounded-xl border border-warning/25 bg-warning/10 p-4 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <h2 className="text-sm font-semibold text-warning">
                          Local Development Configuration Required
                        </h2>
                        <p className="text-xs text-warning mt-1 leading-relaxed">
                          Authentication requires valid local environment credentials in <code className="bg-warning/15 px-1 py-0.5 rounded font-mono">.env.local</code>.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg bg-surface/90 border border-warning/25 p-3 text-xs space-y-2 text-ink font-mono">
                      <p className="font-sans font-medium text-body">Missing or invalid variables:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-warning">
                        {authStatus.missing.map((key) => (
                          <li key={key}>{key}</li>
                        ))}
                      </ul>
                      <div className="pt-2 border-t border-warning/25 font-sans text-muted space-y-1">
                        <p>
                          1. Copy <code className="bg-raised px-1 py-0.5 rounded text-ink">.env.example</code> to{" "}
                          <code className="bg-raised px-1 py-0.5 rounded text-ink">.env.local</code>.
                        </p>
                        <p>
                          2. Configure Google OAuth callback URL in Google Cloud Console:
                          <br />
                          <code className="bg-raised px-1 py-0.5 rounded text-accent select-all block mt-1 break-all">
                            http://localhost:3000/api/auth/callback/google
                          </code>
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Customer-Facing Unavailable Notice */
                  <div className="rounded-xl border border-line bg-panel p-4 text-center space-y-1 text-xs text-muted">
                    <p className="font-semibold text-ink">Google Sign-In is temporarily unavailable</p>
                    <p>Our team is verifying authentication settings. Please check back shortly.</p>
                  </div>
                )}

                {/* Disabled Sign In Button explaining state */}
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-line bg-raised text-faint text-sm font-medium cursor-not-allowed min-h-[48px]"
                >
                  <KeyRound className="w-4 h-4" aria-hidden="true" />
                  <span>Google Sign-In Unavailable</span>
                </button>
              </div>
            )}

            {/* Development-only database status note if not configured */}
            {isDev && !dbConfigured && (
              <div className="rounded-lg border border-line bg-panel p-3 flex items-start gap-2.5 text-xs text-muted">
                <Database className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <span className="font-medium text-ink">Database Note: </span>
                  <code className="bg-edge/60 px-1 py-0.2 rounded text-ink">MONGODB_URI</code> is not set in{" "}
                  <code className="bg-edge/60 px-1 py-0.2 rounded text-ink">.env.local</code>. MongoDB is required for user account persistence.
                </div>
              </div>
            )}
          </>
        )}

        {/* Privacy Note */}
        <div className="pt-4 border-t border-line flex items-start gap-2 text-sm text-muted">
          <Shield className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            We use Google only to sign you in. Your email and contact details never appear in search results or public profiles.
          </p>
        </div>
      </div>
    </div>
  );
}
