# Peerly verification — 23 October 2026

## Automated checks

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| ESLint | Passed |
| Production build | Passed |
| Vitest integration/unit suite | 181 tests passed across 15 files |
| Browser suite, isolated local MongoDB | 6 tests: auth routes, request/review, resources/moderation, private routes, dark landing, missing configuration |
| Browser workflows, configured Atlas cluster | 3 passed before the visual refresh; temporary databases removed |
| Runtime dependency audit | Zero reported vulnerabilities |
| Configured credentials in repository candidate files | None found |

The authenticated browser flows cover profile persistence, a learner's request,
helper acceptance, contact unlock, two-party completion and a single review. They
also cover resource creation/edit/deletion, reporting, admin hide/restore/resolution,
keyboard focus, responsive layouts and private-route boundaries. The separate
unconfigured-server test verifies that missing credentials fail closed.

## Checks with the owner's configuration

- Every required environment variable passed the local configuration check. Secret
  values were never printed; the environment file is ignored by Git.
- The configured MongoDB connection and ping succeeded.
- The production app was started at `http://localhost:3000` using the real environment.
- Home, peer discovery, resources and login rendered successfully. Private areas
  presented signed-out states; the admin route redirected to login.
- Mobile width 390px had no horizontal overflow; the browser emitted no uncaught
  page errors during the public-route check. Desktop/mobile screenshots were reviewed.
- Clicking the actual Google sign-in button reached Google's sign-in screen at
  `accounts.google.com/v3/signin/identifier`, without a visible client/callback error.
- All three configured browser workflows also passed against the actual Atlas cluster
  in fresh random temporary databases. Teardown removed those databases successfully.
  Resource editing now explicitly waits for the server save confirmation before
  checking persistence, avoiding a test timing race exposed by network latency.

## What these checks do not prove

The browser workflow tests issue encrypted sessions inside the test runner and
use temporary databases. They add no login bypass to the application. The Google
redirect check stops at Google's sign-in screen: a real account still needs to
complete consent and the OAuth token exchange. The OAuth client secret cannot be
fully verified by reaching that screen alone.

The running URL is local to this computer. Public hosting and an HTTPS domain have
not been configured. Search candidate ranking, free-tier capacity and the known
development-tool dependency advisory remain documented in the README.

## Google callback correction

The owner's first real Google callback exposed an HTTP 500 caused by constructing
a native request from the App Router's proxied request. The auth boundary now
rebuilds an unproxied `NextRequest` from its URL, method, headers, body and signal.
No authentication checks or OAuth protections were relaxed.

After rebuilding and restarting, live session/providers/CSRF endpoints returned
HTTP 200 and an invalid callback redirected safely instead of crashing. A new
production-server regression verifies those GET routes, a CSRF-protected sign-out
POST (including its body), and callback redirection. It passed, alongside the four
existing browser workflows and 33 focused auth tests. Completing a fresh Google
sign-in with the owner's account still needs confirmation.

## Dark product design

The approved refresh uses shared dark colour tokens across landing, discovery,
profiles, requests, resources and moderation. The landing now includes working
search/subject links, a custom SVG topic network, an accessible keyboard-controlled
workflow, resource artwork, real public profiles or an honest empty state, native
FAQ disclosures and clear next actions. It does not add fabricated social proof.

Manrope and its OFL license are stored locally. Connecting paths, tab transitions
and one-time section entrances respect reduced-motion preferences. Section entrance
styles are applied only after hydration; there is no animation-library dependency.

The browser checks exercise actual search results without exposing contact details,
workflow keyboard navigation, FAQs, dark rendering under a light system preference,
reduced motion and widths 320/390/768/1024/1440. Screenshots of profile editing,
resource publishing, dashboard and admin moderation were visually reviewed. A live
public-route check recorded no uncaught browser errors and no overflow at 390px.
The initial viewport-resize check was corrected to wait for responsive layout;
topic orbits and resource artwork were also constrained at narrow widths.

