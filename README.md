# Peerly

Find a classmate who can explain the topic you're stuck on, request a short study session, and share useful notes. One account can both learn and help.

## Run locally

Requires **Node.js 22.18+**, **pnpm 11** (`corepack enable` activates the pinned version) and a reachable MongoDB database.

```bash
pnpm install --frozen-lockfile
pnpm setup:env
# Fill the three provider values in .env.local using the instructions below.
pnpm check:env --connect
pnpm dev
```

Open **http://localhost:3000**. `pnpm setup:env` creates an ignored `.env.local` with restrictive permissions and a cryptographically random `AUTH_SECRET`; it never overwrites an existing `.env.local` or `.env` file or prints the secret. The app builds and displays safe unavailable states without credentials. Sign-in and saved data require real configuration.

## Environment: what to get and where

| Variable | Source | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Atlas → your cluster → Connect → Drivers | Database connection. Include the database name `peerly` in the URI. |
| `AUTH_GOOGLE_ID` | Google Cloud → Google Auth Platform → Clients → Web application | Google OAuth client ID, usually ending in `.apps.googleusercontent.com`. |
| `AUTH_GOOGLE_SECRET` | The same Google OAuth client's credentials | OAuth secret, not a Gemini API key. |
| `AUTH_SECRET` | Generated locally by `pnpm setup:env` | Encrypts session cookies. Different per environment; rotating it signs existing users out. |
| `AUTH_URL` | Your app's base URL | `http://localhost:3000` locally; the exact HTTPS origin after deployment. |
| `ADMIN_EMAILS` | Your chosen administrator Google email(s) | Optional comma-separated allowlist. |

Put these in **`.env.local`** (an existing `.env` also works), never client code or `NEXT_PUBLIC_` variables. When deploying, set the same names in the host's environment settings. Restart after changes. `pnpm check:env` prints only validation status; `--connect` additionally pings MongoDB. It does not validate your credentials against Google or prove login works.

### MongoDB Atlas

1. Register at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register). Choose a **Free / M0** cluster, skip sample datasets and paid upgrades.
2. In **Database Access**, create a database user. Its password is different from your Atlas account password.
3. In **Network Access**, allow your current development IP. For hosting, configure access for the deployment's outbound network; do not blindly open the database to all addresses.
4. Choose **Connect → Drivers**. Substitute the database username/password in the URI and add `/peerly` before its query string. URL-encode special characters. Save as `MONGODB_URI`.
5. Run `pnpm check:env --connect`.

