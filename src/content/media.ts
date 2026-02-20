import { generatedProjects } from './generated-projects'

const mediaBaseUrl = (() => {
  const configuredValue = import.meta.env.VITE_MEDIA_BASE_URL
  if (typeof configuredValue !== 'string') {
    return ''
  }

  return configuredValue.trim().replace(/\/+$/, '')
})()

function resolveMediaUrl(value: string) {
  if (!value || !mediaBaseUrl) {
    return value
  }

  if (!value.startsWith('/media/')) {
    return value
  }

  const strippedPath = value.replace(/^\/media/, '')
  return `${mediaBaseUrl}${strippedPath.startsWith('/') ? strippedPath : `/${strippedPath}`}`
}

type ImageItem = {
  title: string
  location: string | null
  src: string
  thumbnail?: string
  monochrome?: boolean
}

type VideoItem = {
  title: string
  location: string | null
  src: string
  thumbnail?: string
  monochrome?: boolean
}

type ModelItem = {
  title: string
  location: string | null
  previewSrc: string
  fileSrc: string
  monochrome?: boolean
}

export const overlayBlendModes = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
] as const

export type OverlayBlendMode = (typeof overlayBlendModes)[number]

export const overlayEffects = ['none', '2-tone', '3-tone', '10-tone'] as const

export type OverlayEffect = (typeof overlayEffects)[number]

export function isOverlayBlendMode(value: string): value is OverlayBlendMode {
  return (overlayBlendModes as readonly string[]).includes(value)
}

export function isOverlayEffect(value: string): value is OverlayEffect {
  return (overlayEffects as readonly string[]).includes(value)
}

export type PageTheme = {
  backgroundColor: string
  textColor: string
  panelTextColor: string
  borderColor: string
  panelBackground: string
  transparentColor: string
  overlayBlendMode: OverlayBlendMode
  overlayEffect: OverlayEffect
}

export const defaultPageTheme: PageTheme = {
  backgroundColor: '#0022ff',
  textColor: '#bbff00',
  panelTextColor: '#bbff00',
  borderColor: '#bbff00',
  panelBackground: 'rgba(255, 255, 255, 0.1)',
  transparentColor: 'rgba(0, 0, 0, 0)',
  overlayBlendMode: 'normal',
  overlayEffect: 'none',
}

export const homePageTheme: PageTheme = {
  ...defaultPageTheme,
}

export const projectPageThemes: Record<string, Partial<PageTheme>> = {
  'oak-sideboard-build': {
    backgroundColor: '#2f1700',
    textColor: '#ffe9c2',
    borderColor: '#ffe9c2',
    panelBackground: 'rgba(255, 233, 194, 0.12)',
  },
  'parametric-furniture-model-study': {
    backgroundColor: '#1a0038',
    textColor: '#d7b7ff',
    borderColor: '#d7b7ff',
    panelBackground: 'rgba(215, 183, 255, 0.14)',
  },
  'residential-interior-render-set': {
    backgroundColor: '#0f2b2b',
    textColor: '#d8ffef',
    borderColor: '#d8ffef',
    panelBackground: 'rgba(216, 255, 239, 0.14)',
  },
}

export function getProjectPageTheme(slug: string): PageTheme {
  return {
    ...defaultPageTheme,
    ...(projectPageThemes[slug] ?? {}),
  }
}

export const categories = [
  { id: 'renders', label: 'Renders' },
  { id: '3d-models', label: '3DModels' },
  { id: 'furniture', label: 'Furniture' },
  { id: 'interior', label: 'Interior' },
  { id: 'animation', label: 'Animation' },
  { id: '3d-prints', label: '3D Prints' },
  { id: 'parametric', label: 'Parametric' },
  { id: 'fabrication', label: 'Fabrication' },
  { id: 'web', label: 'Web' },
  { id: 'stage', label: 'Stage' },
  { id: 'theatre', label: 'Theatre' },
  { id: 'film', label: 'Film' },
  { id: 'projected', label: 'Projected' },
  { id: 'virtual-reality', label: 'VR' },
  { id: 'augmented-reality', label: 'Augmented Reality' },
] as const

export const tags = [
  { id: 'lighting', label: 'Lighting' },
  { id: 'materials', label: 'Materials' },
  { id: 'interior', label: 'Interior' },
  { id: 'residential', label: 'Residential' },
  { id: 'parametric', label: 'Parametric' },
  { id: 'fabrication', label: 'Fabrication' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'furniture', label: 'Furniture' },
  { id: 'workshop', label: 'Workshop' },
  { id: 'joinery', label: 'Joinery' },
  { id: 'oak', label: 'Oak' },
] as const

export type CategoryId = (typeof categories)[number]['id']
export type TagId = (typeof tags)[number]['id']

export type Project = {
  slug: string
  title: string
  categoryId: CategoryId
  tagIds: TagId[]
  summary: string
  thumbnailSrc: string
  thumbnailMonochrome?: boolean
  body: string[]
  images?: ImageItem[]
  videos?: VideoItem[]
  models?: ModelItem[]
}

function withResolvedMediaUrls(project: Project): Project {
  return {
    ...project,
    thumbnailSrc: resolveMediaUrl(project.thumbnailSrc),
    images: project.images?.map((item) => ({
      ...item,
      src: resolveMediaUrl(item.src),
    })),
    videos: project.videos?.map((item) => ({
      ...item,
      src: resolveMediaUrl(item.src),
    })),
    models: project.models?.map((item) => ({
      ...item,
      previewSrc: resolveMediaUrl(item.previewSrc),
      fileSrc: resolveMediaUrl(item.fileSrc),
    })),
  }
}

export const projects: Project[] = (generatedProjects as Project[]).map(withResolvedMediaUrls)

export function getProjectBySlug(slug: string) {
  return projects.find((project) => project.slug === slug)
}

export function getCategoryLabel(categoryId: CategoryId) {
  const category = categories.find((item) => item.id === categoryId)
  return category?.label ?? categoryId
}

export function getTagLabel(tagId: TagId) {
  const tag = tags.find((item) => item.id === tagId)
  return tag?.label ?? tagId
}

export function getProjectCategoryLabel(project: Project) {
  return getCategoryLabel(project.categoryId)
}

export function getProjectTagLabels(project: Project) {
  return project.tagIds.map((tagId) => getTagLabel(tagId))
}

export function validateProjectData() {
  const errors: string[] = []

  const categoryIds = new Set<string>()
  for (const category of categories) {
    if (categoryIds.has(category.id)) {
      errors.push(`Duplicate category id found: ${category.id}`)
    }
    categoryIds.add(category.id)
  }

  const tagIds = new Set<string>()
  for (const tag of tags) {
    if (tagIds.has(tag.id)) {
      errors.push(`Duplicate tag id found: ${tag.id}`)
    }
    tagIds.add(tag.id)
  }

  const projectSlugs = new Set<string>()
  for (const project of projects) {
    if (projectSlugs.has(project.slug)) {
      errors.push(`Duplicate project slug found: ${project.slug}`)
    }
    projectSlugs.add(project.slug)

    if (!categoryIds.has(project.categoryId)) {
      errors.push(`Project "${project.slug}" references unknown categoryId: ${project.categoryId}`)
    }

    for (const tagId of project.tagIds) {
      if (!tagIds.has(tagId)) {
        errors.push(`Project "${project.slug}" references unknown tagId: ${tagId}`)
      }
    }
  }

  return errors
}