## Reproduce

```bash
pnpm check:env --connect
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm test:e2e:atlas
pnpm start
```

The Atlas check creates a random `peerly_e2e_<random>` database and removes it on
teardown. It never seeds or drops the application database. The ordinary browser
suite uses a local temporary MongoDB instead. See the README for requirements.

## Colourful landing and login-first entry revision

The latest owner-approved flow supersedes the earlier public directory/landing
search design: one marketing page contains Features, How it works and Resources.
Visitors enter through login; Google sign-in returns to the dashboard. Peer search,
peer detail, resource listings and other workspace pages redirect signed-out users
to login. The landing no longer loads member/profile data.

The revised visual system adds purple/blue/sky section transitions, a floating
navigation capsule, animated aurora layers, pointer-responsive product artwork,
a subject dock, a selectable resource deck, workflow tabs and pause/reduced-motion
controls. Desktop and mobile screenshots were reviewed.

Browser checks cover same-page section links, subject selection, resource switches,
keyboard workflow navigation, FAQs, pausing, reduced motion, responsive widths and
the login entry point, alongside existing request/review and moderation flows.
The resource interaction check uses the visible category switcher, rather than
clicking through the overlapping illustration cards.

## Motion and hover polish

Added frame-batched pointer lighting and shallow 3D tilt to feature cards, a
proximity-responsive subject dock, resource-card highlights, button light sweeps,
Lucide stroke/hover treatments, hero connection trails and staggered card entrances.
Decorative symbol glyphs were replaced with consistent Lucide artwork.

Pointer lighting ignores touch and reduced-motion users. Pause disables feature
rotation, dock magnification and decorative pseudo-element animations. The browser
regression checks that pointer coordinates update the hovered feature, and continues
to check section links, cards, workflow controls, pause, reduced motion and login.
Desktop hover and mobile screenshots were reviewed against the production build.

## Design audit correction

The owner requested a whole-page critique and removal of the floating animation
control. See `LANDING_DESIGN_REVIEW.md` for measured typography, hover behaviour,
section-specific findings and the recommended art-direction pass. The latest
revision removes the pause UI/state and independent icon wobble, anchors feature
card content and lowers the spotlight intensity. System reduced-motion remains.
The browser regression now verifies stable icon positioning and absence of that UI.


## Completed landing recomposition

The owner approved the full art-direction scope from `LANDING_DESIGN_REVIEW.md`.
The landing now leads with university peer study help and a topic-based discovery
scene. Subject controls and the resulting example share one panel. The repetitive
four-card feature grid is replaced with an interactive pending/accepted request
story and two distinct supporting sections. Resource examples have specific titles,
topics, link types and readable outlines, with one visible selection at a time.
The workflow uses the member workspace's dark visual language. FAQ and final action
copy are direct; the oversized question-mark decoration is removed.

Feature icons remain anchored, independent of hover. Pointer handling now only
updates the feature surface highlight; there is no dormant card-tilt machinery.
There are no infinite decorative loops. A single connection-line drawing, one-time
section entrances and explicit state changes provide motion, with system reduced
motion respected. Preview content is illustrative and labelled; no real member
records or contacts are loaded by the landing page.

The production build and all six browser tests passed after the recomposition,
including the private request/review flow, resource moderation and missing-config
behaviour. The landing regression additionally exercises privacy states, campus
preference, concrete resource content, subject/result adjacency, fixed hover icons,
absence of the pause control, no infinite animations, reduced motion, responsive
widths 320/390/768/1024/1440 and login entry. Visual QA found and corrected a
preview-logo sizing defect, a wrapping workflow number and uneven privacy-control
labels on narrow screens. A final focused landing rerun covers the corrections.

## Open Page brand rollout