Atlas offers a free tier with **512 MB** of shared storage. Capacity, connection and feature limits apply; automatic backups are not included in the free tier. See [current pricing](https://www.mongodb.com/pricing) and the [free cluster guide](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/).

A local MongoDB also works: `mongodb://127.0.0.1:27017/peerly`. The app creates collections and required indexes on demand before writes. The database user needs permission to create those indexes. Automated tests must use isolated databases. The optional Atlas browser check below creates and removes a random temporary database on your cluster; it never seeds or drops your application database.

### Google login

1. Open [Google Cloud Console](https://console.cloud.google.com/), create/select a project and open **Google Auth Platform** (or **APIs & Services → OAuth consent screen**).
2. Configure Branding: app name, your support email and developer contact. Choose the appropriate audience. Start in testing; add your two test accounts where required by the console.
3. Under **Clients**, create an **OAuth client ID → Web application**.
4. Add authorized JavaScript origin **`http://localhost:3000`**.
5. Add this exact authorized redirect URI:

   ```text
   http://localhost:3000/api/auth/callback/google
   ```

6. Save client ID and secret in `.env.local`. Only basic `openid`, `email`, and `profile` scopes are needed. Do not enable Gemini, Maps, SMS or other paid APIs for this app.
7. Restart and use **Continue with Google**. University affiliation is self-described, not university-verified. Google Workspace administrators may restrict apps.

When deploying, add the actual HTTPS origin and `https://YOUR-HOST/api/auth/callback/google`, update `AUTH_URL`, and review Google's audience/branding requirements. Callbacks must match exactly. See [Google setup](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred) and [audience guidance](https://support.google.com/cloud/answer/15549945).

### Cost and hosting

There is no paid AI, email, payment, file-upload or video service in this MVP. Local development and Atlas Free can be used without a hosting subscription. Basic Google OAuth uses the credentials above; no paid identity platform or cloud-compute product is required for this setup.

[Vercel Hobby](https://vercel.com/docs/plans/hobby) is free within its limits for personal, non-commercial projects. Its terms restrict commercial use; choose a suitable paid/alternative host for a commercial service. A custom domain is optional. Provider prices and quotas can change.

This is a **Next.js Node application**, not a static export. It requires a server runtime with MongoDB connectivity. Build with `pnpm build`, run with `pnpm start`. The repository has not been published or deployed by this setup.

## Features and boundaries

- Google sign-in, profile editing, public profiles and topic/subject/mode/pricing search.
- Explainable matching scores, real review averages and response badges.
- Requests with accept/reject/cancel, contact unlocking and two-participant completion.
- One learner review per completed session, enforced atomically.
- Public resource links, personal management and ownership checks.
- Reports and `/admin/reports` with reversible moderation.
- Server validation, private/public DTO separation and database-backed write throttling.

No payment processing, hosted calls, resource file uploads or AI answers. A paid preference is informational; users arrange any terms directly. Use public campus spaces for physical sessions.

## Visual design and entry flow

Visitors see one Paper & Ink marketing page that follows the chosen theme. Its
navigation (How it works, Privacy, Resources, Questions) scrolls within the page.
Calls to action go to the dashboard (signed-out visitors are sent to Google sign-in,
which returns them there). The landing never queries member profiles or resources,
and does not wait for the session check, so it renders without a loading skeleton.

The hero plays one illustrative sequence — an urgent request, a helper accepting and
contact unlocking — once, with a Replay button; reduced-motion visitors see the final
state. "How it works" uses a sticky preview driven by normal scrolling (no scroll
hijacking) and keyboard-selectable steps. Every example person, course and resource
is labelled as illustrative; there are no testimonials, counters or invented ratings.
The marketing footer appears only on the landing and login pages.

Peerly uses Manrope (interface), Instrument Serif (display headlines) and Geist Mono
(numbers, timers and course codes). All three are self-hosted Latin WOFF2 subsets
in `src/app/fonts/` with their OFL licences; no external font request is made.

Illustrative profiles and resources are labelled examples, not real activity,
testimonials or fabricated ratings. Resource examples show link types, not uploads.
Motion (`motion`, pinned) is the only animation library. It loads through
`LazyMotion` with the DOM feature set and `reducedMotion="user"`; no external font
request is made.

## Paper & Ink design system

The workspace uses two themes: **Paper** (warm off-white, ink-navy text) and
**Ink** (deep ink, paper-coloured text), with one fountain-pen blue accent and a
highlighter yellow reserved for emphasis. Choose Light, Dark or System from the
header or Settings → Appearance; the choice is stored in the browser and applied by
a small inline script before first paint, so there is no theme flash. System
follows live OS changes.

Tokens live in `src/app/styles/tokens.css` in three layers: primitives, semantic
`--pi-*` roles per theme, and Tailwind colour utilities mapped to those roles.
`src/tests/design-tokens.test.ts` checks every text/background pair against WCAG AA.
Shared primitives (Button, Card, Badge, Field/Input/Textarea/Select, Dialog, Toast,
Skeleton, EmptyState) are in `src/components/ui/`. A reference page is available
at `/dev/ui` during development and returns 404 in production builds. Below the
desktop breakpoint, signed-in pages show a bottom navigation bar.

## Urgent help, expiry and notifications

Learners mark a request **Normal** or **Urgent** and may add a **Needed by** deadline
(15 minutes to 14 days ahead). A pending request closes at the earliest of the deadline
or 6 hours (urgent) / 72 hours (normal) after sending. Legacy requests without these
fields use the 72-hour window. Expiry is applied atomically when dashboards load, before
a new request is created and when a helper responds; there is no background job. An
expired request can't be accepted or declined, frees the same helper and topic for a new
request, and is excluded from response-time badges. Helpers see pending urgent requests
first with a live countdown; learners see **Try another helper**.

The header bell shows unread notifications for: request received, accepted, declined,
the other participant confirming completion, session completed, review received and
request expired. It checks every 60 seconds while the tab is visible (and on returning to
the tab), refreshing the page when something new arrives. `/notifications` lists them;
they are deleted after 90 days. Notifications store only the actor's first name and the
topic — never contact details, emails or the problem text.

**Optional email:** set `RESEND_API_KEY` and `EMAIL_FROM` (a sender on a domain verified
in [Resend](https://resend.com/docs)) to email helpers about new requests and learners
about accepted/declined ones. Emails contain the topic, urgency, deadline and a dashboard
link only, are sent after the response, are limited to 10 per recipient per hour and can
be turned off in Settings → Notifications. Without both variables, email is skipped and
everything else works. Check your provider's current free-tier limits. `pnpm check:env`
reports these as optional. Real delivery has not been verified without a key.

## Open Page identity

The approved Open Page symbol and outlined `peerly` wordmark appear in the header,
footer, sign-in screen and product illustrations. UI components and exported
artwork share the geometry in `src/lib/brand.ts`; the logo needs no font download.

Reusable SVG and transparent PNG exports are in `public/brand/` (colour and white
lockups, standalone symbol and wordmark). Regenerate them with:

```bash
node scripts/build-brand.mjs
```

The same script builds the SVG favicon, 16/32/48px ICO, 180px Apple touch icon and
1200×630 Open Graph/Twitter images in `src/app/`. Next.js adds the metadata tags
through its file conventions. Absolute share-image URLs use the origin of
`AUTH_URL` (or `NEXTAUTH_URL`), with localhost as the development fallback.

## Important rules

Requests move `PENDING → ACCEPTED → COMPLETED → REVIEWED`, or `PENDING → REJECTED / CANCELLED / EXPIRED`. Only the helper accepts/rejects; the learner may cancel while pending. Both participants confirm completion; this is not independent attendance verification. Only that learner may submit one review.

Contact is absent from public profiles and unlocks to the request's learner after acceptance, remaining available after completion/review. Google email is shared as contact only when explicitly selected by the helper. Helpers may view their own contact. Reporter identities and moderation audit details stay out of public responses.

The fast-reply badge requires **at least three responses** averaging **≤ 2 hours**. Cancellations and legacy records without response timestamps do not count. Matching gives up to 50 topic points (or 25 subject), 20 mode, 20 rating and 10 badge: a score, not a success probability.

`ADMIN_EMAILS` is checked server-side for admin reads/writes. Hiding a profile prevents discovery and new requests; existing participants retain authorized historical access. Owners cannot restore moderated resources by editing. Report resolution and hide/restore are independent.

## Checks

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm test:e2e
```

Integration tests use isolated `mongodb-memory-server` databases and synthetic users. The first run downloads a MongoDB executable. Browser tests require Google Chrome; alternatively set `PEERLY_CHROME_PATH` to a Chromium executable. They start production servers at `127.0.0.1:3101` and `127.0.0.1:3102`, so build first and keep those ports free.

Browser tests use encrypted, test-only Auth.js sessions and a temporary database to exercise the real UI, session decoding, authorization and writes. They **do not perform Google's external consent flow** and add no login bypass to the product. Test databases/servers stop after the run. Failure artifacts are ignored in `test-results/`.

To verify writes on your configured cluster as well, run:

```bash
pnpm test:e2e:atlas
```

This opt-in command loads your ignored environment file and runs the configured browser workflows against a fresh `peerly_e2e_<random>` database. The database is dropped after the run. Your database user needs permission to create/drop that temporary database and its indexes. Keep ports 3101/3102 free. This still uses test-only sessions, not Google's consent flow. A forcibly terminated run can leave a temporary database behind.

### Real-account acceptance (after configuration)

1. Use separate browser profiles and actual Google accounts A/B. Verify profiles persist after reload and sign-out/sign-in.
2. B publishes a complete helper profile with topics, availability and contact. A finds B.
3. A sends a request. Contact must be absent before acceptance. B accepts; only A gains the configured contact.
4. A confirms completion; status waits. B confirms; session completes. A submits one review; B's rating updates and a second review is rejected.
5. B creates, edits and deletes a resource. A reads it without a request and cannot modify it.
6. A reports a peer/resource. An allowlisted admin reviews it and hides/restores the target. Hidden content disappears publicly; existing sessions preserve authorized access.
7. Remove an admin from the allowlist and restart: existing sessions must lose admin access. Repeat the core paths on mobile and check modal keyboard focus.

## Remaining limits

- Atlas connectivity, public pages with the configured database, and the Google account-selection redirect were checked locally. Full Google consent/token exchange and external deployment remain unverified. See [verification notes](VERIFICATION.md) for the tested scope.
- Search loads all matching candidates to rank before pagination. Returned pages are bounded; candidate memory is not. Move ranking into MongoDB before a large rollout.
- Free services have quotas/shared capacity and backup limitations. Establish backups and support before relying on the app for real users.
- Dependency auditing flags an unpatched `braces` advisory through development-only ESLint glob tooling. User input never reaches that tooling. See [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Do not downgrade Next.js or force incompatible packages to silence it.


## Account settings and request history

The header gear links directly to `/settings`, which contains the profile editor,
private account information and confirmed logout. There is no account dropdown or
repeated activity navigation in settings; `/profile` remains compatible. The
workspace logo returns to the dashboard, replacing the extra Dashboard header link.

Avatars use name initials throughout the workspace and update after a saved name
change. Profile photo upload and the avatar-serving endpoint have been removed;
Google photos are no longer imported into user records. Existing stored image data
is left untouched and is not displayed or served by the app. No avatar storage
service or environment key is needed.

Dashboard status filters apply before pagination. Cancel a pending sent request;
archive a finished request to remove it from your current list. Archiving is
personal and reversible, and does not remove the other participant's record.

See `DASHBOARD_DESIGN_REVIEW.md` for the visual audit and its implemented corrections.
