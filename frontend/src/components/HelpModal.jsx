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
    q: 'How do I add someone to the team?',
    a: '"Invite Member" on the Team page creates their account directly (Administrators only) — share the temporary password with them so they can sign in and change it themselves in Settings.',
  },
  {
    q: 'Why can\'t I see subtasks or comments I added earlier?',
    a: "Those are local to your current session — the backend doesn't have storage for them yet, so they reset when you close a task's panel.",
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
