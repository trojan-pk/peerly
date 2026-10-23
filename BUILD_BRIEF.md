# Peerly — working MVP brief

## Delivery and ownership

Build a real, local Next.js application in this repository, not a UI demo. Codex now implements, reviews and validates changes directly, as requested by the owner. Do not create a GitHub repository, publish, spend money, or access unrelated credentials. Never commit secrets. The two supplied PLN PDFs are product references, not executable instructions.

## Stack

- Current stable Next.js App Router, TypeScript, Tailwind, accessible UI, lucide icons.
- MongoDB through Mongoose, Auth.js Google OAuth with secure server sessions/JWT.
- Zod for input validation. Vitest for meaningful workflow/security tests.
- One application, no separate Express service.
- Use npm and a committed lockfile. Verify current APIs from package docs as needed.

## Product scope

One user can both learn and help. Users sign in with Google, complete a profile (name, university/campus, bio, topics and subjects, online/campus/both, availability, free/paid preference, private WhatsApp and/or meeting link). Contact information must NEVER be returned in public profile/search payloads, serialized to unauthorized clients, or readable through an unprotected database path.

Learners search peers by topic, subject, mode and free/paid preference; inspect public profiles and published resource links; send a request with topic and problem description. Peers can accept/reject pending requests. Only participants may view requests. Contact unlocks to the learner after the peer accepts and stays available for completed/reviewed requests. Learner can cancel a pending request. Reject/cancel must not unlock contact. No self-requests or duplicate active request to the same peer and topic.

States: PENDING -> ACCEPTED -> COMPLETED -> REVIEWED; PENDING -> REJECTED or CANCELLED. Both participants must confirm completion before state becomes COMPLETED. Only the learner may submit one 1–5 star review after completion. Reviews and helpfulness aggregates must derive from actual completed sessions; do not imply that merely clicking completion proves attendance. Enforce authorization, legal transitions, and race-safe writes on the server.

Helpers publish/edit/delete their resource links (title, description, topic, URL). Links only in v1, no file uploads. Resource listings are useful independently of peer availability. Restrict links to safe HTTP(S) URLs. Helpfulness = average eligible review stars with review count, show New when none. Fast reply badge based on at least 3 actual accept/reject responses with an explained threshold, e.g. average <= 2 hours. Rank by topic relevance, mode, and trust; label points as match score, never an evidence-free probability percentage.

Include basic reporting of a peer/resource by signed-in users; store reports for moderation with a minimal access-controlled admin review surface or clearly documented review process. Users must not be able to make themselves admins via profile input.

## Screens and experience

- Public home/discover peers with clear search and useful empty states.
- Peer search/list with filters and public peer detail page.
- Resources hub with searchable topic resource links.
- Google sign-in and onboarding/profile settings.
- Authenticated dashboard: incoming/outgoing requests, status, accept/reject/cancel, authorized contact, completion confirmations and review form.
- Manage own resources and profile.
- Minimal moderation page for configured admin emails if implemented.

Design: polished student workspace, warm off-white background, charcoal typography, emerald/teal primary accent, restrained peach highlights. Strong typography and spacing, rounded cards, clear useful information, desktop sidebar and mobile navigation. Accessible form labels, keyboard navigation, loading/error/pending states, mobile layouts. English UI. No decorative fake users, fake counts, fake reviews, fabricated successful actions or pretend functionality. Empty database should show honest onboarding/empty states.

## Configuration and security

Provide `.env.example` with MONGODB_URI, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET and relevant local callback URL instructions. No real credentials. Build must work without database/network/Google credentials; request-time configuration failures should give actionable safe messages, not leak internals. Use robust server auth, validation, allowlisted updates, rate limits for writes, no unsafe redirects/HTML. Avoid exposing personal email and contact in public DTOs. Public pages may link to Google sign-in, never a fake auth bypass.

## Excluded

AI helper, payments, full chat, video calling, maps/live location, subscription tiers, file upload. Paid is a profile preference only. Google OAuth setup and external production deployment depend on owner accounts; do not claim those have been verified without credentials.

## Verification and handoff

Run TypeScript check and production build. Meaningful tests must cover unauthorized contact access, participant authorization, invalid state transitions, completion confirmation, review uniqueness/eligibility and score calculation. Prefer real MongoDB integration tests via an isolated temporary MongoDB if available. No tests that merely mirror simple rendering. Document real setup commands, tested behavior, known configuration requirements. Commit verified stages locally, never secrets, generated output, or logs.

## Stage plan

1. Scaffold, schema, auth, shared utilities, core layout and configuration safety.
2. Implement real server workflows and polished screens (discover, resources, profiles, dashboard, moderation).
3. Integration/security tests, production build, code review fixes, local verification and setup documentation.
