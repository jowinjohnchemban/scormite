/**
 * The empty state people (and search engines) land on: what SCORMite is,
 * the drop zone, what it can do, and common questions. The text comes from
 * `siteSeoConfig`, the same source as the page's meta tags, JSON-LD, and
 * no-JS fallback — the indexed content is exactly what is shown.
 */

import type { ReactNode } from 'react'
import { siteSeoConfig } from '@/shared/config/seo'

export function LandingContent({ dropZone }: { dropZone: ReactNode }) {
  const { headline, summary, features, faqs } = siteSeoConfig
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8 sm:py-10">
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">{headline}</h1>
          <p className="mx-auto mt-3 max-w-3xl text-sm text-slate-400">{summary}</p>
        </div>

        <div className="h-72 shrink-0">{dropZone}</div>

        <section aria-labelledby="landing-features">
          <h2 id="landing-features" className="mb-3 text-sm font-semibold text-slate-200">
            What you can do
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <li key={feature.title} className="rounded-md border border-border-subtle bg-surface-900 p-3">
                <h3 className="text-xs font-semibold text-slate-200">{feature.title}</h3>
                <p className="mt-1 text-xs text-slate-400">{feature.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="landing-faq">
          <h2 id="landing-faq" className="mb-3 text-sm font-semibold text-slate-200">
            Frequently asked questions
          </h2>
          <div className="divide-y divide-border-subtle rounded-md border border-border-subtle bg-surface-900">
            {faqs.map((faq) => (
              <details key={faq.question} className="group px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent">
                  {faq.question}
                </summary>
                <p className="mt-2 text-xs text-slate-400">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
