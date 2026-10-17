import { Link } from 'react-router-dom'
import { Bell, CalendarDays, KanbanSquare, ListChecks, ShieldCheck, FolderKanban } from 'lucide-react'
import { PublicLayout } from '../components/public/PublicLayout'
import { useAuth } from '../auth/AuthContext'
import { SITE } from '../config/site'

// What the product does, stated from the features that exist in the application (README, Features).
const FEATURES = [
  {
    icon: FolderKanban,
    title: 'Projects and milestones',
    text: 'Plan a project with dates, a team and milestones, and follow its progress from one page.',
  },
  {
    icon: ListChecks,
    title: 'Tasks, subtasks and checklists',
    text: 'Break work into tasks with priorities, assignees, due dates, subtasks, checklists and dependencies.',
  },
  {
    icon: KanbanSquare,
    title: 'Board and calendar',
    text: 'Move cards across a Kanban board, or see due dates and milestones by month, week or day.',
  },
  {
    icon: ShieldCheck,
    title: 'Roles and approvals',
    text: 'Project roles decide what each person may do, and finished work can go through a review and approval step.',
  },
  {
    icon: Bell,
    title: 'Notifications and deadlines',
    text: 'Get notified about assignments, approvals and mentions, with reminders before a deadline and notices when work is overdue.',
  },
  {
    icon: CalendarDays,
    title: 'Dashboard and reports',
    text: 'See due and overdue work, delayed projects and team workload at a glance, and export reports.',
  },
]

// The public home page, shown at "/" to anyone who is not signed in (a signed-in person gets the dashboard).
export function Landing() {
  const { isAuthenticated } = useAuth()

  return (
    <PublicLayout>
      <section className="mx-auto max-w-[1080px] px-6 pt-14 pb-10 max-sm:px-4 max-sm:pt-10">
        <p className="text-muted text-[13px] font-semibold tracking-[0.04em] uppercase">Project management</p>
        <h1 className="mt-2 max-w-[18ch] text-[44px] leading-[1.08] font-bold tracking-[-0.03em] max-sm:text-[32px]">
          Plan the work. Track it to done.
        </h1>
        <p className="text-muted mt-4 max-w-[62ch] text-[16px] leading-relaxed">
          {SITE.name} is a project and task management web application. Teams use it to organise projects, assign
          tasks, follow deadlines and see where the work stands, with access controlled by each person&apos;s role.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          {isAuthenticated ? (
            <Link to="/" className="btn btn-primary py-[11px]">
              Open {SITE.name}
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-primary py-[11px]">
                Sign in
              </Link>
              <Link to="/register" className="btn btn-secondary py-[11px]">
                Create account
              </Link>
            </>
          )}
        </div>
        <p className="text-muted mt-3 text-[12px]">
          Accounts are created by an administrator, or you can register and confirm your e-mail address with a
          one-time code.
        </p>
      </section>

      <section aria-labelledby="features-h" className="mx-auto max-w-[1080px] px-6 pb-14 max-sm:px-4">
        <h2 id="features-h" className="text-[20px] font-bold tracking-[-0.01em]">
          What you can do with {SITE.name}
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="card flex flex-col gap-2 px-5 py-5">
              <span className="bg-subtle text-ink inline-flex h-9 w-9 items-center justify-center rounded-md">
                <Icon size={18} aria-hidden="true" />
              </span>
              <h3 className="text-[15px] font-bold">{title}</h3>
              <p className="text-muted text-[13px] leading-relaxed">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="about-h" className="border-divider bg-card border-t">
        <div className="mx-auto max-w-[1080px] px-6 py-10 max-sm:px-4">
          <h2 id="about-h" className="text-[20px] font-bold tracking-[-0.01em]">
            About this service
          </h2>
          <p className="text-muted mt-3 max-w-[70ch] text-[14px] leading-relaxed">
            {SITE.name} is run by {SITE.operator}. Read how personal data is handled in the{' '}
            <Link to="/privacy-policy" className="text-ink font-semibold hover:underline">
              Privacy Policy
            </Link>{' '}
            and what is expected of everyone who uses the service in the{' '}
            <Link to="/terms-of-service" className="text-ink font-semibold hover:underline">
              Terms of Service
            </Link>
            . Questions can be sent to{' '}
            <a href={`mailto:${SITE.contactEmail}`} className="text-ink font-semibold hover:underline">
              {SITE.contactEmail}
            </a>
            .
          </p>
        </div>
      </section>
    </PublicLayout>
  )
}
