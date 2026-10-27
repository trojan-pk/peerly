# Configuration and hosting

Everything you need to set up the database, Google sign-in and (optionally) email for Peerly.

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

There is no paid AI, payment, file-upload or video service. Email is optional (Resend's free tier is enough to start); video calls use the free public meet.jit.si. Local development and Atlas Free can be used without a hosting subscription. Basic Google OAuth uses the credentials above; no paid identity platform or cloud-compute product is required for this setup.

[Vercel Hobby](https://vercel.com/docs/plans/hobby) is free within its limits for personal, non-commercial projects. Its terms restrict commercial use; choose a suitable paid/alternative host for a commercial service. A custom domain is optional. Provider prices and quotas can change.

This is a **Next.js Node application**, not a static export. It requires a server runtime with MongoDB connectivity. Build with `pnpm build`, run with `pnpm start`. The repository has not been published or deployed by this setup.
