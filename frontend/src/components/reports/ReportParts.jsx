import { useState } from 'react'
import { FileBarChart } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import { Skeleton } from '../ui/Skeleton'
import { fullDate } from './reportFormat'
import { useReportableProjects } from './useReportableProjects'
import { useMembers } from '../../data/UsersContext'

// A plain table: columns [{ key, label, align?, render?(row) }].
export function ReportTable({ columns, rows, empty = 'Nothing to show for these filters.', testId }) {
  if (!rows || rows.length === 0) return <p className="text-faint py-2 text-[12px]">{empty}</p>
  return (
    <div className="overflow-x-auto" data-testid={testId}>
      <table className="w-full min-w-[560px] text-left text-[13px]">
        <thead>
          <tr className="text-faint border-divider border-b text-[12px] font-semibold">
            {columns.map((c) => (
              <th key={c.key} className={`px-2 py-2 font-semibold first:pl-0 ${c.align === 'right' ? 'text-right' : ''}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? row.key ?? i} className="border-divider border-b last:border-b-0" data-testid="report-row">
              {columns.map((c) => (
                <td key={c.key} className={`px-2 py-2.5 first:pl-0 ${c.align === 'right' ? 'text-right' : ''}`}>
                  {c.render ? c.render(row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SummaryTiles({ items }) {
  return (
    <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
      {items.map((t) => (
        <div key={t.label} className="bg-subtle rounded-md px-3 py-2.5">
          <p className={`text-[17px] font-bold ${t.tone === 'danger' && Number(t.value) > 0 ? 'text-danger-ink' : 'text-ink'}`}>
            {t.value}
          </p>
          <p className="text-muted text-[12px] font-semibold">{t.label}</p>
        </div>
      ))}
    </div>
  )
}

// One report: its filter bar, an explicit "Generate" step (workflow flow 32) and the
// result below. `fields` describe the filters; `run(values)` calls the API;
// `children(data)` draws the result.
//   field: { name, label, type: 'project' | 'user' | 'select' | 'date', options?, required?, noneLabel? }
export function ReportRunner({ title, hint, fields, initial = {}, run, children, testId }) {
  const projects = useReportableProjects()
  const { members } = useMembers()
  const [values, setValues] = useState(initial)
  const [state, setState] = useState({ phase: 'idle', data: null, error: null })

  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }))

  const generate = async (e) => {
    e.preventDefault()
    const missing = fields.find((f) => f.required && !values[f.name])
    if (missing) {
      setState({ phase: 'error', data: null, error: `Choose ${missing.label.toLowerCase()} first.` })
      return
    }
    setState({ phase: 'loading', data: null, error: null })
    try {
      setState({ phase: 'done', data: await run(values), error: null })
    } catch (err) {
      setState({ phase: 'error', data: null, error: err.message || 'Failed to generate the report' })
    }
  }

  return (
    <section className="card px-6 py-5" data-testid={testId}>
      <h3 className="section-title">{title}</h3>
      {hint && <p className="text-muted mt-1 mb-4 text-[12px]">{hint}</p>}

      <form onSubmit={generate} className="mb-5 flex flex-wrap items-end gap-3">
        {fields.map((f) => (
          <label key={f.name} className="flex flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">{f.label}</span>
            {f.type === 'date' ? (
              <input
                type="date"
                aria-label={f.label}
                value={values[f.name] ?? ''}
                onChange={(e) => set(f.name, e.target.value)}
                className="field field-sm"
              />
            ) : (
              <select
                aria-label={f.label}
                value={values[f.name] ?? ''}
                onChange={(e) => set(f.name, e.target.value)}
                className="field field-sm min-w-[150px]"
              >
                {!f.required && <option value="">{f.noneLabel ?? 'All'}</option>}
                {f.required && !values[f.name] && <option value="">Choose…</option>}
                {f.type === 'project' &&
                  projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                {f.type === 'user' &&
                  members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                {f.type === 'select' &&
                  f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
              </select>
            )}
          </label>
        ))}
        <button type="submit" className="btn btn-primary" disabled={state.phase === 'loading'}>
          <FileBarChart size={15} /> {state.phase === 'loading' ? 'Generating…' : 'Generate'}
        </button>
      </form>

      {state.phase === 'idle' && <p className="text-faint text-[12px]">Choose the filters and press Generate.</p>}
      {state.phase === 'loading' && <Skeleton className="h-[140px] rounded-md" />}
      {state.phase === 'error' && (
        <EmptyState icon={FileBarChart} title="The report could not be generated" subtitle={state.error} />
      )}
      {state.phase === 'done' && (
        <div data-testid="report-result">
          <p className="text-faint mb-3 text-[12px]">
            {state.data.scope.projectName ?? `All your projects (${state.data.scope.projects})`}
            {state.data.scope.from || state.data.scope.to
              ? ` · ${fullDate(state.data.scope.from)} – ${fullDate(state.data.scope.to)}`
              : ''}
            {' · '}generated {new Date(state.data.scope.generatedAt).toLocaleString()}
          </p>
          {children(state.data)}
        </div>
      )}
    </section>
  )
}
