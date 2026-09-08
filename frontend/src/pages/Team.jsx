import { useState } from 'react'
import { UserPlus, Mail, FolderKanban, ListChecks, Search } from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { Avatar } from '../components/ui/Avatar'
import { projects, teamMembers, activityFeed } from '../data/mockData'

export function Team() {
  const [selectedId, setSelectedId] = useState(teamMembers[0].id)
  const [query, setQuery] = useState('')

  const selected = teamMembers.find((m) => m.id === selectedId)
  const memberProjects = projects.filter((p) => p.members.includes(selectedId))
  const memberActivity = activityFeed.filter((a) => a.user === selectedId)

  const filtered = teamMembers.filter((m) =>
    m.name.toLowerCase().includes(query.toLowerCase()) || m.role.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div>
      <TopBar
        title="Team"
        subtitle={`${teamMembers.length} members collaborating across projects`}
        showSearch={false}
        actions={
          <button className="btn btn-primary">
            <UserPlus size={16} /> Invite Member
          </button>
        }
      />

      <div className="grid grid-cols-[320px_1fr] items-start gap-5 max-[900px]:grid-cols-1">
        <section className="card flex flex-col gap-3 p-4">
          <div className="bg-subtle border-border text-faint flex h-10 items-center gap-2 rounded-md border px-3">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search members"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="text-ink w-full border-none bg-transparent text-[13px] outline-none"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            {filtered.map((m) => (
              <button
                key={m.id}
                className={`hover:bg-subtle duration-[var(--duration-fast)] ease-[var(--ease-standard)] flex items-center gap-3 rounded-md border-none bg-none p-2.5 text-left transition-colors ${
                  m.id === selectedId ? 'bg-subtle shadow-[inset_0_0_0_1px_var(--color-border)]' : ''
                }`}
                onClick={() => setSelectedId(m.id)}
              >
                <Avatar initials={m.initials} color={m.color} size={38} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-ink truncate text-[13.5px] font-[650]">{m.name}</span>
                  <span className="text-faint text-[11.5px]">{m.role}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {selected && (
          <section className="card px-[26px] py-6">
            <div className="border-divider mb-5 flex items-center gap-4 border-b pb-5">
              <Avatar initials={selected.initials} color={selected.color} size={64} />
              <div>
                <h2 className="text-[19px] font-bold tracking-[-0.01em]">{selected.name}</h2>
                <p className="text-muted my-1 text-[13px]">{selected.role}</p>
                <span className="text-faint inline-flex items-center gap-1.5 text-[12.5px]">
                  <Mail size={13} /> {selected.email}
                </span>
              </div>
            </div>

            <div className="mb-6 flex gap-3.5">
              <div className="bg-subtle border-border text-muted flex flex-1 items-center gap-3 rounded-md border px-4 py-3.5">
                <ListChecks size={16} />
                <div>
                  <span className="text-ink block text-lg font-bold">{selected.tasks}</span>
                  <span className="text-faint mt-0.5 block text-[11.5px]">Assigned Tasks</span>
                </div>
              </div>
              <div className="bg-subtle border-border text-muted flex flex-1 items-center gap-3 rounded-md border px-4 py-3.5">
                <FolderKanban size={16} />
                <div>
                  <span className="text-ink block text-lg font-bold">{selected.projects}</span>
                  <span className="text-faint mt-0.5 block text-[11.5px]">Projects</span>
                </div>
              </div>
            </div>

            <div className="mb-[22px]">
              <h4 className="mb-3 text-[13px] font-[650]">Projects</h4>
              {memberProjects.length === 0 && (
                <p className="text-faint text-[12.5px]">No active projects.</p>
              )}
              <div className="flex flex-col gap-0.5">
                {memberProjects.map((p) => (
                  <div
                    key={p.id}
                    className="border-divider flex items-center justify-between border-b py-2.5 text-[13px] font-semibold last:border-b-0"
                  >
                    <span>{p.name}</span>
                    <span className="text-muted font-[650]">{p.progress}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-[22px]">
              <h4 className="mb-3 text-[13px] font-[650]">Recent Activity</h4>
              {memberActivity.length === 0 && (
                <p className="text-faint text-[12.5px]">No recent activity.</p>
              )}
              <div className="flex flex-col gap-3">
                {memberActivity.map((a) => (
                  <div key={a.id} className="text-muted flex items-baseline gap-2.5 text-[12.5px]">
                    <span className="bg-lavender mb-px h-1.5 w-1.5 shrink-0 rounded-full" />
                    <p className="text-muted flex-1">
                      {a.action} <strong className="text-ink font-[650]">{a.target}</strong>
                    </p>
                    <span className="text-faint text-[11.5px] whitespace-nowrap">{a.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