The owner selected the third logo concept, Open Page. Its two-page symbol and
outlined lowercase wordmark now share editable geometry in `src/lib/brand.ts`.
Header/footer lockups, the login mark and product illustrations use this identity.
Colour and white SVG/transparent PNG exports are available in `public/brand/`;
`scripts/build-brand.mjs` regenerates those and the browser/social assets.

Verified the SVG icon, multi-frame 16/32/48px ICO, opaque 180px Apple icon and
1200×630 Open Graph/Twitter images. The rendered page includes the icon tags,
absolute social-image URLs, large-image Twitter card and image alt text.
Icon and share-image URLs returned HTTP 200; social-image dimensions were decoded
from the actual HTTP responses. Shared-image URLs use the configured auth origin.

Production build (including TypeScript), ESLint and both relevant browser checks
(public mobile routes/auth gates and the interactive single-page landing) passed.
Desktop, mobile, footer and login screenshots were reviewed. Logo layout was checked
at 320/390/768/1440px with no horizontal overflow or uncaught browser errors.
External social-network cache/preview rendering was not tested against a public URL.

## Clean workspace and confirmed logout

Marketing footer markup is omitted from workspace routes, including dashboard,
profile, peer discovery, resources and resource management. The shared logout
control now opens a dark warning dialog from the desktop header, mobile menu and
already-signed-in login screen. It initially focuses Cancel, traps keyboard focus,
closes on Cancel/Escape and restores focus to the trigger. Background content is
inert while the native dialog is open. Confirmation calls the existing Auth.js
server action, shows a pending state and prevents duplicate confirmation.

A browser regression verifies footer absence across workspace pages, cancellation
without ending the session, keyboard focus/escape, real session-cookie invalidation
and protected-route redirection after confirmed logout on desktop and mobile. It
also checks the signed-in login screen and that the mobile menu closes after logout.
The first keyboard run exposed reverse Tab escaping the dialog controls; an
explicit Tab wrap was added before rerunning the flow. The mobile flow also
exposed menu state surviving the logout redirect; navigation state is now scoped
to the current pathname.

Final production build/TypeScript and ESLint passed. All three relevant browser
checks passed after these corrections. Desktop and 375px mobile warning-dialog
screenshots were visually reviewed against the dark workspace styling.

## Settings, profile photos and request-history design pass

Removed the dashboard's signed-in email/role line and the resource manager's
identity banner. A desktop/mobile account settings control now groups profile,
request history, archives, resource management and confirmed logout. `/settings`
reuses the existing complete profile editor; names are refreshed from the database
in the header/dashboard. Settings include real photo upload/removal. Photos are
validated, bounded, re-encoded as 256×256 JPEG with source metadata removed, and
served through a signed-in endpoint. Photo bytes are excluded from ordinary queries.
Explicit photo removal and edited names are preserved on later Google sign-ins.

Request status filtering occurs in MongoDB before pagination. Finished requests
support per-participant archive/restore, with cancellation retained for pending
sent requests. A participant cannot archive another user's view or silently hide
an ongoing accepted session. The other participant's record, eligible contact and
review data remain intact. Outgoing responses now include the response timestamp.

See `DASHBOARD_DESIGN_REVIEW.md` for the detailed visual critique. Resource inputs
now have a single inward focus boundary instead of a ring plus offset outline.
Observed production computed styles: outline offset `-2px`, box shadow `none`.
The editor no longer repeats an empty-state card while creating a resource.
Dashboard question text, headings, copy and request/status controls were refined.

Validation: 191 unit/integration tests passed, along with TypeScript/production
build and ESLint. All existing seven browser scenarios passed. The new account
scenario initially used an unsuitable exact label-text locator for the status
select; using its accessible combobox role corrected the test. The focused rerun
passed both account/history and logout scenarios, exercising name persistence,
actual avatar upload/HTTP retrieval/removal, unauthenticated avatar denial,
request filtering/cancellation/archive/restore, responsive widths and mobile menu.
Desktop resource focus, settings and mobile account-menu screenshots were reviewed.
Browser fixtures used a temporary test database; the owner's data was not seeded.

