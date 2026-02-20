import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()
const projectsRoot = path.join(projectRoot, 'public', 'media', 'projects')

function printHelp() {
  console.log('Usage: npm run create:project -- <project-slug> [--title="Project Title"] [--category=<categoryId>] [--tags=tag1,tag2]')
}

function toTitleFromSlug(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function parseArgs(argv) {
  const result = {
    slug: '',
    title: '',
    categoryId: 'rendering',
    tagIds: [],
  }

  for (const arg of argv) {
    if (!arg.startsWith('--') && !result.slug) {
      result.slug = arg
      continue
    }

    if (arg.startsWith('--title=')) {
      result.title = arg.slice('--title='.length).trim()
      continue
    }

    if (arg.startsWith('--category=')) {
      result.categoryId = arg.slice('--category='.length).trim() || 'rendering'
      continue
    }

    if (arg.startsWith('--tags=')) {
      const raw = arg.slice('--tags='.length)
      result.tagIds = raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      continue
    }

    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
  }

  return result
}

function validateSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

function createProjectTemplate({ slug, title, categoryId, tagIds }) {
  if (!slug) {
    throw new Error('Missing project slug. Example: npm run create:project -- my-new-project')
  }

  if (!validateSlug(slug)) {
    throw new Error('Invalid slug. Use lowercase letters, numbers, and hyphens only (e.g. oak-side-table).')
  }

  const projectPath = path.join(projectsRoot, slug)
  if (existsSync(projectPath)) {
    throw new Error(`Project folder already exists: public/media/projects/${slug}`)
  }

  const imagesPath = path.join(projectPath, 'images')
  const videosPath = path.join(projectPath, 'videos')
  const modelsPath = path.join(projectPath, 'models')

  mkdirSync(imagesPath, { recursive: true })
  mkdirSync(videosPath, { recursive: true })
  mkdirSync(modelsPath, { recursive: true })

  writeFileSync(path.join(imagesPath, '.gitkeep'), '', 'utf8')
  writeFileSync(path.join(videosPath, '.gitkeep'), '', 'utf8')
  writeFileSync(path.join(modelsPath, '.gitkeep'), '', 'utf8')

  const projectMeta = {
    title: title || toTitleFromSlug(slug),
    categoryId,
    tagIds,
    summary: 'Add a short project summary here.',
    body: ['Add your project story paragraph here.'],
    themeGeneration: {
      imageSelection: 'thumbnail',
      colorMetric: 'dominant',
      hueShift: 0,
      saturationMultiplier: 1,
      backgroundLightness: 14,
      borderLightness: 76,
      textLightness: 92,
      panelAlpha: 0.13,
    },
  }

  writeFileSync(path.join(projectPath, 'project.json'), JSON.stringify(projectMeta, null, 2), 'utf8')

  console.log(`Created project template: public/media/projects/${slug}`)
  console.log('Next steps:')
  console.log('- Drop media files into images/videos/models')
  console.log('- Update project.json metadata if needed')
  console.log('- Run npm run generate:media (or restart npm run dev)')
}

try {
  const parsed = parseArgs(process.argv.slice(2))
  createProjectTemplate(parsed)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  printHelp()
  process.exit(1)
}
