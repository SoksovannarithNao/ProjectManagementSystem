# Calendar

**Route** `/calendar` · **Access** any signed-in user (their projects only) · **Source** [Calendar.jsx](../../frontend/src/pages/Calendar.jsx)

## What it does
Shows task due dates and milestones on a Month, Week or Day view.

## How it works
- **Navigation:** previous / next buttons step by a month, a week or a day; **Today** returns to the current date; a switch chooses Month, Week or Day.
- **Reading:** only the days on screen are requested (tasks and milestones due in that window), and a new request is made when the window changes. If milestones fail to load, the tasks still show.
- **Chips:** a task chip is coloured by priority (a completed one is struck through); a milestone chip is neutral with a flag and a hidden "Milestone:" label. On a phone the month cells show only coloured dots.
- **Day drawer:** clicking a day opens a side drawer with that day's items; choosing an item shows its detail beside the list (the task detail panel, or the milestone panel with its linked tasks). Clicking a chip opens the drawer on that day with the item already chosen.
- **New Event** (and the add button inside the drawer) opens the task form with the date filled in. It appears only if the person may create tasks in at least one project; the form offers just those projects.
- The week and day views show "No due dates in this range" when empty.

## Data
`api/tasks.js` (tasks due between two dates, by id, by milestone), `api/milestones.js`, `api/calendarRange.js` (window maths).