No pause control is present in the current source. The owner's unfinished pause
reference remains an optional clarification about which other control they mean.


## Initials avatars and direct settings navigation

The owner subsequently replaced profile photos with initials. A shared avatar now
renders saved-name initials on settings, request cards, peer lists/detail pages
and resource contributors. The upload UI, upload action and avatar-serving route
have been retired. Google sign-in no longer imports photos into user records.
Legacy image records remain untouched; they are not rendered or served. The five
retired upload tests were removed and the auth regression now checks that Google
photos are not imported. The remaining 186 unit/integration tests pass.

The header has a gear-only link directly to `/settings`, with no photo, name or
account dropdown. The extra Dashboard navigation label is removed; the workspace
logo returns to `/dashboard`. Settings omit the gear self-link, activity shortcuts
and workspace footer while preserving the full editor and confirmed logout.

Browser checks exposed two real interaction races: an interactive Suspense header
fallback could lose an opened mobile menu when replaced, and overlapping history
navigation could apply a status to the previous archive view. The fallback menu
is now disabled until the account header is ready. Dashboard navigation uses a
pending transition and disables conflicting controls until it finishes. A separate
test assumption counted only new requests despite a prior workflow sharing the
temporary database; assertions now account for the existing records without
removing them.

Final validation: all 8 browser scenarios passed together on the final application
build, including saved name/initials after reload, direct desktop/mobile settings
navigation, no upload inputs or duplicate settings links, ignored legacy photos,
retired avatar endpoint returning 404, request filtering/cancellation/archive and
restore, resource focus boundaries, private route guards and confirmed logout.
Settings and resource layouts were checked for overflow at 320, 390, 768 and
1440 pixels. Desktop dashboard/settings and mobile settings screenshots were
visually reviewed. Production build, TypeScript and ESLint passed. Tests used
only a temporary MongoDB database; no owner records were changed. The production
server was restarted on localhost:3000 and the public landing returned HTTP 200.

## Peerly v2 — Phase 0: baseline and honesty fixes (26 October 2026)

Baseline before changes: TypeScript, ESLint, 186 unit/integration tests and the
production build passed. In the first full browser run the landing scenario timed
out once while resizing the viewport; a focused rerun and the subsequent full run
passed (8/8). It is recorded as intermittent; that landing is replaced in Phase 3.

- Public reviews no longer default a missing rating to five stars. Records without
  a genuine 1–5 rating are excluded from both the list and the count. The learner
  fallback name is "Student", not "Verified Student".
- Dashboard contact for accepted/completed/reviewed outgoing requests is resolved
  in one batched user lookup rather than two queries per row. The query already
  restricts rows to the signed-in learner, so authorization is unchanged.
- The empty retired avatar route directory and `avatarUpdated` field were removed.
  Legacy `avatarData` stays declared only as `select: false` so old bytes never load.

Tests added: malformed review exclusion, neutral fallback name, batched-contact
parity with the single-request resolver across all six statuses (no `findById`
calls), and no contact for unrelated users. Result: 190 tests, lint, typecheck,
build and 8/8 browser scenarios passed.

## Package manager: pnpm (26 October 2026)

The owner asked for pnpm. `pnpm import` converted the npm lockfile to the same
resolved versions; `package-lock.json` is removed and `packageManager` pins
pnpm 11.8.0. pnpm's strict layout exposed one phantom import: browser fixtures
imported `@auth/core/jwt`, a transitive dependency. They now use the identical
`next-auth/jwt` re-export, so no dependency was added. `pnpm-workspace.yaml`
allows only `mongodb-memory-server`'s install script (pre-downloads the test
MongoDB binary); others stay blocked. After a clean `pnpm install
--frozen-lockfile`: typecheck, lint, 190 tests, build and 8/8 browser tests passed.

## Peerly v2 — Phase 1: Paper & Ink design system (26 October 2026)

