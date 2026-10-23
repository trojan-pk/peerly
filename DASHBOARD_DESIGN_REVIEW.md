# Workspace design review — 23 October 2026

The review covers the dashboard, resource library, resource publishing/editing and
account settings. The observations describe visual patterns and interaction
problems; they do not establish who authored a design.

## Findings and corrections

| Area | What felt generic or unfinished | Implemented correction |
| --- | --- | --- |
| Dashboard header | Email, internal role and repeated workspace labels crowded the greeting. | Removed the signed-in email/role line; a single workspace heading explains the page's purpose. |
| Account access | A name link and bare logout icon left account controls scattered. | A gear-only link opens /settings directly on desktop and mobile. There is no account dropdown, adjacent name/photo or extra Dashboard navigation label; the workspace logo returns to the dashboard. |
| Profile identity | Google-only photo display and stale session names made editing feel incomplete. | Consistent initials avatars derived from current saved names, editable profile fields and a dedicated settings page. Photo upload and serving have been retired. |
| Request history | Two unfiltered lists mixed pending, accepted and finished sessions, with no personal cleanup. | Server-side status filtering, response dates, current/archive views and personal archive/restore. Pending requests retain cancellation. |
| Request cards | Small topic badges, repeated labels and a bordered problem box inside an already bordered card weakened the hierarchy. | A clear topic heading, readable question text and fewer nested boundaries. Contact and completion states retain purposeful grouping. |
| Review copy | “Aggregates” and other implementation language appeared in user-facing instructions. | Short product language explaining what a review is for. |
| Resource input focus | The global 2px outline at a 4px offset combined with a separate Tailwind focus ring, producing a large double boundary. | One 2px focus indicator drawn inward at the input border; the outer ring is removed. Keyboard focus remains visible. |
| Resource search | A long placeholder competed with a boxed filter surface and tiny text. | Short search copy, a quieter filter area, larger fields and mobile stacking. |
| Resource publishing | A large technical guidelines box and a second empty-state card competed with the active editor. | A concise sharing note, clearer link wording and no redundant empty card while creating a resource. |
| Typography | Most supporting copy and fields used 11–12px text. | 14px inputs/resource descriptions, 15px request text, clearer topic headings and more restrained labels. |
| Settings structure | Profile and account activity were separate destinations without a useful overview. | Account identity, profile editor and confirmed logout in one screen, with repeated activity links removed. |
| Decorative controls | A pause control would be unrelated to these workspace tasks. | No pause control exists in the workspace; the owner clarified that this reference was a typo. |

## Interaction and data rules

- Archiving affects only the authenticated participant's view. The other person's
  request and existing review/contact eligibility remain intact. Archived requests
  can be restored; pending/accepted sessions cannot be silently hidden.
- Avatars display initials, never uploaded or Google photos. Names persist across
  subsequent sign-ins. Old stored image data is not deleted, displayed or served.
- Photo-upload actions and the avatar route are removed; no new image storage is
  needed for profile identity.
- Settings and history require authentication. Your sign-in email is shown in the private
  account section, rather than as dashboard decoration. Internal role labels are
  not part of the account presentation.
- Empty states and counts derive from actual records; no fabricated usage is added.
