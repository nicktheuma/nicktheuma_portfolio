import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  defaultPageTheme,
  homePageTheme as baseHomePageTheme,
  type PageTheme,
  projectPageThemes,
  projects as baseProjects,
  type Project,
} from './media'
import {
  type HomeGridSettings,
  type HomeContent,
  type ProjectGridSettings,
  type ProjectMediaLayout,
  type ProjectOverride,
  SiteContentContext,
  type SiteContentContextValue,
  type SiteOverrides,
  type SiteSettings,
} from './site-content-context'

const overridesStorageKey = 'nicktheuma.site-overrides.v1'
const adminEnabledStorageKey = 'nicktheuma.admin-enabled.v1'
const fallbackAdminCode = 'NT_ADMIN_2026'

const defaultSiteSettings: SiteSettings = {
  brandName: 'Nick Theuma',
  footerText: 'Currently under construction. Disregard anything you see. It is all too real.',
}

const defaultHomeContent: HomeContent = {
  heading: 'Rendering, Modelling & Furniture Building',
  intro:
    'This portfolio combines interactive 3D, project writing, and media galleries. Each project gets its own page, and this homepage acts as your master project index.',
  details:
    'Update project data in src/content/media.ts, drop files into public/media folders, and your homepage thumbnails and project pages will stay in sync.',
}

const defaultHomeGridSettings: HomeGridSettings = {
  columns: 4,
  rowGap: 1,
  columnGap: 1,
  itemHeight: 220,
}

const defaultProjectGridSettings: ProjectGridSettings = {
  columns: 12,
  rowHeight: 8,
  rowGap: 0.25,
  columnGap: 0.28,
}