- `globals.css` (one 544-line file) split into tokens → base → chrome → components
  → workspace → legacy landing layers. Chrome and workspace hard-coded colours were
  mapped to semantic `--pi-*` roles; Tailwind colour utilities resolve to those
  roles, so existing workspace markup follows the active theme without rewrites.
- Light (Paper), Dark (Ink) and System themes with a no-flash inline script and an
  ARIA radio-group toggle in the header, mobile menu and Settings → Appearance.
- Fonts: Manrope, Instrument Serif (page titles) and Geist Mono as self-hosted Latin
  WOFF2 subsets (≈100 KB total vs. 165 KB for the previous Manrope TTF alone), each
  with its OFL licence. Geist Mono is not preloaded.
- `motion@14.6.0` pinned. Primitives: Button, Card, Badge, Field controls, native
  `<dialog>` Dialog, Toast (polite/assertive live regions, pause on hover/focus),
  Skeleton, EmptyState. `/dev/ui` showcase 404s in production (browser tests enable
  it with `PEERLY_UI_SHOWCASE=1`). Mobile bottom navigation; current tab is not a link.

Tests: 95 new unit checks — WCAG AA contrast for every text role on every surface in
both themes, action/accent/highlighter text, 3:1 input borders, matching role sets,
theme resolution and the pre-paint script (stored, invalid, blocked storage, live
OS changes). New browser checks: theme persists and is set before `<body>` exists,
System follows emulated OS changes, keyboard radio navigation, header/settings
toggles stay in sync; six workspace pages in both themes at 320/390/768/1024/1440
without overflow; bottom navigation; dialog focus entry, Tab wrap, Escape and focus
return; toast announcements and dismissal; reduced motion stops the highlighter.

Two issues found and fixed during verification: unlayered component CSS overrode
Tailwind's `hidden` (the header toggle showed on mobile and caused overflow), and the
dialog focused the first input instead of the marked default action. Existing tests
now scope status assertions to page content because the toast region is a global
`status` landmark. Results: 285 unit/integration tests, typecheck, lint, build and
11/11 browser scenarios passed. Desktop and mobile screenshots of both themes were
reviewed.

## Peerly v2 — Phase 2: urgent help and notifications (26 October 2026)

- Requests carry `urgency` (normal/urgent), optional `neededBy` and `expiresAt`
  (= min(deadline, 6h urgent / 72h normal)). New `EXPIRED` status, applied lazily with a
  per-record conditional update; accept/decline also require an open window. A stored
  `priority` key sorts urgent pending → normal pending → resolved; legacy rows are
  backfilled on dashboard load.
- `Notification` model (unique per recipient/event, TTL 90 days), `/notifications`
  inbox, header bell with 60-second visible-tab polling and refresh on new items.
- Optional Resend email via `fetch` (5 s timeout, HTML escaped), sent after the
  response with `after()`, 10/hour per recipient, Settings opt-out switch.

Tests: 34 new unit/integration checks — deadline validation edges, countdown formatting,
expiry maths, priority ordering and legacy defaults, expired accept/decline refusal and
honest message, re-requesting the same helper/topic, legacy 72h expiry, badge exclusion,
concurrent accept/expiry (exactly one winner, one expiry notification), one notification
per event across the full lifecycle, duplicate-delivery idempotency, no contact/email/
problem text in stored or listed notifications, recipient-only read/mark, signed-out
behaviour, notification failure not failing the action; email skipped when unconfigured,
recipient/subject/link/deadline/escaping, accept/decline only, opt-out, hourly ceiling,
provider timeout. Browser: urgent request with deadline → helper bell updates without
reload → card first with Urgent badge, countdown and deadline → inbox → click-through →
accept → learner bell; overdue request cannot be accepted, learner offered another
helper and notified; email preference persists.

