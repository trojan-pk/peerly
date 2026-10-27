# Design and branding

The Paper & Ink design system, the landing experience and the Open Page identity.

## Visual design and entry flow

Visitors see one Paper & Ink marketing page that follows the chosen theme. Its
navigation (How it works, Privacy, Resources, Questions) scrolls within the page.
Calls to action go to the dashboard (signed-out visitors are sent to Google sign-in,
which returns them there). The landing never queries member profiles or resources,
and does not wait for the session check, so it renders without a loading skeleton.

The hero plays one illustrative sequence — an urgent request, a helper accepting and
contact unlocking — once, with a Replay button; reduced-motion visitors see the final
state. "How it works" uses a sticky preview driven by normal scrolling (no scroll
hijacking) and keyboard-selectable steps. Every example person, course and resource
is labelled as illustrative; there are no testimonials, counters or invented ratings.
The marketing footer appears only on the landing and login pages.

Peerly uses Manrope (interface), Instrument Serif (display headlines) and Geist Mono
(numbers, timers and course codes). All three are self-hosted Latin WOFF2 subsets
in `src/app/fonts/` with their OFL licences; no external font request is made.

Illustrative profiles and resources are labelled examples, not real activity,
testimonials or fabricated ratings. Resource examples show link types, not uploads.
Motion (`motion`, pinned) is the only animation library. It loads through
`LazyMotion` with the DOM feature set and `reducedMotion="user"`; no external font
request is made.

## Paper & Ink design system

The workspace uses two themes: **Paper** (warm off-white, ink-navy text) and
**Ink** (deep ink, paper-coloured text), with one fountain-pen blue accent and a
highlighter yellow reserved for emphasis. Choose Light, Dark or System from the
header or Settings → Appearance; the choice is stored in the browser and applied by
a small inline script before first paint, so there is no theme flash. System
follows live OS changes.

Tokens live in `src/app/styles/tokens.css` in three layers: primitives, semantic
`--pi-*` roles per theme, and Tailwind colour utilities mapped to those roles.
`src/tests/design-tokens.test.ts` checks every text/background pair against WCAG AA.
Shared primitives (Button, Card, Badge, Field/Input/Textarea/Select, Dialog, Toast,
Skeleton, EmptyState) are in `src/components/ui/`. A reference page is available
at `/dev/ui` during development and returns 404 in production builds. Below the
desktop breakpoint, signed-in pages show a bottom navigation bar.

## Open Page identity

The approved Open Page symbol and outlined `peerly` wordmark appear in the header,
footer, sign-in screen and product illustrations. UI components and exported
artwork share the geometry in `src/lib/brand.ts`; the logo needs no font download.

Reusable SVG and transparent PNG exports are in `public/brand/` (colour and white
lockups, standalone symbol and wordmark). Regenerate them with:

```bash
node scripts/build-brand.mjs
```

The same script builds the SVG favicon, 16/32/48px ICO, 180px Apple touch icon and
1200×630 Open Graph/Twitter images in `src/app/`. Next.js adds the metadata tags
through its file conventions. Absolute share-image URLs use the origin of
`AUTH_URL` (or `NEXTAUTH_URL`), with localhost as the development fallback.
