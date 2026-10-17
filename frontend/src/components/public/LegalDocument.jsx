import { PublicLayout } from './PublicLayout'

// One reading layout for the privacy policy and the terms of service: a title, the date of the last
// substantive change, an on-this-page list, and numbered sections whose headings can be linked to.
export function LegalDocument({ title, updated, intro, sections }) {
  return (
    <PublicLayout title={title}>
      <article className="mx-auto max-w-[760px] px-6 py-10 max-sm:px-4 max-sm:py-8">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] max-sm:text-[24px]">{title}</h1>
        <p className="text-muted mt-1 text-[13px]">Last updated: {updated}</p>
        <div className="text-muted mt-5 space-y-3 text-[14px] leading-relaxed">{intro}</div>

        <nav aria-label="On this page" className="card mt-7 px-5 py-4">
          <p className="text-ink text-[13px] font-semibold">On this page</p>
          <ol className="text-muted mt-2 grid list-decimal gap-x-8 gap-y-1 pl-5 text-[13px] sm:grid-cols-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-ink hover:underline">
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="mt-9 scroll-mt-6">
            <h2 id={`${s.id}-h`} className="text-[18px] font-bold tracking-[-0.01em]">
              {i + 1}. {s.heading}
            </h2>
            <div className="text-muted mt-3 space-y-3 text-[14px] leading-relaxed [&_li]:mt-1.5 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5">
              {s.body}
            </div>
          </section>
        ))}
      </article>
    </PublicLayout>
  )
}