function parseStoredOverrides(value: string | null): SiteOverrides {
  if (!value) {
    return {}
  }

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function mergeProject(baseProject: Project, override: ProjectOverride | undefined): Project {
  if (!override) {
    return baseProject
  }

  return {
    ...baseProject,
    ...override,
    body: override.body ?? baseProject.body,
    tagIds: override.tagIds ?? baseProject.tagIds,
  }
}

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.localStorage.getItem(adminEnabledStorageKey) === 'true'
  })

  const [overrides, setOverrides] = useState<SiteOverrides>(() => {
    if (typeof window === 'undefined') {
      return {}
    }

    return parseStoredOverrides(window.localStorage.getItem(overridesStorageKey))
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(overridesStorageKey, JSON.stringify(overrides))
  }, [overrides])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(adminEnabledStorageKey, isAdmin ? 'true' : 'false')
  }, [isAdmin])

  const siteSettings = useMemo<SiteSettings>(
    () => ({
      ...defaultSiteSettings,
      ...(overrides.siteSettings ?? {}),
    }),
    [overrides.siteSettings],
  )

  const homeContent = useMemo<HomeContent>(
    () => ({
      ...defaultHomeContent,
      ...(overrides.homeContent ?? {}),
    }),
    [overrides.homeContent],
  )

  const homeTheme = useMemo<PageTheme>(
    () => {
      const homeThemeOverrides = (overrides.homeTheme ?? {}) as Partial<PageTheme> & {
        heroPanelTextColor?: string
      }

      return {
        ...defaultPageTheme,
        ...baseHomePageTheme,
        ...homeThemeOverrides,
        panelTextColor: homeThemeOverrides.panelTextColor ?? homeThemeOverrides.heroPanelTextColor ?? defaultPageTheme.panelTextColor,
      }
    },
    [overrides.homeTheme],
  )

  const homeGridSettings = useMemo<HomeGridSettings>(
    () => ({
      ...defaultHomeGridSettings,
      ...(overrides.homeGridSettings ?? {}),
    }),
    [overrides.homeGridSettings],
  )

  const projects = useMemo<Project[]>(() => {
    const projectOverrides = overrides.projects ?? {}
    return baseProjects.map((project) => mergeProject(project, projectOverrides[project.slug]))
  }, [overrides.projects])

  const activeAdminCode = useMemo(() => {
    const overrideCode = overrides.adminSettings?.code?.trim()
    if (overrideCode) {
      return overrideCode
    }

    return import.meta.env.VITE_ADMIN_CODE ?? fallbackAdminCode
  }, [overrides.adminSettings?.code])

  const unlockAdmin = (code: string) => {
    const isValid = code.trim() === activeAdminCode
    setIsAdmin(isValid)
    return isValid
  }

  const lockAdmin = () => {
    setIsAdmin(false)
  }

  const clearOverrides = () => {
    setOverrides({})
  }

  const updateAdminCode = (code: string) => {
    const normalizedCode = code.trim()

    setOverrides((previous) => {
      if (!normalizedCode) {
        const { adminSettings, ...rest } = previous
        if (!adminSettings) {
          return previous
        }

        return rest
      }

      return {
        ...previous,
        adminSettings: {
          ...(previous.adminSettings ?? {}),
          code: normalizedCode,
        },
      }
    })
  }

  const updateSiteSettings = (changes: Partial<SiteSettings>) => {
    setOverrides((previous) => ({
      ...previous,
      siteSettings: {
        ...(previous.siteSettings ?? {}),
        ...changes,
      },
    }))
  }

  const updateHomeContent = (changes: Partial<HomeContent>) => {
    setOverrides((previous) => ({
      ...previous,
      homeContent: {
        ...(previous.homeContent ?? {}),
        ...changes,
      },
    }))
  }

  const updateHomeTheme = (changes: Partial<PageTheme>) => {
    setOverrides((previous) => ({
      ...previous,
      homeTheme: {
        ...(previous.homeTheme ?? {}),
        ...changes,
      },
    }))
  }

  const updateHomeGridSettings = (changes: Partial<HomeGridSettings>) => {
    setOverrides((previous) => ({
      ...previous,
      homeGridSettings: {
        ...(previous.homeGridSettings ?? {}),
        ...changes,
      },
    }))
  }

  const getProjectBySlug = (slug: string) => projects.find((project) => project.slug === slug)

  const getProjectTheme = (slug: string): PageTheme => {
    const hasProjectBaseTheme = projectPageThemes[slug] !== undefined
    const hasProjectThemeOverride = overrides.projectThemes?.[slug] !== undefined

    if (!hasProjectBaseTheme && !hasProjectThemeOverride) {
      return homeTheme
    }

    return {
      ...defaultPageTheme,
      ...(projectPageThemes[slug] ?? {}),
      ...(overrides.projectThemes?.[slug] ?? {}),
    }
  }

  const getProjectGridSettings = (slug: string): ProjectGridSettings => ({
    ...defaultProjectGridSettings,
    ...(overrides.projectGridSettings?.[slug] ?? {}),
  })

  const updateProjectGridSettings = (slug: string, changes: Partial<ProjectGridSettings>) => {
    setOverrides((previous) => ({
      ...previous,
      projectGridSettings: {
        ...(previous.projectGridSettings ?? {}),
        [slug]: {
          ...(previous.projectGridSettings?.[slug] ?? {}),
          ...changes,
        },
      },
    }))
  }

  const updateProject = (slug: string, changes: ProjectOverride) => {
    setOverrides((previous) => ({
      ...previous,
      projects: {
        ...(previous.projects ?? {}),
        [slug]: {
          ...(previous.projects?.[slug] ?? {}),
          ...changes,
        },
      },
    }))
  }

  const updateProjectTheme = (slug: string, changes: Partial<PageTheme>) => {
    setOverrides((previous) => ({
      ...previous,
      projectThemes: {
        ...(previous.projectThemes ?? {}),
        [slug]: {
          ...(previous.projectThemes?.[slug] ?? {}),
          ...changes,
        },
      },
    }))
  }

  const clearProjectTheme = (slug: string) => {
    setOverrides((previous) => {
      const currentThemes = previous.projectThemes ?? {}
      if (!(slug in currentThemes)) {
        return previous
      }

      const remainingThemes = { ...currentThemes }
      delete remainingThemes[slug]
      return {
        ...previous,
        projectThemes: remainingThemes,
      }
    })
  }

  const getProjectMediaLayout = (slug: string): ProjectMediaLayout => overrides.projectMediaLayouts?.[slug] ?? {}

  const setProjectMediaLayout = (slug: string, layout: ProjectMediaLayout) => {
    setOverrides((previous) => ({
      ...previous,
      projectMediaLayouts: {
        ...(previous.projectMediaLayouts ?? {}),
        [slug]: layout,
      },
    }))
  }

  const clearProjectMediaLayout = (slug: string) => {
    setOverrides((previous) => {
      const currentLayouts = previous.projectMediaLayouts ?? {}
      if (!(slug in currentLayouts)) {
        return previous
      }

      const remainingLayouts = { ...currentLayouts }
      delete remainingLayouts[slug]
      return {
        ...previous,
        projectMediaLayouts: remainingLayouts,
      }
    })
  }

  const value: SiteContentContextValue = {
    isAdmin,
    unlockAdmin,
    lockAdmin,
    clearOverrides,
    updateAdminCode,
    siteSettings,
    updateSiteSettings,
    homeContent,
    updateHomeContent,
    homeTheme,
    updateHomeTheme,
    homeGridSettings,
    updateHomeGridSettings,
    projects,
    getProjectBySlug,
    getProjectTheme,
    getProjectGridSettings,
    updateProjectGridSettings,
    updateProject,
    updateProjectTheme,
    clearProjectTheme,
    getProjectMediaLayout,
    setProjectMediaLayout,
    clearProjectMediaLayout,
  }

  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>
}
