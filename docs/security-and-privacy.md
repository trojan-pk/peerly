# Security and privacy

What data Peerly keeps, how users can export or delete it, and the security headers the app sends. To report a vulnerability see [SECURITY.md](../SECURITY.md).

## Account data and security

Settings → Your data offers **Download my data** (`/api/account/export`, JSON of your
profile including private fields, requests, resources, votes, notifications and reports
you filed; other people's private data is never included) and **Delete account** (type
DELETE to confirm). Deletion removes your profile, resources and votes on them, your votes,
notifications, reports you filed and pending verification codes; cancels your open
requests; erases problem descriptions and review comments you wrote while keeping star
ratings so helpers' averages don't change. Other participants keep their history, shown
with "Deleted user". Signing in again later creates a new, empty account.

Every HTML response carries a per-request nonce Content-Security-Policy from
`src/proxy.ts` (`src/lib/csp.ts`): scripts only from this origin or with the nonce
(`'strict-dynamic'`), no `unsafe-eval` in production, `frame-ancestors 'none'`,
`object-src 'none'`, `base-uri 'self'`. All responses send `X-Content-Type-Options`,
`X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` and
`Cross-Origin-Opener-Policy`; HSTS and `upgrade-insecure-requests` are added when
`AUTH_URL` is HTTPS. The inline theme script carries the nonce. Styles allow inline
attributes because React and Motion render `style` props. See [DEPLOYMENT.md](../DEPLOYMENT.md)
for a production checklist.
