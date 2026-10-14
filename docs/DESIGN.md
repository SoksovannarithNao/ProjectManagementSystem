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
    height: "40px"
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
- Compact, scannable rows: 13–14px working text, 42px nav rows, 40px inputs (44px on the auth screens).
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

Pages are built from cards separated by a 24px gap. Card padding is 22px vertical and 24px horizontal. The dashboard opens with a strip of six statistic cards (total, active, completed and delayed projects, average completion, total tasks; six columns, three below 1200px, two below 640px) and then two independent columns (`1fr` and 380px), so a short card never leaves a hole beside a tall one: Task Overview, Due & Overdue and Recent activity on the wider left; on the right, project health first (Delayed projects, then the two project previews) and, only for people who can assign tasks, Team workload under it; the Task activity chart then spans both columns. Below 1200px the columns dissolve into one, in this order: Task Overview, Due & Overdue, Delayed projects, Projects, Team workload, Recent activity, Task activity (what needs action first, then the rest; set with `order`, not by moving the markup); between 640 and 1200px the two project previews sit side by side. Task and board views are horizontally scrolling lanes of 240–268px columns. The scrollbar gutter is reserved so layout never shifts when content grows.

Density is moderate: working rows are 42–44px tall with 12–14px gaps; body text is 14px on every screen size. Use spacing in multiples of 4px; recurring values are 6, 10, 14, 18, 22 and 24px.

### Named Rules
**The One Hero Rule.** An Operate screen leads with its working content. Decorative hero blocks, banners and illustration panels do not belong above the fold of a screen people open to do work.

**The page header is sticky.** `TopBar` (the one header every page renders as its first element) stays at the top of the window while the page scrolls under it: `position: sticky; top: 0; z-index: 30` with the Canvas background, so the content does not show through and nothing changes in either theme. It reaches up into the content box's top padding (`-mt` and `pt` of 32, 20 and 16px, equal to that padding at each width) so the title keeps the same space above it when stuck as when not, and its 28px bottom gap is 16px of padding (covered by the Canvas) plus 12px of margin. z-30 is above the page content and below the sidebar (z-40), its mobile scrim (z-39), the side panels and dialogs (z-60 and up); the notification, theme and profile panels belong to the header and open over the content. A header that wraps onto several rows (the action buttons on a phone, a project's many actions) would pin a third of the screen, so only its **first row stays pinned**: as the page scrolls, the rows below it are clipped away one pixel per pixel scrolled (`clip-path`, set from `usePinFirstRow` in `TopBar.jsx`, re-measured when the header or one of its blocks resizes), the page shows through where they were and the clipped part takes no clicks; scrolled back to the top the whole header is back, and the header keeps its size so nothing moves. The pinned part is about 117px on a desktop, 105px on a tablet and 88-115px on a phone. `html` has `scroll-padding-top: 8rem`, so a focused or scrolled-to element is not left under the header.

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
- **Top bar:** page title and subtitle, search, notification bell with unread count, profile menu, and per-page actions. It is **sticky** on every page (see Layout).

### Side panel (`SidePanel`)
A form that slides in from the right, in the same frame as the task panel: a scrim (`z-60`), a 440px full-height Card with a header (15px title, close button) and a column for the form, which lays out its own scrolling body and a footer with the actions under a divider; full width below 640px. Closing with unsaved changes (the scrim, the X, Escape or Cancel) opens the *Discard changes?* confirmation. Used by *New role* / *Edit role*, *New Task*, *Add member* (project page and Team page) and *Add User* (Team page). A dialog such as *Add New Position* that one of these forms opens is rendered beside the panel, not inside it: the panel slides in with a transform, which would pin a fixed overlay to the panel instead of the screen. *Edit Task* stays a centred modal because it opens over the task panel (two drawers would stack); *New Project* still has its own copy of the drawer layout; short confirmations and small forms stay in `Modal`.

