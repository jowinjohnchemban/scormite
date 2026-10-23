/**
 * Single source of truth for everything search engines, social cards, and
 * AI assistants read about SCORMite: the document head, JSON-LD, the static
 * crawlable fallback in index.html, robots.txt, sitemap.xml, llms.txt,
 * llms-full.txt, and the web app manifest (see `build/seoPlugin.ts`) — and the landing content
 * the app itself renders, so what crawlers index is exactly what people see.
 *
 * Plain data, no `@/` imports: vite.config.ts loads this file directly.
 * Every claim here must describe something the app really does.
 */

export interface SeoFeature {
  title: string
  description: string
}

export interface SeoFaq {
  question: string
  answer: string
}

export interface SeoAuthor {
  name: string
  /** Personal site. */
  url: string
  /** Profiles that identify the same person (schema.org sameAs). */
  profiles: readonly string[]
}

export interface SiteSeoConfig {
  name: string
  /** Who designed and built SCORMite: the About page credit and the JSON-LD author. */
  author: SeoAuthor
  /** Where the source code is published, and under which licence (SPDX id). */
  source: { url: string; license: string }
  /** `<title>` — keyword-first, under ~65 characters. */
  title: string
  /** Meta / OG description — under ~160 characters. */
  description: string
  /** One-line value proposition shown as the landing heading. */
  headline: string
  /** Longer plain-language summary (landing intro, llms.txt, JSON-LD). */
  summary: string
  keywords: readonly string[]
  themeColor: string
  backgroundColor: string
  favicon: string
  /** 1200×630 social preview, relative to the site root. */
  ogImage: string
  ogImageAlt: string
  locale: string
  siteUrl: string
  /**
   * User documents published as Markdown at the same path and listed in
   * llms.txt (full text in llms-full.txt). Their relative links may only
   * point at each other — the build fails otherwise.
   */
  docs: readonly string[]
  features: readonly SeoFeature[]
  faqs: readonly SeoFaq[]
}

export const siteSeoConfig: SiteSeoConfig = {
  name: 'SCORMite',
  author: {
    name: 'Jowin John Chemban',
    url: 'https://jowinjc.in',
    profiles: ['https://github.com/jowinjohnchemban'],
  },
  source: { url: 'https://github.com/jowinjohnchemban/scormite', license: 'MIT' },
  title: 'SCORMite – SCORM Tester & Debugger for SCORM 1.2 and 2004',
  description:
    'Test SCORM 1.2 and 2004 packages in your browser before uploading to your LMS. Play the course, see what it tracks, catch packaging errors, export QA reports.',
  headline: 'Test, debug and validate SCORM packages in your browser',
  summary:
    'Drop a SCORM .zip to play the course and see exactly what it reports — so you catch tracking problems before uploading it to your LMS. Everything runs in your browser; your package is never uploaded.',
  keywords: [
    'SCORM tester',
    'SCORM player',
    'SCORM debugger',
    'SCORM validator',
    'test SCORM package',
    'SCORM package viewer',
    'SCORM 1.2',
    'SCORM 2004',
    'SCORM 2004 4th Edition',
    'imsmanifest.xml validator',
    'SCORM API',
    'CMI data model',
    'suspend_data',
    'LMS testing',
    'eLearning QA',
    'e-learning course testing',
    'SCORM Cloud alternative',
    'Articulate Storyline SCORM',
    'Rise 360 SCORM',
    'Adobe Captivate SCORM',
    'iSpring SCORM',
    'Lectora SCORM',
    'Moodle SCORM',
    'Canvas SCORM',
  ],
  themeColor: '#101317',
  backgroundColor: '#0b0d10',
  favicon: '/logo.svg',
  ogImage: '/og-image.png',
  ogImageAlt: 'SCORMite — test, debug and validate SCORM 1.2 and 2004 packages in your browser',
  locale: 'en_US',
  siteUrl: 'https://scormite.jowinjc.in',
  docs: ['docs/user-guide.md', 'docs/scorm-support.md', 'docs/ai-agents.md'],
  features: [
    {
      title: 'Run any SCORM package',
      description:
        'Drop a .zip to play the course right away. Everything runs in your browser — nothing is uploaded, no account needed.',
    },
    {
      title: 'SCORM 1.2 and SCORM 2004',
      description: 'Supports SCORM 1.2 and SCORM 2004 2nd, 3rd and 4th Edition packages.',
    },
    {
      title: 'Multi-SCO courses and resume',
      description: 'Move between lessons, and relaunch a lesson to check it resumes where the learner left off.',
    },
    {
      title: 'See what the course reports',
      description:
        'Every SCORM call the course makes, and its live tracking data: completion, pass/fail, score, location and suspend data.',
    },
    {
      title: 'Catch packaging problems',
      description:
        'Missing files, broken references, a manifest that is not at the zip root, and out-of-range scores are flagged for you.',
    },
    {
      title: 'Share a QA report',
      description: 'Download the session as an HTML, Markdown, JSON or CSV report.',
    },
  ],
  faqs: [
    {
      question: 'Is my SCORM package uploaded anywhere?',
      answer:
        'No. SCORMite runs entirely in your browser. The package is unzipped locally and cleared when you close it.',
    },
    {
      question: 'Which SCORM versions are supported?',
      answer:
        'SCORM 1.2 and SCORM 2004 (2nd, 3rd and 4th Edition). SCORM 1.1 packages also run. AICC, xAPI (Tin Can) and cmi5 are not supported.',
    },
    {
      question: 'Is SCORMite an LMS?',
      answer: 'No. It is a testing tool: it plays the course and shows what it reports, but keeps no learner records.',
    },
    {
      question: 'How do I test resume?',
      answer:
        'Go partway through the course, then choose Restart › Relaunch (resume). Choose New attempt to start over with no saved data.',
    },
    {
      question: 'Is SCORMite free and open source?',
      answer: 'Yes. SCORMite is free to use and open source under the MIT licence; the source code is on GitHub.',
    },
    {
      question: 'Can an AI agent test a package in SCORMite?',
      answer:
        'Yes, in browsers with WebMCP: an agent can follow a test plan for the package, take the course like a learner, check what it reports and its content, and summarise the findings. You open the package; nothing is uploaded by SCORMite.',
    },
    {
      question: 'Does it work with Storyline, Rise, Captivate, iSpring or Lectora?',
      answer:
        'Yes. Export your course as SCORM 1.2 or SCORM 2004 and drop the .zip in to test it before uploading to your LMS.',
    },
  ],
}