Browser-run note: two full runs failed when headless Chrome's GPU process crashed and
froze pages (`GPU process exited unexpectedly`). Tests now launch Chrome with
`--disable-gpu`; two consecutive full runs then passed. Results: 319 unit/integration
tests, typecheck, lint, build and 14/14 browser scenarios. Real email delivery was not
tested (no provider key); the HTTP request shape is covered with a mocked `fetch`.

## Peerly v2 — Phase 3: Paper & Ink landing and login (26 October 2026)

- New landing (`src/app/page.tsx`, `src/components/landing/{HeroScene,HowItWorks,PrivacyReveal}`,
  `src/app/styles/marketing.css`): hero with one Motion sequence (plays once, Replay,
  final state under reduced motion), "11 PM problem", sticky scroll-driven How it works
  with keyboard-selectable steps, privacy before/after toggle, link-only resource example,
  helper section, FAQ with expiry/urgent answers, final CTA. Theme-aware; old purple
  landing components and its 380-line stylesheet were removed. Login is a two-column
  Paper & Ink page; signed-in, unconfigured and error states are unchanged.
- Layout-shift fix: the root `loading.tsx` skeleton flashed before the landing (measured
  CLS 0.35). Loading skeletons now live in workspace routes only, and the landing's calls
  to action resolve the session inside their own Suspense boundaries with identical
  labels, so nothing moves. Measured CLS 0.002, LCP 0.56–0.63 s (local, desktop).
- Motion's DOM features now load asynchronously; the unused serif italic font was removed.
- Lighthouse 12.8.2 (run via `pnpm dlx`, not a project dependency) on a local production
  server: desktop preset Performance/Accessibility/Best practices/SEO 100/100/100/100
  (LCP 0.8 s, CLS 0); mobile with DevTools throttling 92/100/100/100 (LCP 1.9 s, TBT
  310 ms). Mobile with default simulated throttling scores 87 (simulated LCP 3.6 s while the
  observed LCP in the same trace was 1.27 s). Found and fixed: `role` on `<ol>` toast
  lists and a heading-order skip in the hero scene.
- Browser tests: section anchors, hero sequence + Replay, privacy toggle (no number before
  acceptance), keyboard step selection, FAQ, no workspace links or infinite animations, both
  themes at 320/390/768/1024/1440 without overflow, login entry and layout, no console
  errors; reduced motion; LCP < 2.5 s and CLS < 0.1. 320px header overflow (8 px) fixed.
  Id-based form locators now target visible elements because streamed Suspense content can
  briefly exist twice in the DOM. Results: 319 unit/integration tests and 16/16 browser
  scenarios on two consecutive runs; typecheck, lint and build passed.

## Peerly v2 — Phase 4: workspace UX (26 October 2026)

- Dashboard: `useOptimistic` for accept/decline/cancel/confirm/review with toast feedback
  and automatic rollback; inline success/error banners replaced by the toast live regions.
  Sections (Needs your response / Waiting for a reply, Active sessions, History) when no
  filter or archive view is active. Cards are focusable articles named by their topic with
  `aria-keyshortcuts`; A/R accept/decline a focused pending incoming request.
- Command palette (Ctrl/⌘K, header button, mobile menu entry): ARIA combobox + listbox with
  `aria-activedescendant`, debounced `searchWorkspace` server action (auth required,
  60/min, 60-char limit, regex-escaped) returning discoverable peers' public fields, topics
  and only the caller's requests. `?` opens shortcut help except while typing.

Tests: 5 new integration tests (signed-out/short/non-string queries return nothing, own
requests only, hidden profiles excluded, no contact/email in results, literal regex
characters, helper-side tabs). Browser: sections render; an accept whose server call is
held then aborted shows Accepted immediately, then reverts to Pending with an error toast
and the database unchanged; keyboard A accepts and moves the card to Active sessions;
palette keyboard search → Enter navigates to the request anchor, arrow selection, Escape,
header trigger, `?` help, `?` typed in a field ignored. A 320px header overflow from the
new search icon was fixed (icon moves into the mobile menu below 420px). Results: 324
unit/integration tests and 18/18 browser scenarios on two consecutive runs.