### Combo box (`Combobox`)
A searchable select for choosing one item from a list that is too long to scan: a `.field` input with a chevron, and under it a listbox card (Card background, 1px Border, `shadow-lg`, 224px tall at most, scrolling) of rows with an optional leading avatar, a 13px semibold label and a 12px Faint second line. You type to narrow the list (or the parent narrows it, for example from the server), move with the arrow keys, choose with Enter or a click and close with Escape (which closes only the list, never the panel around it). The chosen item stays shown in the field and typing again clears the choice: only a listed item can be chosen, there is no free text. ARIA combobox pattern (`role="combobox"`, `aria-expanded`, `aria-activedescendant`, `role="listbox"`). Used for the project and the person in *Add Member*; a native `<select>` stays right for short fixed lists (roles, priorities).
### Permission grid (Administration → Roles & Permissions)
A role list (Card, one button per role; the selected role uses the Charcoal fill; a lock icon marks the read-only Administrator role; a small warning dot marks unsaved edits; extra system roles read "Extra system role" and the list ends with a *New role* button) beside one Card per scope containing a table: resources as rows, the seven permissions as columns. A cell is a `Checkbox` when editable (a rounded 18px square, 1.5px border; ticked it fills with the Charcoal accent and shows a check mark that follows the theme; hover darkens the border; keyboard focus draws a focus-colour outline; a disabled box is dimmed; the real checkbox sits on top, invisible, so the whole 24px cell is the click target), a ✓ / – with an `aria-label` when not, and a faint "·" when the action means nothing for that resource. The first column is `sticky` on narrow screens so the row stays identifiable while the table scrolls sideways, and the row hints are hidden below 640px. *Save changes* and *Discard* sit in the role's header card; with no `ROLE:EDIT` the grid is read-only and a "View only" badge replaces them. Controls the user cannot use are removed, never disabled.

### Badges (status and priority)
- **Style:** pill, 12px semibold, 4px × 10px, a 6px dot in `currentColor` before the label, soft-tint background with the matching `-ink` hue as text.
- **Deadline flags:** *Overdue* is the danger tint; *Due today / tomorrow / in N days* (`DueSoonBadge`, an open task due within 3 days) is the warning tint with a clock icon; the completed-project chip (*Completed on <date>*) is the success tint. Dashboard rows use the same hues as plain text.
- **Mapping:** see Colors → Status. Unknown values fall back to Subtle with Muted text.

### Avatars
- Circle with 2px Card-coloured ring; photo if present, otherwise initials on one of eight deterministic swatches (`#AEB9D2 #B9B0C8 #DDE3F0 #78A88A #D2A85A #7E9FC4 #C2596B #4C6FB9`) chosen by hashing the user id. Initials are dark or white depending on the swatch's luminance, independent of theme. Groups overlap by 8px and collapse to "+N" after three.

### Progress
- 7px pill track in Divider, Ink fill (flips to near-white in dark mode); width transitions over 500ms. Donut and ring variants use Charcoal on a Blue-Gray track.

### Modals and drawers
- Centred modal (max 460px, 9–13px radius, Pop shadow) and right-hand slide-in panels for task detail and task/project forms. Closing a dirty form asks "Discard changes?" with Keep editing / Discard. Backdrop clicks close; nested overlays stop propagation. The *Still there?* inactivity dialog (`role="alertdialog"`, 380px, a clock icon in the warning ink) is the one overlay that ignores backdrop clicks: only its two buttons close it, and it sits above every other overlay.

### Quick views (Tasks page)
- A row of pill buttons above the task groups (All, Today, Upcoming, In Progress, Completed, Overdue), each with its count; the selected one takes the Charcoal fill, the others the Card fill with a Border and Muted text (Overdue turns `danger-ink` when it holds tasks). It scrolls sideways on narrow screens and uses `aria-pressed`. The Reports tab strip uses the same pills (`role="tab"`, `aria-selected`).

### Calendar
- Desktop: month grid with one truncated 12px chip per task, tinted by priority, and one per milestone: a neutral Blue-Gray chip with a small flag and a hidden "Milestone:" prefix, struck through once completed. Phones (under 640px): cells are about 40px wide, so a title cannot fit; each day shows up to four dots in the item's colour instead (Charcoal for a milestone), and the Week and Day views list the titles. **Detail:** chips are buttons, the day number is a button named with the date and the count ("Wednesday, October 14, 2 due") and the whole cell opens the same thing, so on a phone a tap on a day shows what its dots stand for. That is the **day drawer**, one right-hand drawer in two parts: on the left (400px) the day's list, titled with the full date, *Milestones (n)* then *Tasks (n)*, each row a button (a dot or flag, the title, the project, a status badge; the chosen row is Subtle-filled and `aria-current`) with, for anyone who may create tasks, a footer button *New task on this day*; on the right (480px, a divider between) the detail of the chosen item, which appears only once an item is chosen: the task panel (the standard `TaskDetailPanel`, embedded without its own scrim) or the read-only milestone pane (due date and project in a Subtle box, a progress bar noted as worked out from the linked tasks, the description, the linked tasks). Choosing another row swaps only the right part; the X of the detail closes the detail, the X of the list (or the scrim, or Escape unless a field has the focus) closes the drawer. A chip in the grid opens the drawer on its day with that item chosen. Below about 1000px the parts do not fit side by side: the detail replaces the list and its X brings the list back. Overlays opened from the task pane (the edit form, the delete confirmation) are rendered at the end of `<body>`, so the drawer's slide-in transform cannot pin them to it. Editing a milestone stays on its project page.

