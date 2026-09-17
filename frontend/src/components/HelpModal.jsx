import { Mail } from 'lucide-react'
import { Modal } from './ui/Modal'

const FAQS = [
  {
    q: 'How do I create a task?',
    a: 'Go to Tasks or the Kanban board and use "New Task" (or "Add task" on the To Do column/section — tasks always start there and move forward as their status changes).',
  },
  {
    q: 'Who can create projects or tasks?',
    a: 'Projects: Administrators and Project Managers. Tasks: Administrators, Project Managers, and Team Leaders. Everyone can update the status of tasks assigned to them.',
  },
  {
    q: 'How do I change my password?',
    a: 'Open Settings from the sidebar and use the Password section.',
  },
  {
    q: 'How do I add a brand-new person to the team?',
    a: '"Invite Member" on the Team page creates their account directly (Administrators only) — share the temporary password with them so they can sign in and change it themselves in Settings.',
  },
  {
    q: 'How do I add an existing user to one of my projects?',
    a: 'Select them on the Team page, pick a project from "Invite to team," and send the invitation (Administrators, Project Managers, and Team Leaders who administer that project). They\'ll get a notification to Accept or Decline — nothing changes until they respond.',
  },
  {
    q: "Who controls my Position and Department?",
    a: 'Only a Team Admin (a Project Manager or Team Leader on one of your projects) can set these — see them under Team Information on your Profile page.',
  },
]

export function HelpModal({ onClose }) {
  return (
    <Modal title="Help & Support" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {FAQS.map((item) => (
          <div key={item.q}>
            <p className="text-ink mb-1 text-[13px] font-semibold">{item.q}</p>
            <p className="text-muted text-[12.5px] leading-relaxed">{item.a}</p>
          </div>
        ))}

        <div className="border-divider text-muted flex items-center gap-2 border-t pt-4 text-[12.5px]">
          <Mail size={14} className="shrink-0" />
          Still stuck? Reach your workspace administrator — account and permission changes go through them.
        </div>
      </div>
    </Modal>
  )
}
