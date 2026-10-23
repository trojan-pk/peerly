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
npm run check:env -- --connect
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run test:e2e:atlas
npm start
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
