export interface SiteSeoConfig {
  title: string
  description: string
  themeColor: string
  favicon: string
  twitterSite: string
  twitterCreator: string
  locale: string
  siteUrl: string
  routes: readonly string[]
  llms: readonly string[]
}

export const siteSeoConfig: SiteSeoConfig = {
  title: 'SCORMite',
  description:
    'DevTools for your SCORM package. Drop a .zip and run it locally with live API transcript, CMI inspector, timeline replay, breakpoints, validation, and runtime profiles. No upload. No account.',
  themeColor: '#111827',
  favicon: '/logo.png',
  twitterSite: '@scormite',
  twitterCreator: '@scormite',
  locale: 'en_US',
  siteUrl: 'https://scormite.jowinjc.in',
  routes: ['/'],
  llms: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1'],
}
