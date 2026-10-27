# Contributing to Peerly

Thanks for helping make Peerly better. This guide explains how to set up the
project, how we work, and what a good pull request looks like.

By participating you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
Contributions are released under the project's [MIT License](LICENSE).

## Ways to contribute

- Report a bug or suggest a feature by opening an issue.
- Improve documentation or fix typos.
- Pick up an issue labelled `good first issue` or `help wanted`.
- Review open pull requests.

For anything security related, do **not** open a public issue. See
[SECURITY.md](SECURITY.md).

## Development setup

Requirements: Node.js `>=22.18.0` and pnpm `>=11`.

```bash
git clone https://github.com/trojan-pk/peerly.git
cd peerly
pnpm install
cp .env.example .env.local   # then fill in the values, see README.md
pnpm dev
```

The README explains where to get the MongoDB Atlas connection string and the
Google OAuth credentials. Never commit `.env` or `.env.local`.

## Workflow

1. **Open or find an issue first** for anything bigger than a small fix, so we
   can agree on the approach before you spend time on it.
2. **Fork** the repository and create a branch from `main`. Nobody pushes
   directly to `main`; every change goes through a pull request.
3. Use a descriptive branch name: `feat/short-name`, `fix/short-name`,
   `docs/short-name`, `chore/short-name`.
4. Make your change, keeping it focused. One pull request should do one thing.
5. Run the checks locally (below) and make sure they pass.
6. Open a pull request against `main` and fill in the template.

## Checks

```bash
pnpm lint        # eslint
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest
pnpm build       # production build
pnpm check       # typecheck + test + build
```

End-to-end tests (`pnpm test:e2e`) need a configured database and are optional
for most pull requests; mention in the PR if you ran them.

## Commit messages

Write short, imperative messages that explain the change, for example
`Fix expiry check on urgent help requests`. We recommend the
[Conventional Commits](https://www.conventionalcommits.org/) prefixes
(`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`).

## Pull request checklist

- [ ] The change is focused and the description explains *why*.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
- [ ] New behaviour has tests, or the PR explains why not.
- [ ] Docs are updated if behaviour or setup changed.
- [ ] No secrets, personal data or `.env` files are included.
- [ ] UI changes include a screenshot.

## Code style

- TypeScript, strict mode. Avoid `any`.
- Follow the existing structure under `src/` and the patterns already used.
- Keep components accessible: labels, keyboard support and sufficient contrast.
- Validate input on the server (we use `zod`); never trust the client.

## Review

A maintainer will review your pull request as soon as they can. Please be
patient and responsive to feedback. Maintainers may ask for changes, or close a
PR that is out of scope; this is never personal.

## Questions

Open a GitHub Discussion or an issue labelled `question`.