## Peerly v2 — Phase 5: courses and university email (26 October 2026)

- Models: `University` (unique slug, ≤10 domains, hidden flag), `Course` (unique
  university+code, hidden, `mergedInto`), `EmailVerification` (one per user, salted hash,
  TTL). User gains `universityRef`, `courses`, `courseCodes`, private `universityEmail`
  (partial unique index), `verifiedUniversityName`. Requests/resources gain optional
  `course`/`courseCode`. Public DTOs add `courseCodes` and `verifiedUniversityName` only.
- `/admin/universities` (admin-only on every action), Settings sections for university &
  courses and university email, course filter and chips on peers, course select on the
  request form and resource editor, course chip on dashboard and resource cards.

Tests: 33 new — code normalisation (accept/reject cases), domain/subdomain/look-alike
matching, course scoring and legacy topic scoring; de-duplication incl. concurrent adds
and per-university codes, creation rate limit, saving only own-university visible courses,
admin-only management, hide/merge moving users/requests/resources and redirecting merged
codes; course filter, code queries, legacy topics; request/resource course ownership;
verification unavailable without email, domain rejection, hashed storage, public badge
without address (profile, search, reviews), replay refusal, 5-attempt lock under 8
parallel guesses, expiry, one account per address, send rate limit, no code/hash in logs.
Browser: admin adds a university → helper adds “cs 101” (shown as CS-101) and saves →
learner filters by course and by “CS101” → requests with the course → admin sees one
helper, hides the course and the filter disappears; non-admin blocked; seeded verified
badge visible without the address; email-off explanation. Cross-suite pending requests
exposed ambiguous locators in older tests (now scoped to the specific request card), and
the palette shortcut test now waits for hydration. Results: 357 unit/integration tests and
20/20 browser scenarios on two consecutive runs. Real verification email delivery was not
tested (no provider key).

## Peerly v2 — Phase 6: sessions, helpful votes and public helper pages (26 October 2026)

- Scheduling fields on requests (`proposedSlots`, `proposedBy`, `sessionDurationMinutes`,
  `scheduledAt`, `scheduleSequence`, private `meetingRoom`), `SESSION_PROPOSED` /
  `SESSION_SCHEDULED` notifications with the recipient's dashboard tab, `SessionPlanner`
  on dashboard cards, `/api/requests/[id]/ics` route, `lib/ics.ts` writer.
- Jitsi link: `peerly-` + 32 hex characters (128 bits from `crypto.randomBytes`), set once
  with a conditional update so concurrent clicks share one room.
- `ResourceVote` (unique user+resource) and `Resource.upvoteCount`; Most helpful sort.
- Opt-in `/h/[slug]` page with `next/og` share image; `publicPageEnabled`/`publicSlug`
  (partial unique index); slug kept when turned off so links stay stable.

Tests: 18 new — ICS date format, text escaping, 75-octet UTF-8-safe folding, CRLF and
single-event structure; propose/choose with notifications to the right person and tab,
proposer can't pick own time, unknown slot refused, input validation (count, past, >60 days,
duplicates, no timezone, bad length), non-participant/pending/signed-out refusal,
exactly one of two concurrent picks, re-proposal clears and sequence increments; ICS route
200 with UTC start/end, UID, sequence, meeting link and no contact/email/problem text; 404
for non-participants/unscheduled/invalid ids and 401 signed out; one shared room under
concurrency, distinct per request, visible only on participants' dashboards; votes once per
member, owner refused, undo, counter equals vote rows under concurrent toggles, hidden
resources refused, sort order and viewer flag; public page off by default, stable slug,
404 when off/hidden/invalid, derived stats ignoring cached counters, no secrets, complete
profile required. Browser: two users schedule a session, both see the same Jitsi link,
`.ics` downloads for a participant, 404 for another member and 401 signed out; helpful
vote persists and reorders; public page toggled on, viewed signed-out (noindex, OG image
returns PNG, no contact), toggled off → 404. Results: 375 unit/integration tests and 23/23
browser scenarios on two consecutive runs. Calendar import into real Google/Apple
Calendar apps and joining a live Jitsi call were not tested.