### Dashboard task rows
- A "Due & Overdue" row is: checkbox, task title (project name stripped from it), a second line of `Overdue · date` (in `danger-ink` with a warning icon) or just the date, then the project name; priority badge; assignee. Overdue is also counted in the Task Overview header as a danger-tint pill (*N overdue*, with a warning icon) that links to Tasks. On a phone a title may take two lines instead of being cut, and the meta line wraps.

### Empty, loading and error states
- Skeleton blocks with a 1.6s shimmer, empty states with a 60%-opacity icon, title and subtitle, and a "Something went wrong" state with a retry button. Feedback uses toasts in four tones: success, error, warning (the amber accent and a triangle icon, for something that went through but needs attention, such as completing a milestone that still has open tasks) and info.

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
- **Do** use the shared primitives (`Badge`, `Avatar`, `ProgressBar`, `Modal`, `SidePanel`, `EmptyState`, `Skeleton`, `.btn`, `.card`) before building a new variant.
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

**Dashboard polish (2026-10-14)**
- Layout: two independent columns instead of aligned rows (no dead space beside a short card); Delayed projects leads the right column and the chart moves to its end; the chart card is *Task activity* (it was *Reports*, which is a different page) with a whole-number y axis, and its Overdue legend says what the line counts (open tasks past their due date).
- Signal: the overdue count is a danger-tint pill; the duplicate *N tasks* in the Task Overview header is gone (Total tasks is in the strip).
- Failure: a failed load shows a message with *Try again* and the stat cards read — instead of looking like "Nothing due soon".
- Phone: the workload card keeps Member, Overdue and Load (Assigned and Active return from 640px), stat cards are tighter, Due & Overdue titles wrap to two lines.
- Numbers use tabular figures (stat values, counts, workload cells).
- Layout pass (same day): Team workload moved into the right column under the project cards and the Task activity chart became a full-width card below both columns, so the right column holds exactly project health and team workload and the two columns end within about 130px of each other at 1440px. The dashboard's project previews are *compact* (no description, badges in one row, tighter padding; the Projects page keeps the full card) and the workload card is a list of people (name, a line of counts, the Load pill) instead of a table that could not fit 380px, which scrolls inside the card past about eight people (`max-h` 400px, focusable, the footnote stays below); the table stays on the project and Reports pages.

**Reports page layout (2026-10-14)**
- The tab strip uses the Tasks quick-view pills (card fill and border, charcoal for the selected one) in one row that scrolls sideways on a phone; it was a different pill that wrapped into four rows.
- The Overview's Filter and period controls are page-header actions (as on Tasks, Projects and Kanban), not a row in the body; the Overview draws its own header and receives the tab strip.
- Spacing follows the dashboard: 16px between stat cards (92px skeletons), 24px between sections and chart cards, the standard 24px × 22px card padding, an 18px heading gap.
- The four Overview charts sit in two independent columns (as on the dashboard) instead of a stretched grid: Task Completion and Team Productivity on the left, Project Progress and Workload on the right. Below 900px they are one column in the old reading order. The Workload card is tall with a large team, so the left column ends above it.
- The period control (*This Week* and the others) is a standard secondary button (40px, 8px radius, 13.5px text) like *Filter* beside it; it was the Dashboard's smaller 30px chart dropdown, which looked undersized in the page header next to the 40px controls.

**Project role names (2026-10-14)**
- A project role has one name on every screen, from `projectRoleLabel` in `api/format.js`: *Owner*, *Admin (Team Leader)*, *Member (Team Member)*, *Viewer*. The role pickers (the project page's team list, the *Add member* panel on both pages, the Team page's invite picker), the role badges, the Team Tasks tab and the *Project role* column of the project report (screen and Excel / PDF) use it; role-change messages read "X is now Admin (Team Leader)". Roles & Permissions uses it too (the role list, the heading of the selected role, the checkbox labels) and keeps its note of the business names. Before this, the same two roles read *Admin* / *Member* on Roles & Permissions and *Team Leader* / *Team Member* elsewhere. Display labels only.

**Sticky page header (2026-10-14)**
- `TopBar` is `position: sticky` at the top on every page, on the Canvas background, above the content and below the sidebar and the overlays; a wrapped header pins only its first row. Checked on 19 pages at 1440, 820 and 390px in both themes: the header stays at the top with its title uncovered, the background matches the canvas, dropdowns, side panels and the mobile menu layer correctly, and no page gains a sideways scroll. Nothing else about the header changed.

**Still open**
- None known. Groups of overlapping avatars still clip the initials of every avatar except the top one; that is the intended stacking look.
