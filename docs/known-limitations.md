# Known limitations

What has and has not been verified, and the current limits of the free services Peerly relies on.

## Remaining limits

- Atlas connectivity, public pages with the configured database, and the Google account-selection redirect were checked locally. Full Google consent/token exchange and external deployment remain unverified.
- Search ranking runs inside MongoDB (aggregation with a per-candidate `$lookup` of request stats), so only one page is loaded into the app. It is tested with 5,000 profiles; for much larger directories consider caching per-helper stats.
- Real email delivery (alerts, university codes), importing `.ics` files into calendar apps and live Jitsi calls were not tested end to end.
- Notifications already in other members' inboxes keep a deleted user's first name until they expire (90 days).
- Free services have quotas/shared capacity and backup limitations. Establish backups and support before relying on the app for real users.
- Dependency auditing flags an unpatched `braces` advisory through development-only ESLint glob tooling. User input never reaches that tooling. See [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Do not downgrade Next.js or force incompatible packages to silence it.
