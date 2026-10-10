import { BellRing, Compass, FolderKanban, LifeBuoy, Mail, Wrench } from 'lucide-react'
import { TopBar } from '../layout/TopBar'

const SECTIONS = [
  {
    icon: Compass,
    title: 'Getting started',
    items: [
      {
        q: 'How do I create a task?',
        a: 'Open Tasks or the Kanban board and use "New Task". Tasks start in To Do and move forward as their status changes.',
      },
      {
        q: 'How do I change my password?',
        a: 'Open your Profile page and use the Password section. Settings only holds the theme and notification preferences.',
      },
      {
        q: 'How do I change my position or department?',
        a: 'On your Profile page, under Personal Information, choose from the lists. An Administrator manages what is on the lists.',
      },
      {
        q: 'How do I switch between light and dark?',
        a: 'Open Settings and pick a theme under Appearance. "System" follows your device.',
      },
    ],
  },
  {
    icon: FolderKanban,
    title: 'Projects and team',
    items: [
      {
        q: 'Who can create projects or tasks?',
        a: 'Projects: Administrators and Project Managers (the creator becomes the project Owner). Tasks: Administrators, the project Owner and Team Leaders. Team Members update the tasks assigned to them.',
      },
      {
        q: 'How do I add someone to my project?',
        a: 'Use "Add member" on the project page, or select the person on the Team page and use "Invite to team". They get a notification to accept or decline, and nothing changes until they respond.',
      },
      {
        q: 'How do I add a brand-new person?',
        a: '"Invite Member" on the Team page creates their account directly (Administrators only). Share the temporary password so they can sign in and change it on their Profile page.',
      },
      {
        q: "How do I change someone's role in a project?",
        a: "Use the role picker next to the person in the project's member list. Making someone the Owner transfers ownership and asks you to confirm.",
      },
    ],
  },
  {
    icon: BellRing,
    title: 'Work, approvals and reminders',
    items: [
      {
        q: 'How does a task get approved?',
        a: 'When a task moves to In Review, an approval request opens. The designated approver, a Team Leader or the Owner approves it, asks for changes or rejects it with a comment. Nobody approves their own work except the Owner, and a Team Member cannot mark a task Completed directly.',
      },
      {
        q: 'When will I be reminded about a deadline?',
        a: 'You get a notification 3 days and 1 day before a task, milestone or project deadline, and one when a task becomes overdue. They go to the assignees and the project Owner, and you can switch them off under Settings → Notifications.',
      },
      {
        q: 'Where can I see the schedule?',
        a: 'The Calendar page shows due dates. Each project page has Timeline and Gantt views for its tasks, milestones and dependencies.',
      },
    ],
  },
  {
    icon: Wrench,
    title: 'Troubleshooting',
    items: [
      {
        q: 'It says I do not have access to a page.',
        a: 'Your role does not include that permission. Ask an Administrator to change your role, or the Owner of the project if it is about one project.',
      },
      {
        q: 'It says a project or page was not found.',
        a: 'The address may be wrong, or the project was deleted. You also see this when you are not a member of a project: the app does not say which.',
      },
      {
        q: 'It says the server cannot be reached.',
        a: 'Check your connection and use "Try again". If it keeps happening, tell your workspace administrator.',
      },
      {
        q: 'I was signed out, or sign-in is refused.',
        a: 'Sessions last one hour, then you sign in again. After five wrong passwords in a row, sign-in is paused for about 15 minutes.',
      },
    ],
  },
]

// Answers to the questions people ask most, written from what the app does today.
export function Help() {
  return (
    <div>
      <TopBar title="Help & Support" subtitle="Answers to common questions and where to get help" />

      <div className="grid max-w-[720px] grid-cols-1 gap-5">
        {SECTIONS.map(({ icon: Icon, title, items }) => (
          <section key={title} className="card px-6 py-5">
            <div className="mb-4 flex items-center gap-2.5">
              <Icon size={17} className="text-muted" />
              <h3 className="section-title text-base">{title}</h3>
            </div>
            <div className="flex flex-col gap-4">
              {items.map((item) => (
                <div key={item.q}>
                  <p className="text-ink mb-1 text-[13px] font-semibold">{item.q}</p>
                  <p className="text-muted text-[12px] leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="card px-6 py-5">
          <div className="mb-3 flex items-center gap-2.5">
            <LifeBuoy size={17} className="text-muted" />
            <h3 className="section-title text-base">Still stuck?</h3>
          </div>
          <div className="text-muted flex items-center gap-2 text-[12px]">
            <Mail size={14} className="shrink-0" />
            Reach your workspace administrator — account and permission changes go through them.
          </div>
        </section>
      </div>
    </div>
  )
}
