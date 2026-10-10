---
name: TaskFlow
description: A calm, neutral work tool for planning and tracking projects, tasks and teams.
colors:
  charcoal: "#242426"
  charcoal-hover: "#343438"
  medium-gray: "#66676b"
  canvas: "#f5f6f8"
  container: "#e9ebef"
  subtle: "#f0f2f5"
  card: "#ffffff"
  border: "#e1e4e8"
  ink: "#17191c"
  muted: "#565b64"
  faint: "#64686f"
  lavender: "#aeb9d2"
  blue-gray: "#dde3f0"
  purple: "#b9b0c8"
  success: "#3ead7a"
  warning: "#d99000"
  danger: "#b94a46"
  info: "#4f8edb"
  success-soft: "#e1f3ea"
  warning-soft: "#f9eed9"
  danger-soft: "#f8ecec"
  info-soft: "#e5eefa"
  success-ink: "#1f7a50"
  warning-ink: "#8a5a00"
  danger-ink: "#a32f2b"
  info-ink: "#2a62a8"
  focus: "#2f5fd0"
  dark-canvas: "#1c1c1e"
  dark-container: "#29292c"
  dark-card: "#232326"
  dark-border: "#38383c"
  dark-ink: "#f2f2f3"
  dark-muted: "#a7a8ac"
  dark-faint: "#92939a"
  dark-charcoal: "#ececef"
typography:
  page-title:
    fontFamily: "Archivo, Inter, 'Segoe UI', system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    letterSpacing: "-0.015em"
  section-title:
    fontFamily: "Archivo, Inter, 'Segoe UI', system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 650
    letterSpacing: "-0.01em"
  card-title:
    fontFamily: "Archivo, Inter, 'Segoe UI', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 650
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Archivo, Inter, 'Segoe UI', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, Inter, 'Segoe UI', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
  caption:
    fontFamily: "Archivo, Inter, 'Segoe UI', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
rounded:
  sm: "5px"
  md: "9px"
  btn: "8px"
  card: "15px"
  hero: "17px"
  full: "9999px"
spacing:
  card-y: "22px"
  card-x: "24px"
  section-gap: "24px"
  page-x: "40px"
components:
  button-primary:
    backgroundColor: "{colors.charcoal}"
    textColor: "#ffffff"
    rounded: "{rounded.btn}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.charcoal-hover}"
  button-secondary:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.ink}"
    rounded: "{rounded.btn}"
    padding: "10px 18px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "22px 24px"
  input:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
  badge:
    rounded: "{rounded.full}"
    padding: "4px 10px"
  nav-item-active:
    backgroundColor: "{colors.charcoal}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: "42px"
---

# Design System: TaskFlow

