# Testing

How to run the automated checks and the manual acceptance checklist.

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
