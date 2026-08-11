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
  llms: readonly {
    id: string
    name?: string
    description?: string
    url?: string
  }[]
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
  llms: [
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      description: 'Cost-efficient, general-purpose large language model for shorter requests.',
      url: 'https://platform.openai.com/models/gpt-4o-mini',
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      description: 'High-capacity conversational model suitable for general reasoning and generation.',
      url: 'https://platform.openai.com/models/gpt-4o',
    },
    {
      id: 'gpt-4.1',
      name: 'GPT-4.1',
      description: 'Extended reasoning and capability model for complex tasks.',
      url: 'https://platform.openai.com/models/gpt-4.1',
    },
  ],
}
