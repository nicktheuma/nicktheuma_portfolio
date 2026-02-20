import { createContext } from 'react'
import type { PageTheme, Project } from './media'

export type SiteSettings = {
  brandName: string
  footerText: string
}

export type HomeContent = {
  heading: string
  intro: string
  details: string
}

export type MediaTileSize = 'tiny' | 'small' | 'wide' | 'tall' | 'large' | 'xwide' | 'xtall' | 'hero'

export type HomeGridSettings = {
  columns: number
  rowGap: number
  columnGap: number
  itemHeight: number
}

export type ProjectGridSettings = {
  columns: number
  rowHeight: number
  rowGap: number
  columnGap: number
}

export type ProjectMediaLayoutItem = {
  order: number
  tile: MediaTileSize
  monochrome?: boolean
}

export type ProjectMediaLayout = Record<string, ProjectMediaLayoutItem>

export type ProjectOverride = Partial<Pick<Project, 'title' | 'summary' | 'body' | 'categoryId' | 'tagIds' | 'thumbnailSrc' | 'thumbnailMonochrome'>>

export type AdminSettings = {
  code?: string
}

export type SiteOverrides = {
  siteSettings?: Partial<SiteSettings>
  adminSettings?: AdminSettings
  homeContent?: Partial<HomeContent>
  homeTheme?: Partial<PageTheme>
  homeGridSettings?: Partial<HomeGridSettings>
  projectThemes?: Record<string, Partial<PageTheme>>
  projectGridSettings?: Record<string, Partial<ProjectGridSettings>>
  projects?: Record<string, ProjectOverride>
  projectMediaLayouts?: Record<string, ProjectMediaLayout>
}

export type SiteContentContextValue = {
  isAdmin: boolean
  unlockAdmin: (code: string) => boolean
  lockAdmin: () => void
  clearOverrides: () => void
  updateAdminCode: (code: string) => void
  siteSettings: SiteSettings
  updateSiteSettings: (changes: Partial<SiteSettings>) => void
  homeContent: HomeContent
  updateHomeContent: (changes: Partial<HomeContent>) => void
  homeTheme: PageTheme
  updateHomeTheme: (changes: Partial<PageTheme>) => void
  homeGridSettings: HomeGridSettings
  updateHomeGridSettings: (changes: Partial<HomeGridSettings>) => void
  projects: Project[]
  getProjectBySlug: (slug: string) => Project | undefined
  getProjectTheme: (slug: string) => PageTheme
  getProjectGridSettings: (slug: string) => ProjectGridSettings
  updateProjectGridSettings: (slug: string, changes: Partial<ProjectGridSettings>) => void
  updateProject: (slug: string, changes: ProjectOverride) => void
  updateProjectTheme: (slug: string, changes: Partial<PageTheme>) => void
  clearProjectTheme: (slug: string) => void
  getProjectMediaLayout: (slug: string) => ProjectMediaLayout
  setProjectMediaLayout: (slug: string, layout: ProjectMediaLayout) => void
  clearProjectMediaLayout: (slug: string) => void
}

export const SiteContentContext = createContext<SiteContentContextValue | null>(null)
