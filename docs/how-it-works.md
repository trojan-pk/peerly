# How Peerly works

Detailed behaviour of requests, urgency, scheduling, universities and the rules the app enforces.

## Features and boundaries

- Google sign-in, profile editing, public profiles and topic/subject/mode/pricing search.
- Explainable matching scores, real review averages and response badges.
- Requests with accept/reject/cancel, contact unlocking and two-participant completion.
- One learner review per completed session, enforced atomically.
- Public resource links, personal management and ownership checks.
- Reports and `/admin/reports` with reversible moderation.
- Server validation, private/public DTO separation and database-backed write throttling.

No payment processing, hosted video service, resource file uploads or AI answers. A paid preference is informational; users arrange any terms directly. Use public campus spaces for physical sessions.

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

## Workspace speed and keyboard use

Dashboard actions (accept, decline, cancel, confirm completion, review) update the card
immediately with React's `useOptimistic`; if the server rejects the change or can't be
reached, the card returns to its previous state and an error toast explains why. Results
are announced through the toast live regions. With the "All statuses" filter, requests are
grouped into **Needs your response / Waiting for a reply**, **Active sessions** and
**History**, urgent requests first.

Press **Ctrl K / ⌘K** (or the header Search button) for the command palette: pages,
discoverable peers, topics and your own requests. It returns public peer fields only and
is rate-limited. Press **?** for shortcut help. Tab to a pending request sent to you and
press **A** to accept or **R** to decline.

## Universities, courses and university email

Admins (`ADMIN_EMAILS`) manage universities and their email domains at
`/admin/universities` (Catalogue). In Settings, members choose their university and the
courses they can help with, or add a missing course: codes are normalised (`cs 101` →
`CS-101`), unique per university and rate-limited. Admins can hide courses or merge a
duplicate into another; helpers, requests and resources move to the target. Peer search
has a Course filter, and a query that is a course code (e.g. `CS101`) matches it. A course
match earns the same 50 points as an exact topic match. Requests and resources can
optionally carry a course, which must be one the helper/owner lists. Free-text topics,
subjects and existing profiles keep working.

**University email verification** (needs the optional email settings): a member enters an
address on an allowlisted domain (or subdomain) and receives a 6-digit code. Codes are
stored as salted SHA-256 hashes, expire after 10 minutes, allow 5 attempts, are single-use
and rate-limited; one account per address. Profiles then show **"University email
verified"** with the university name — never the address. It shows control of an address
on that domain, not current enrolment. Without email configured the section explains that
it's unavailable.

## Sessions, notes and helper pages

**Scheduling:** on an accepted request either person suggests up to three start times
(10 minutes to 60 days ahead, 30–120 minutes long); the other picks one. Each pick is
conditional on the same suggestions still standing, so only one choice can win, and a
new suggestion clears the agreed time. Both get bell notifications. **Add to calendar**
downloads an RFC 5545 `.ics` file (`/api/requests/[id]/ics`, participants only, UTC times
converted by your calendar app; the event updates in place when rescheduled).

**Video call:** online sessions get a one-click Jitsi Meet link
(`https://meet.jit.si/peerly-<128-bit random>`), created once and shared by both
participants; it appears only on their dashboards and calendar file. meet.jit.si is a
free public service; its own terms apply and the first person joining may be asked to
sign in to start the meeting.

**Helpful votes:** members can mark resources helpful (one vote each, not your own,
undoable, rate-limited) and sort the library by **Most helpful**.

**Public helper page (opt-in):** Settings → Shareable helper page publishes `/h/<slug>`
with name, university, verified-university badge, courses, topics and numbers derived
from stored data: completed sessions, average rating and review count, and typical
response time. It never shows email, contact details, review text or request content,
asks search engines not to index it, has its own share image, and returns 404 when off or
when the profile is hidden by moderation.

## Important rules

Requests move `PENDING → ACCEPTED → COMPLETED → REVIEWED`, or `PENDING → REJECTED / CANCELLED / EXPIRED`. Only the helper accepts/rejects; the learner may cancel while pending. Both participants confirm completion; this is not independent attendance verification. Only that learner may submit one review.

Contact is absent from public profiles and unlocks to the request's learner after acceptance, remaining available after completion/review. Google email is shared as contact only when explicitly selected by the helper. Helpers may view their own contact. Reporter identities and moderation audit details stay out of public responses.

The fast-reply badge requires **at least three responses** averaging **≤ 2 hours**. Cancellations and legacy records without response timestamps do not count. Matching gives up to 50 topic points (or 25 subject), 20 mode, 20 rating and 10 badge: a score, not a success probability.

`ADMIN_EMAILS` is checked server-side for admin reads/writes. Hiding a profile prevents discovery and new requests; existing participants retain authorized historical access. Owners cannot restore moderated resources by editing. Report resolution and hide/restore are independent.

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
