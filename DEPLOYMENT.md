# Deployment checklist

Peerly is a Next.js Node server (`pnpm build` then `pnpm start`), not a static export.
Nothing in this repository has been deployed; work through this list on your host.

## Before the first deploy

- [ ] **Host:** a Node 22.18+ runtime (e.g. Vercel, Render, Railway, a VM). Vercel Hobby
      terms restrict commercial use.
- [ ] **Install:** `corepack enable && pnpm install --frozen-lockfile`.
- [ ] **Environment** (host settings, never in git): `MONGODB_URI`, `AUTH_SECRET` (new
      random value per environment: `openssl rand -base64 32`), `AUTH_GOOGLE_ID`,
      `AUTH_GOOGLE_SECRET`, `AUTH_URL=https://<your-host>`, `ADMIN_EMAILS`. Optional:
      `RESEND_API_KEY`, `EMAIL_FROM`.
- [ ] Run `pnpm check:env --connect` with the production values from a trusted machine.
- [ ] **Google OAuth client:** add `https://<your-host>` as an authorised JavaScript origin
      and `https://<your-host>/api/auth/callback/google` as a redirect URI. Review the
      consent-screen audience before inviting students outside the test-user list.
- [ ] **MongoDB Atlas:** restrict Network Access to the host's outbound addresses; use a
      database user limited to the Peerly database; plan backups (not included on M0).
- [ ] **Email (optional):** verify the sending domain in Resend; `EMAIL_FROM` must use it.
      Without email, university verification is unavailable and alerts are in-app only.
- [ ] **Catalogue:** sign in with an `ADMIN_EMAILS` account, open `/admin/universities`
      and add your university with its student email domains.

## Verify after deploy

- [ ] `https://<your-host>/` loads; response headers include `Content-Security-Policy`
      with a nonce, `Strict-Transport-Security`, `X-Frame-Options: DENY`.
- [ ] Sign in with two real Google accounts and run the real-account acceptance steps in
      the README (request, accept, contact unlock, schedule, completion, review).
- [ ] Open the browser console on a few pages: no CSP violation messages.
- [ ] If email is configured: send a request (helper receives an email) and verify a
      university address (code arrives, badge appears).
- [ ] Download an `.ics` file and import it into a calendar app; open a Jitsi link.
- [ ] Export your data and confirm the file contents; test account deletion on a
      throwaway account.

## Operations

- Rotating `AUTH_SECRET` signs everyone out.
- Removing an address from `ADMIN_EMAILS` (and restarting) revokes admin access at once.
- Rate limits, notifications (90 days) and verification codes expire via MongoDB TTL
  indexes; no cron job is required. Request expiry is applied lazily on use.
- Run `pnpm audit` and update dependencies regularly; pin exact versions.
