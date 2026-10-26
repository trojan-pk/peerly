# Peerly landing design review — 23 October 2026

## Original assessment

The page has a coherent colour direction, a working single-page navigation and a
real sign-in entry point. It is still closer to a polished landing template than
a distinctive product brand. Adding more independent effects will amplify that
problem. The next design pass should build a clear visual story around Peerly's
actual discovery, acceptance and resource workflows.

This is a visual/interaction critique, not a determination of authorship.

## Evidence inspected

- Rendered desktop sections at 1440 × 1000: hero, features, workflow, resources, FAQ.
- The card's idle and hovered computed styles, live production rendering and source.
- Actual computed type sizes: eyebrow 11px, section kicker 9px, subject caption
  10px, resource tag 8px, resource footer 7px, feature/FAQ body copy 12px.
- One captured animation inventory reported 31 animations. This is a snapshot,
  not a performance benchmark; several decorative loops continue offscreen.
- Before this correction, feature hover independently translated the icon by 4px,
  rotated it 9 degrees, scaled it 1.08×, redrew its strokes and tilted the card.

## Findings and recommended treatment

| Priority | Area | What creates the generic/template feel | Concrete design correction |
| --- | --- | --- | --- |
| High | Hero message | “Big questions / Brighter together” could introduce many education/community products. The service becomes clear later in small copy. | Lead with a concrete university peer-help outcome. Keep one expressive headline treatment; make the explanatory line readable without hunting. |
| High | Hero product window | It is a second marketing message in browser chrome. Subject switching changes a slogan, not a meaningful discovery result. | Use a truthful composition derived from actual Peerly UI: a topic, matching criteria, profile availability and a clear next action. Label illustrative records; do not invent members or ratings. |
| High | Feature grid | Four similar rounded pastel rectangles, isolated stock icons and short slogans are the standard generated-SaaS pattern. The discovery drawing clips its own “Their strength” label at the card edge. | Replace the repeated layout with one larger discovery story and two smaller supporting scenes. Keep decorative clipping away from explanatory labels. Build privacy around pending/accepted request states, not a floating padlock. |
| High | Hover choreography | Card tilt + independent icon tilt + stroke redraw + cursor light compete. Text and labels move even when there is no action to communicate. | Anchor the content and attached icon. Give the interactive unit one restrained response; reserve spatial motion for genuinely manipulable illustrations and selected states. |
| High | Typography | Huge headings sit above 7–12px supporting copy. The small uppercase labels and pale paragraph text become texture instead of useful information. | Use a consistent scale: 16px body copy where possible, 14px secondary copy, and at least 11–12px for short labels. Check contrast on each background, not just the dark hero. |
| Medium | Subject dock | The six colourful app-like tiles strongly reference ToDesktop's customer dock, but they are subjects, not installed apps or trusted customers. Selection updates content above the dock, outside the current view. | Keep the subject choice, but place its resulting explanation beside/below the selector. Give each selected topic a useful, visible result. Avoid implying social proof. |
| High | Resource deck | The cards contain motivational phrases rather than showing what a useful study resource looks like. Back cards are partly occluded and their centres cannot be clicked. | Show resource hierarchy from the actual hub: specific title, topic, link type and brief description. Keep explicit category buttons and a clear selected card. Do not imply unsupported file uploads. |
| Medium | Motion hierarchy | Aurora drift, changing headline colour, orbit lines, floating tiles, bobbing labels, rotating rings and card interactions all demand attention. | Choose one signature sequence and a small interaction vocabulary. Enter once, settle, and use selection/hover to explain a relationship. Pause decorative loops offscreen; respect reduced motion. |
| Medium | Workflow | The correct product sequence is present, but the miniature white UI and tiny captions do not match the dark member workspace. | Reuse the actual workspace's visual language. Enlarge the changing state and visibly distinguish a helper accepting from a learner sending. Keep contact values redacted. |
| Medium | FAQ and ending | The large italic question mark and another abstract “possibility” headline add generic decoration and repeat the pitch. | Answer the important objections directly, then finish with one concrete action. Use fewer repeated slogans and clearer spacing. |
| Medium | Brand system | The custom wordmark has potential, but the remaining visual vocabulary is mostly generic rounded tiles, sparkles and purple gradients. | Define a Peerly-specific connection motif, illustration construction rules, icon container sizes and a consistent lighting direction. Lucide supplies symbols; composition supplies the identity. |

## Corrections completed in this pass

- Removed the floating Pause/Resume control and its React state/styles.
- Removed pointer-driven tilt from feature cards; their text and icons stay anchored.
- Removed independent feature-icon lift/rotation/scale and hover stroke redraw.
- Removed the resource icon's independent hover rotation and dock SVG nod.
- Stopped floating loops on feature padlocks, mode icons, exchange arrows and labels.
- Reduced the feature-card spotlight so it does not wash out the text.
- Kept operating-system reduced-motion support and keyboard-accessible controls.
- Updated the browser regression to check that a feature icon stays in the same
  position relative to its card, and that the pause button is absent.

## Art-direction scope approved after the audit

1. Rewrite the product story and choose the actual UI scenes before adding effects.
2. Recompose the hero and feature section around those scenes; remove redundant tiles.
3. Replace the resource slogans with meaningful, clearly labelled resource examples.
4. Establish the type scale, contrast, illustration and icon rules across every section.
5. Choreograph one signature animation and purposeful state transitions within that system.

The initial audit only completed the hover/control corrections. The subsequent
implementation below carries out the approved recomposition.

## Implemented recomposition

| Finding | Implemented treatment |
| --- | --- |
| Abstract hero | Concrete peer study-help headline, university context and a readable request/acceptance explanation. |
| Slogan in browser chrome | Dark discovery scene with a topic, matching criteria, availability and sign-in action; all records clearly marked illustrative. |
| Repeated cards and clipped labels | One wide request/privacy story, followed by two supporting sections with distinct layouts. The clipped orbit artwork is removed. |
| Detached hover effects | Feature content and icons stay fixed; a low-opacity surface highlight provides feedback without moving them. |
| Tiny supporting copy | Main paragraphs 16–17px, secondary paragraphs 14–15px, short labels generally 11–13px. Dark scenes use workspace colours with explicit text contrast. |
| Remote subject result | Six accessible subject tabs share the same panel directly below them. No dock or result above the controls. |
| Occluded resource slogans | One selected resource, a specific title/topic/link type, description, outline and worked notation; explicit Notes/Practice/Guides buttons. |
| Competing loops | Removed continuous aurora, gradient, orbit, dock and workflow loops. Connection lines draw once; selection changes and section entrances settle. Reduced motion suppresses animation. |
| Miniature white workflow | Enlarged dark workspace-style state panel, with separate sending, helper acceptance and both-party completion stages. |
| Repetitive FAQ and ending | Direct FAQ introduction, no question-mark decoration, and one final Google sign-in action. |
| Disconnected visual language | Repeated paired-circle connection mark, a shared connection-line construction and fixed icon containers. |

The landing → login → workspace flow stays intact. Landing examples never query
or reveal real member/contact data. The request and resource controls explain
product behaviour; they do not send requests or create resources.

> Superseded (26 October 2026): the landing was rebuilt in the Paper & Ink system in Phase 3. See README "Visual design and entry flow" and VERIFICATION.md.