> Recorded from the incumbent code (`frontend/src/styles/global.css`, the shared components in `frontend/src/components/`, and the layout and page files) on 2026-10-08. It describes what the interface **is**, plus the guardrails that keep new screens consistent. Where the code falls short of those guardrails, that is listed under [Known Drift](#known-drift). Product context is in [PRODUCT.md](PRODUCT.md). No `.impeccable/design.json` sidecar has been generated.

## Overview

**Creative North Star: "The Quiet Ledger"**

TaskFlow is a place people open all day to check what is due and move work forward. The interface behaves like a well-kept ledger: neutral paper, dense but ordered rows, one dark ink for emphasis, and colour reserved for *meaning* (status, priority, risk). It should recede so that the work and its deadlines are what the eye lands on.

The current implementation is soft and low-contrast: pale gray surfaces, light shadows, a charcoal-and-lavender palette. The intent worth keeping is restraint and calm. The intent worth correcting is that calm has drifted into faintness; secondary text, status badges and focus states are too weak to carry a tool people rely on for deadlines.

**Key Characteristics:**
- Neutral, tonal surfaces; charcoal is the only strong colour and is used for the primary action and the active location.
- Status colours (success, warning, danger, info) carry meaning and nothing else.
- Cards on a light canvas; tonal steps rather than heavy shadows create depth.
- Compact, scannable rows: 13–14px working text, 42px nav rows, 44px inputs.
- Light, dark and system themes are all first-class; every colour must resolve through tokens.

## Colors

A restrained neutral palette with a charcoal anchor, a pale lavender family as the only accent, and four muted status hues. All values are tokens in `@theme` in `global.css`; dark values override them on `:root[data-theme='dark']` and under `prefers-color-scheme: dark` when no theme is chosen.

### Primary
- **Charcoal** (`#242426`): the primary button fill, the active nav item, the "today" marker, the lead chart line and the first logo squares. Hover is **Charcoal Lift** (`#343438`).

### Secondary
- **Lavender** (`#aeb9d2`): the one accent. Second chart series, second logo squares, input focus border, auth-page glow, avatar swatch.
- **Blue-Gray** (`#dde3f0`): text selection, donut track, default avatar background.
- **Purple** (`#b9b0c8`): decorative glow and avatar swatch only.

### Neutral
- **Canvas** (`#f5f6f8`): page background.
- **Container** (`#e9ebef`): board and project-group surfaces (Kanban columns, dashboard board preview).
- **Subtle** (`#f0f2f5`): inputs, secondary buttons, hover wash.
- **Card** (`#ffffff`): raised surface that tasks and content sit on.
- **Border / Divider** (`#e1e4e8`): hairlines between and inside surfaces.
- **Ink** (`#17191c`): primary text.
- **Muted** (`#565b64`): secondary text, labels, inactive nav.
- **Faint** (`#64686f`): the lowest text tier (project names, dates, counts, placeholders). Still readable text: 4.7:1 or better on every light surface.

### Status
- **Success** (`#3ead7a`), **Warning** (`#d99000`), **Danger** (`#b94a46`), **Info** (`#4f8edb`) are the fill hues: dots, chart series, solid buttons. Each has a soft tint (`#e1f3ea`, `#f9eed9`, `#f8ecec`, `#e5eefa`) used as the badge background, and a darker **ink** step for text on that tint: `success-ink` (`#1f7a50`), `warning-ink` (`#8a5a00`), `danger-ink` (`#a32f2b`), `info-ink` (`#2a62a8`). Use `text-*-ink` for text, never `text-success` and friends. Soft tints become translucent versions of the same hue in dark mode.
- Priority and status map onto these: High/Urgent/Critical/At risk → danger; Medium/In review/On hold → warning; Low/In progress/Planning → info; Done/Completed/On track → success; To do → neutral.

### Dark theme
Canvas `#1c1c1e`, container `#29292c`, card `#232326`, border `#38383c`, ink `#f2f2f3`, muted `#a7a8ac`, faint `#92939a`. **Charcoal inverts** to `#ececef` (and `on-charcoal` to `#17191c`) so primary buttons and the active nav item stay a visible fill; danger lifts to `#e07a74` with `on-danger` text `#17191c`; the four ink steps lift to `#6fd1a0`, `#f0b84a`, `#f0958f`, `#86b6ee`. Lavender and purple are unchanged.

### Named Rules
**The Meaning-Only Colour Rule.** Hue appears only when it tells the user something: a status, a priority, a risk. Decorative colour (glows, accent stripes, tinted illustration) is not part of this system.

**The Token-Only Rule.** Every colour in a component comes from a token or a status class. No hex literals in JSX or inline SVG; a hardcoded colour is a dark-mode bug waiting to happen. Text on a charcoal fill is `text-on-charcoal`; text on a danger fill is `text-on-danger`; neither is ever `text-white`. The one sanctioned exception is the avatar swatch palette, whose initials colour is computed from the swatch.

**The Overdue-Is-Loudest Rule.** Overdue and blocked are the strongest signals in the product. The danger treatment must be the highest-contrast coloured element on any row or card where it appears.

## Typography

**Display / Body / Label Font:** Archivo (Google Fonts; weights 400, 500, 600, 650, 700), falling back to Inter, Segoe UI, system-ui.

**Character:** A neutral grotesque with slightly tight tracking on headings. One family is used throughout; hierarchy comes from weight and size, not from a second typeface.

### Hierarchy
- **Page title** (700, 24px, tracking −0.015em): the top of each screen and the dashboard hero heading.
- **Section title** (650, 19px, tracking −0.01em): card and section headings (`.section-title`).
- **Card title** (650, 16px, tracking −0.01em): item headings inside cards (`.card-title`); project names run 15.5px.
- **Body** (400–500, 14px, line-height 1.5): default text; 13px for rows and controls.
- **Label** (600, 12px): field labels, secondary links, meta.
- **Caption** (600, 12px): badges, counts, dates, project names under a task title.
- **Stat** (700, 26px, −0.02em): dashboard stat values.

### Named Rules
**The Twelve-Pixel Floor Rule.** No text is set below 12px. Avatar initials are the only exception (11px minimum, scaled to the avatar).

**The Scale Rule.** Text sizes are 12, 13, 14, 15, 16, 19, 24 and 26px, plus the sidebar wordmark (17px) and a few 18-20px headings. Do not introduce half-pixel sizes.

**The No-Kicker Rule.** No small uppercase label sits above a heading. A drawer's title is a title (15px, 650, Ink); a task card's project name is plain 12px Muted text.

## Layout

An app shell with a fixed 224px left sidebar and a scrolling main area. Main content is centred with a max width of 1440px and horizontal padding of 40px on desktop, 24px below 1024px and 16px below 640px. The sidebar becomes an off-canvas drawer below 1024px.

Pages are built from cards separated by a 24px gap. Card padding is 22px vertical and 24px horizontal. The dashboard is a two-column grid (`1fr 380px`) laid out in two rows, so neither column runs long: Task Overview beside Reports, then Due & Overdue beside Projects. Below 1200px it is one column in the order Overview, Due & Overdue, Projects, Reports (the actionable list comes before the project cards). Task and board views are horizontally scrolling lanes of 240–268px columns. The scrollbar gutter is reserved so layout never shifts when content grows.

Density is moderate: working rows are 42–44px tall with 12–14px gaps; body text is 14px on every screen size. Use spacing in multiples of 4px; recurring values are 6, 10, 14, 18, 22 and 24px.

### Named Rules
**The One Hero Rule.** An Operate screen leads with its working content. Decorative hero blocks, banners and illustration panels do not belong above the fold of a screen people open to do work.

## Elevation & Depth

Tonal, with elevation declared once. Depth comes from stepping through Canvas → Container → Card → Subtle, and a card's edge is a 1px border. Cards have no shadow at rest; shadow appears only on hover (for cards that open something) and on popovers, drawers and modals.

### Shadow Vocabulary
- **Card hover** (`0 8px 28px rgba(30,30,30,0.07)`): hover on clickable cards only, with a 2px (`-translate-y-0.5`) or 1px lift. A resting card has a border and no shadow.
- **Pop** (`0 12px 36px rgba(30,30,30,0.10)`): modals, drawers, dropdowns, chart tooltip.
- **Active nav** (`0 6px 16px rgba(36,36,38,.22)`): the selected sidebar item only.
- Scrim (`--color-scrim`, `rgba(20,20,22,.4)`): a flat dim layer behind modals, drawers and the mobile nav. No backdrop blur.

### Named Rules
**The Hover-Grows Rule.** A hover or focus state may raise elevation, never lower it. Resting shadow must be less than or equal to hover shadow.

**The Single Lift Rule.** Only elements that navigate or open something lift on hover. Static cards do not.

## Shapes

Softly rounded rectangles with hairline borders; pills for status and avatars.

- `5px` small controls and dropdown items; `8px` buttons; `9px` inputs, nav rows, task rows, board columns and cards, and icon buttons; `15px` cards; `17px` the largest panels.
- Badges, avatars, progress bars, counts and toggles are fully round.
- Surfaces use a 1px border (`#e1e4e8`) in addition to, not instead of, tonal separation.

### Named Rules
**The Token Radius Rule.** Corners come from `rounded-sm/md/btn/card/hero` or `rounded-full`. Arbitrary values such as `rounded-[10px]` are drift; use `rounded-md`. (The one remaining arbitrary radius is the 2px calendar event chip.)

## Components

### Buttons
- **Shape:** gently rounded (8px), 13.5px semibold, 18px × 10px padding, inline icon at 16px with a 6px gap.
- **Primary:** Charcoal fill, white text; hover Charcoal Lift. One per view or dialog.
- **Secondary:** Subtle fill, Ink text, 1px border; hover Canvas.
- **Ghost:** transparent, Muted text; hover Canvas.
- **Danger confirm:** `bg-danger` with white text for confirmed destructive actions.
- **Press:** `active:scale-[0.97]`; transitions 150ms standard ease.
- **Icon button:** 40px square, 9px radius, Subtle fill, 1px border.
- **Small controls:** a 28px icon button or an inline text action gets the `.hit-area` class, which adds an invisible ~44px tap area without changing the layout.

### Cards / Containers
- **Corner Style:** 15px (`rounded-card`).
- **Background:** Card; Container for board columns.
- **Shadow Strategy:** none at rest (the border is the edge); Card hover only on cards that navigate or open something.
- **Border:** 1px Border.
- **Internal Padding:** 22px × 24px (stat cards 18px × 20px; board cards 13px).

### Inputs / Fields
- **Style:** one `.field` class for every text input and select: Subtle fill, 1px Border, 9px radius, 40px tall, 13px text, label above in 12px semibold Muted. `.field-sm` (36px, 12px text) for dense filter popovers and inline edits; `.field-lg` (44px) for the auth screens. Do not rebuild these from utilities.
- **Focus:** border shifts to the Focus blue (`#2f5fd0`; `#8fb0ff` in dark) and the global 2px focus ring appears.
- **Error:** inline 12.5px semibold Danger message under the form.
- **Password:** a live checklist beneath the field.

### Navigation
- **Sidebar:** 224px, Card background, right border; logo mark and wordmark at top; seven primary items (Dashboard, Tasks, Projects, Calendar, Kanban Board, Team, Reports) with 18px icons and labels; an **Administration** group (Users, Roles & Permissions) under a small heading, shown only to someone holding `USER:VIEW` / `ROLE:VIEW`; Settings and Help & Support (both pages, not pop-ups) pinned to the bottom behind a divider. An item the user may not open is **absent**, not greyed out (Reports needs `REPORT:GENERATE_REPORTS`).
- **Item:** 42px tall, 13.5px medium, 11px icon gap. Inactive is Muted with Faint icon; hover washes to Canvas; active is Charcoal fill, white text, active shadow.
- **Mobile:** off-canvas below 1024px with a dimming scrim.
- **Top bar:** page title and subtitle, search, notification bell with unread count, profile menu, and per-page actions.

### Permission grid (Administration → Roles & Permissions)
A role list (Card, one button per role; the selected role uses the Charcoal fill; a lock icon marks the read-only Administrator role; a small warning dot marks unsaved edits) beside one Card per scope containing a table: resources as rows, the seven permissions as columns. A cell is a native checkbox (`accent-charcoal`, 16px) when editable, a ✓ / – with an `aria-label` when not, and a faint "·" when the action means nothing for that resource. The first column is `sticky` on narrow screens so the row stays identifiable while the table scrolls sideways, and the row hints are hidden below 640px. *Save changes* and *Discard* sit in the role's header card; with no `ROLE:EDIT` the grid is read-only and a "View only" badge replaces them. Controls the user cannot use are removed, never disabled.

### Badges (status and priority)
- **Style:** pill, 12px semibold, 4px × 10px, a 6px dot in `currentColor` before the label, soft-tint background with the matching `-ink` hue as text.
- **Mapping:** see Colors → Status. Unknown values fall back to Subtle with Muted text.

### Avatars
- Circle with 2px Card-coloured ring; photo if present, otherwise initials on one of eight deterministic swatches (`#AEB9D2 #B9B0C8 #DDE3F0 #78A88A #D2A85A #7E9FC4 #C2596B #4C6FB9`) chosen by hashing the user id. Initials are dark or white depending on the swatch's luminance, independent of theme. Groups overlap by 8px and collapse to "+N" after three.

### Progress
- 7px pill track in Divider, Ink fill (flips to near-white in dark mode); width transitions over 500ms. Donut and ring variants use Charcoal on a Blue-Gray track.

### Modals and drawers
- Centred modal (max 460px, 9–13px radius, Pop shadow) and right-hand slide-in panels for task detail and task/project forms. Closing a dirty form asks "Discard changes?" with Keep editing / Discard. Backdrop clicks close; nested overlays stop propagation.

### Calendar
- Desktop: month grid with one truncated 12px chip per task, tinted by priority. Phones (under 640px): cells are about 40px wide, so a title cannot fit; each day shows up to four dots in the task's colour instead, and the Week and Day views list the titles.

### Dashboard task rows
- A "Due & Overdue" row is: checkbox, task title (project name stripped from it), a second line of `Overdue · date` (in `danger-ink` with a warning icon) or just the date, then the project name; priority badge; assignee. Overdue is also counted in the Task Overview header as a link to Tasks.

### Empty, loading and error states
- Skeleton blocks with a 1.6s shimmer, empty states with a 60%-opacity icon, title and subtitle, and a "Something went wrong" state with a retry button. Success and error feedback uses toasts.

### Motion
- Standard ease `cubic-bezier(0.4, 0, 0.2, 1)`; 150ms for hover and press, 220ms for enter transitions. Entrances: fade, slide-in (24px), scale-in (0.96), toast-in. Kanban cards stagger up to eight items at 30ms steps. Under `prefers-reduced-motion: reduce` all animation and transition durations collapse to ~0 (a global rule in `global.css`).

### Focus
- One global, unlayered rule: `:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px }`. It overrides the `outline-none` utility on inputs and buttons, so no component needs its own ring.

## Do's and Don'ts

### Do:
- **Do** take every colour, radius and shadow from the tokens in `global.css`; add a token before adding a literal.
- **Do** pair every status colour with text or an icon so meaning never depends on hue alone.
- **Do** keep text that carries a decision (due date, overdue, status, assignee) at 12px or larger and at 4.5:1 contrast against its background in both themes.
- **Do** rely on the global `:focus-visible` ring and never suppress it with `!important` or `outline: 0` in an unlayered rule.
- **Do** use the shared primitives (`Badge`, `Avatar`, `ProgressBar`, `Modal`, `EmptyState`, `Skeleton`, `.btn`, `.card`) before building a new variant.
- **Do** show loading as skeletons, empty as a titled empty state with a next action, and failure with a retry.
- **Do** keep one primary button per view or dialog.
- **Do** hide a control the signed-in user is not permitted to use (read `can` / `canSys` from `useAuth()`); a disabled control that can never be enabled is noise, and the server still refuses the request.

### Don't:
- **Don't** hardcode hex or `rgba()` values in JSX or inline SVG. Use `<Logo />` for the mark.
- **Don't** write a literal `#242426` or `text-white` for a primary fill; use `bg-charcoal` with `text-on-charcoal`, which flip together in dark mode.
- **Don't** use the status base hues (`text-success`, `text-warning`, `text-danger`, `text-info`) for text; use the `-ink` steps.
- **Don't** remove an outline (`outline-none`) without adding a replacement focus style in the same class list.
- **Don't** lower elevation on hover or give static cards a hover lift.
- **Don't** add decorative blocks (gradient glows, accent stripes, illustration panels) to working screens.
- **Don't** add a new font size, radius or spacing value that is not in this document.
- **Don't** repeat the same metric in several widgets on one screen.

## Known Drift

Status after the 2026-10-08 frontend pass. Everything marked fixed is in code and was checked with a production build, ESLint, the design detector, and and live light/dark/mobile screenshots of the dashboard, tasks, Kanban, calendar, reports and projects screens on the rebuilt Docker frontend (zero browser console errors).

**Fixed**
1. Dark-mode charcoal collision: charcoal inverts in dark mode with an `on-charcoal` text token; the logo is a themed `<Logo />` component.
2. Contrast: faint and muted text darkened; status text uses `-ink` tokens (4.6:1 or better on its tint in light, 5.2:1 or better in dark); danger is a stronger red.
3. Focus: a global `:focus-visible` ring, plus a Focus-blue input border.
4. Hardcoded colours: scrim token, `text-on-danger`, themed logo, computed avatar initials, the Reports first bar series and the Delete-project button now use tokens.
5. ProjectCard no longer has a heavier resting shadow than hover.
6. Dashboard: the decorative hero and the Kanban preview (a duplicate of the Kanban page) are removed.
8. Auth-page glow blobs, the stat-card top stripe, the modal backdrop blur and the uppercase kickers are removed. The Overdue stat value turns `danger-ink` when above zero.
9. `prefers-reduced-motion` is handled globally.
10. The dashboard task toggle has a 40px target and a label naming the task.

7. Sizes are collapsed to 12/13/14/15/16/19/24/26 (plus a few 17-20px headings). A shared `.field` class replaces 48 copy-pasted input class strings. Cards declare elevation once: a border at rest, shadow on hover only.
11. The Dashboard's Work Distribution donut is removed; completion data now lives in the Task Overview rings and the Reports chart only.
12. Calendar chips and badges at 12px were checked against the seeded data on desktop: chips truncate with an ellipsis rather than wrap, and badges stay on one line.

**Mobile, layout and accessibility pass (2026-10-08, second round)**
- Horizontal page scroll at 390px is gone on the Calendar, Team and Profile screens (selects and password fields now shrink; two-field rows stack under 520px).
- The Reports stat cards are 2×2 on phones instead of four stacked.
- Reports chart axes: whole-number ticks, wider axis, tick text at the 12px floor. The clipped "0.5 / 0.75" labels are fixed on the completion and productivity charts.
- The Team member list scrolls inside a 320px box on phones, so the selected member's details are not 25 rows away.
- Missing accessible names added: project status select, milestone date, team invite project select.
- Tap targets: the small controls listed above now use `.hit-area`.

**Final pass (2026-10-08, third round)**
- The Team page name list scrolls inside its own card at every width (up to 600px or the viewport height minus 15rem on desktop, 320px under 900px), so 25+ members never stretch the page.
- The Project Detail status select is 40px tall on phones (it stays 28px on larger screens to line up with the badges beside it).
- Avatars are never drawn smaller than 26px so two initials fit at the 12px text floor; no text on any screen is under 12px.
- Team Productivity chart: every member is labelled (names over six characters shorten with an ellipsis; the tooltip shows the full name).
- Checked at 390, 768, 1024 and 1360px in light and dark: no horizontal scroll, no unlabeled controls, no console errors.

**Still open**
- None known. Groups of overlapping avatars still clip the initials of every avatar except the top one; that is the intended stacking look.