## Peerly v2 — Phase 7: hardening and launch readiness (26 October 2026)

- **Search in MongoDB:** `src/lib/peer-ranking.ts` computes the match score, rating,
  review count and fast-reply badge in an aggregation (`$lookup` of request stats,
  `$regexMatch` normalised tag equality, half-up rounding to match `Math.round`), sorts
  with the documented tie-breakers and applies `$skip/$limit` in the database. Only the
  page's ≤12 users are loaded; breakdowns are still computed with `calculatePeerMatchScore`.
- **Account:** JSON export route, typed-confirmation deletion that anonymises
  counterparts' records ("Deleted user"), redacts text the deleted person wrote, keeps
  ratings, cancels open requests and keeps vote counters consistent.
- **Security:** nonce CSP via `src/proxy.ts`, nonce on the theme script, COOP and an
  extended Permissions-Policy, HSTS/`upgrade-insecure-requests` only for HTTPS `AUTH_URL`.
  `pnpm audit` (prod and dev): no known vulnerabilities on 26 October 2026.

Security checklist for new server entry points (Phases 2–7):

| Entry point | Auth | Ownership / role | Validation | Rate limit |
| --- | --- | --- | --- | --- |
| notifications: unread, mark, mark all, email alerts | requireAuth | recipient only | ObjectId, boolean | 120/20/10 per min |
| palette search | requireAuth | own requests; public peer fields | ≤60 chars, regex-escaped | 60/min |
| courses: list, add, save | requireAuth | own profile; visible own-university courses | code/domain normalisers | 60/min, 10/h add, 10/min save |
| catalogue admin actions | requireAdmin (ADMIN_EMAILS) | admin | domains, names | 60/min |
| university email send / confirm / remove | requireAuth | self | allowlisted domain; 6 digits | 3/10 min + 5/h per address; 10/10 min; 5 attempts |
| sessions: propose, choose, meeting | requireAuth | participant, ACCEPTED (meeting: accepted/completed) | ISO with offset, 10 min–60 days, set durations | 10/10/20 per min |
| `/api/requests/[id]/ics` | requireAuth (401) | participant else 404 | ObjectId | — (read-only) |
| resource upvote | requireAuth | not own, visible resource | ObjectId, boolean | 30/min |
| public page toggle / `/h/[slug]` | requireAuth / public | self; page 404 unless enabled & visible | slug pattern | 10/min |
| account export / delete | requireAuth | self only (no id accepted) | literal "DELETE" | 5/h, 3/h |

Tests: 18 new unit/integration — ranking parity with the in-memory reference on a
seeded 150-profile dataset (8 query shapes incl. mode, subject, course filter, course-code
query and whitespace normalisation; shared timestamps exercise the `_id` tie-breaker),
non-overlapping pages, 5,000 candidates ranked with a single 12-id user fetch (~1.8 s
locally); CSP directives; export contents and privacy, export route auth/headers; typed
confirmation and self-only deletion; no residual personal data; counterpart history,
ratings and reviews intact; idempotent deletion. Browser: headers and a unique nonce on
seven pages, nonce on the theme script, client interactions with no CSP violations, an
injected nonce-less inline script is blocked; export → delete → signed out → helper still
sees the review as "Deleted user" without the deleted text; full journey (urgent request,
bell, accept, scheduling, Jitsi, `.ics`, completion, review, helpful vote, verified badge,
public page) with the learner in Ink at 1280px and the helper in Paper at 390px. Two
suites left records for the shared helper and broke older locators; the journey and
helpful-vote tests now remove what they create. Results: 393 unit/integration tests and
26/26 browser scenarios on two consecutive runs; typecheck, lint and build passed.
