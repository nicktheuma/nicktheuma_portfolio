import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { exiftool } from 'exiftool-vendored'
import sharp from 'sharp'
import heicConvert from 'heic-convert'

const projectRoot = process.cwd()
const mediaProjectsRoot = path.join(projectRoot, 'public', 'media', 'projects')
const outputFile = path.join(projectRoot, 'src', 'content', 'generated-projects.ts')

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.heic', '.heif'])
const videoExtensions = new Set(['.mp4', '.webm', '.mov', '.m4v'])
const modelExtensions = new Set(['.glb', '.gltf', '.stl', '.obj', '.fbx'])
const heicExtensions = new Set(['.heic', '.heif'])

const skippedFolderNames = new Set(['archive', '.generated'])
const finalPriorityFolderNames = new Set(['final'])
const processPriorityFolderNames = new Set(['process', 'working'])

function toPosixPath(value) {
  return value.replaceAll(path.sep, '/')
}

function slugToTitle(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function safeReadProjectMeta(projectFolderPath) {
  const metaPath = path.join(projectFolderPath, 'project.json')
  if (!existsSync(metaPath)) {
    return {}
  }

  try {
    const text = readFileSync(metaPath, 'utf8')
    return JSON.parse(text)
  } catch {
    return {}
  }
}

function listFilesInFolder(folderPath) {
  if (!existsSync(folderPath)) {
    return []
  }

  return readdirSync(folderPath)
    .map((name) => path.join(folderPath, name))
    .filter((filePath) => statSync(filePath).isFile())
}

function collectFilesRecursively(folderPath) {
  if (!existsSync(folderPath)) {
    return []
  }

  const results = []
  const entries = readdirSync(folderPath).map((name) => path.join(folderPath, name))

  for (const entryPath of entries) {
    const stats = statSync(entryPath)
    if (stats.isDirectory()) {
      const folderName = path.basename(entryPath).toLowerCase()
      if (skippedFolderNames.has(folderName)) {
        continue
      }

      results.push(...collectFilesRecursively(entryPath))
      continue
    }

    if (stats.isFile()) {
      results.push(entryPath)
    }
  }

  return results
}

function mediaPathFromAbsolute(filePath) {
  const relative = path.relative(path.join(projectRoot, 'public'), filePath)
  return '/' + toPosixPath(relative)
}

function fileNameWithoutExtension(filePath) {
  return path.basename(filePath, path.extname(filePath))
}

function folderPriorityForFile(filePath, projectFolderPath) {
  const relativeDir = path.dirname(path.relative(projectFolderPath, filePath))
  const normalizedSegments = toPosixPath(relativeDir)
    .split('/')
    .map((segment) => segment.toLowerCase())
    .filter(Boolean)

  if (normalizedSegments.some((segment) => finalPriorityFolderNames.has(segment))) {
    return 0
  }

  if (normalizedSegments.some((segment) => processPriorityFolderNames.has(segment))) {
    return 1
  }

  return 2
}

function compareMediaFiles(left, right, projectFolderPath) {
  const leftPriority = folderPriorityForFile(left, projectFolderPath)
  const rightPriority = folderPriorityForFile(right, projectFolderPath)

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority
  }

  const leftRelativePath = toPosixPath(path.relative(projectFolderPath, left)).toLowerCase()
  const rightRelativePath = toPosixPath(path.relative(projectFolderPath, right)).toLowerCase()
  return leftRelativePath.localeCompare(rightRelativePath)
}

function shouldApplyMonochrome(filePath, projectFolderPath) {
  return folderPriorityForFile(filePath, projectFolderPath) === 1
}

function isHeicOrHeif(filePath) {
  return heicExtensions.has(path.extname(filePath).toLowerCase())
}

function convertedImagePath(filePath, projectFolderPath) {
  const relativePath = path.relative(projectFolderPath, filePath)
  const relativeDir = path.dirname(relativePath)
  const fileBaseName = fileNameWithoutExtension(filePath)

  return path.join(projectFolderPath, '.generated', relativeDir, `${fileBaseName}.jpg`)
}

async function ensureDisplayableImage(filePath, projectFolderPath) {
  if (!isHeicOrHeif(filePath)) {
    return filePath
  }

  const outputPath = convertedImagePath(filePath, projectFolderPath)
  const sourceStats = statSync(filePath)

  if (existsSync(outputPath)) {
    const outputStats = statSync(outputPath)
    if (outputStats.mtimeMs >= sourceStats.mtimeMs) {
      return outputPath
    }
  }

  mkdirSync(path.dirname(outputPath), { recursive: true })

  try {
    await sharp(filePath)
      .rotate()
      .jpeg({ quality: 92, mozjpeg: true })
      .withMetadata()
      .toFile(outputPath)
  } catch {
    const inputBuffer = readFileSync(filePath)
    const outputBuffer = await heicConvert({
      buffer: inputBuffer,
      format: 'JPEG',
      quality: 0.92,
    })
    writeFileSync(outputPath, outputBuffer)
  }

  try {
    await exiftool.write(
      outputPath,
      {},
      {
        writeArgs: [
          `-TagsFromFile=${filePath}`,
          '-EXIF:all',
          '-XMP:all',
          '-IPTC:all',
          '-overwrite_original',
        ],
      },
    )
  } catch (error) {
    console.warn(`Could not copy metadata from ${path.basename(filePath)}: ${error instanceof Error ? error.message : String(error)}`)
  }

  return outputPath
}

async function extractMetadata(filePath) {
  try {
    const tags = await exiftool.read(filePath)
    
    // Extract capture date (try multiple fields)
    const captureDate = tags.DateTimeOriginal || tags.CreateDate || tags.ModifyDate || tags.FileModifyDate
    
    // Extract GPS location with comprehensive field search
    let location = null
    
    // Try to get human-readable location first (City/Country/Region)
    const city = tags.City || tags.LocationCreatedCity || tags.LocationShownCity || tags.LocationName
    const country = tags.Country || tags.CountryName || tags.LocationCreatedCountryName || tags.CountryCode
    const state = tags.State || tags.Province || tags.Region
    const subloc = tags.SubLocation || tags.Location
    
    if (city || country || state || subloc) {
      // Build location string from available parts
      const parts = [subloc, city, state, country].filter(Boolean)
      location = parts.join(', ')
    } else if (tags.GPSLatitude && tags.GPSLongitude) {
      // Fall back to GPS coordinates only if no city-level data
      location = `${tags.GPSLatitude.toFixed(4)}, ${tags.GPSLongitude.toFixed(4)}`
    }
    
    return {
      captureDate: captureDate ? new Date(captureDate) : null,
      location,
    }
  } catch (error) {
    // Silently handle errors to avoid console clutter
    return { captureDate: null, location: null }
  }
}

function isAutoGeneratedFilename(filename, fileType) {
  const lower = filename.toLowerCase()
  
  // Screen recording patterns: Screenshot YYYY-MM-DD, Screen Shot, Screen Recording, screenshot_*, etc.
  if (/^screen[-_ ]?(shot|recording)/i.test(lower)) {
    return 'recording'
  }
  
  // WhatsApp patterns: IMG-YYYYMMDD-WAnnnn, VID-YYYYMMDD-WAnnnn, WhatsApp Image, WhatsApp Video, etc.
  if (/^(img|vid)[-_]\d{8}[-_]wa\d+/i.test(lower) || /^whatsapp\s+(image|video)/i.test(lower)) {
    return 'whatsapp'
  }
  
  // Recording patterns (non-screen): Recording YYYY-MM-DD, etc.
  if (/^recording\s+\d{4}/i.test(lower)) {
    return 'archive'
  }
  
  // Generic camera patterns: IMG_, DSC_, VID_, MOV_, 100_nnnn, Recording_nnnn, etc.
  if (/^(img|dsc|vid|mov|pano|recording|\d+)[-_]\d+/i.test(lower)) {
    return 'archive'
  }
  
  // Generic unnamed video patterns
  if (fileType === 'video' && (/^(video|movie|clip|untitled)/i.test(lower) || /^\d+$/.test(lower))) {
    return 'video'
  }
  
  // Generic unnamed model patterns
  if (fileType === 'model' && (/^(model|untitled|object|mesh)/i.test(lower) || /^\d+$/.test(lower))) {
    return 'model'
  }
  
  return null
}

async function createImageItem(sourceFilePath, displayFilePath, index, projectFolderPath, counters, metadata) {
  const rawFilename = fileNameWithoutExtension(sourceFilePath)
  const autoType = isAutoGeneratedFilename(rawFilename, 'image')
  
  let title
  if (autoType === 'recording') {
    counters.recording = (counters.recording || 0) + 1
    title = `rec_${counters.recording}`
  } else if (autoType === 'whatsapp') {
    counters.whatsapp = (counters.whatsapp || 0) + 1
    title = `chat_${counters.whatsapp}`
  } else if (autoType === 'archive') {
    counters.archive = (counters.archive || 0) + 1
    title = `archive_${counters.archive}`
  } else {
    title = rawFilename || `image_${index + 1}`
  }
  
  return {
    title,
    location: metadata.location || null,
    captureDate: metadata.captureDate,
    src: mediaPathFromAbsolute(displayFilePath),
    monochrome: shouldApplyMonochrome(sourceFilePath, projectFolderPath),
  }
}

async function createVideoItem(filePath, index, projectFolderPath, counters, metadata) {
  const rawFilename = fileNameWithoutExtension(filePath)
  const autoType = isAutoGeneratedFilename(rawFilename, 'video')
  
  let title
  if (autoType === 'recording') {
    counters.recording = (counters.recording || 0) + 1
    title = `rec_${counters.recording}`
  } else if (autoType === 'whatsapp') {
    counters.whatsapp = (counters.whatsapp || 0) + 1
    title = `chat_${counters.whatsapp}`
  } else if (autoType === 'archive') {
    counters.archive = (counters.archive || 0) + 1
    title = `archive_${counters.archive}`
  } else if (autoType === 'video') {
    counters.video = (counters.video || 0) + 1
    title = `video_${counters.video}`
  } else {
    title = rawFilename || `video_${index + 1}`
  }
  
  return {
    title,
    location: metadata.location || null,
    captureDate: metadata.captureDate,
    src: mediaPathFromAbsolute(filePath),
    monochrome: shouldApplyMonochrome(filePath, projectFolderPath),
  }
}

async function createModelItem(filePath, images, index, projectFolderPath, counters) {
  const rawFilename = fileNameWithoutExtension(filePath)
  const autoType = isAutoGeneratedFilename(rawFilename, 'model')
  
  let title
  if (autoType === 'recording') {
    counters.recording = (counters.recording || 0) + 1
    title = `rec_${counters.recording}`
  } else if (autoType === 'whatsapp') {
    counters.whatsapp = (counters.whatsapp || 0) + 1
    title = `chat_${counters.whatsapp}`
  } else if (autoType === 'archive') {
    counters.archive = (counters.archive || 0) + 1
    title = `archive_${counters.archive}`
  } else if (autoType === 'model') {
    counters.model = (counters.model || 0) + 1
    title = `model_${counters.model}`
  } else {
    title = rawFilename || `model_${index + 1}`
  }
  
  const previewImage = images[index] ?? images[0]
  return {
    title,
    location: null,
    previewSrc: previewImage ? previewImage.src : '',
    fileSrc: mediaPathFromAbsolute(filePath),
    monochrome: shouldApplyMonochrome(filePath, projectFolderPath),
  }
}

async function collectProjectMedia(projectFolderPath) {
  const allFiles = collectFilesRecursively(projectFolderPath).filter(
    (filePath) => path.basename(filePath).toLowerCase() !== 'project.json',
  )

  const imageFiles = allFiles
    .filter((filePath) => imageExtensions.has(path.extname(filePath).toLowerCase()))
    .sort((left, right) => compareMediaFiles(left, right, projectFolderPath))
  const videoFiles = allFiles
    .filter((filePath) => videoExtensions.has(path.extname(filePath).toLowerCase()))
    .sort((left, right) => compareMediaFiles(left, right, projectFolderPath))
  const modelFiles = allFiles
    .filter((filePath) => modelExtensions.has(path.extname(filePath).toLowerCase()))
    .sort((left, right) => compareMediaFiles(left, right, projectFolderPath))

  // Extract metadata for images and videos
  console.log(`Extracting metadata for ${imageFiles.length} images and ${videoFiles.length} videos...`)
  const imageMetadata = await Promise.all(imageFiles.map(extractMetadata))
  const videoMetadata = await Promise.all(videoFiles.map(extractMetadata))

  // Create items with metadata and capture date for sorting
  const imageItems = await Promise.all(
    imageFiles.map(async (filePath, index) => ({
      filePath,
      displayFilePath: await ensureDisplayableImage(filePath, projectFolderPath),
      metadata: imageMetadata[index],
      item: null,
    }))
  )
  const videoItems = await Promise.all(
    videoFiles.map(async (filePath, index) => ({
      filePath,
      metadata: videoMetadata[index],
      item: null,
    }))
  )

  // Sort by capture date (oldest first), fallback to file path
  const sortByDate = (a, b) => {
    if (a.metadata.captureDate && b.metadata.captureDate) {
      return a.metadata.captureDate - b.metadata.captureDate
    }
    if (a.metadata.captureDate) return -1
    if (b.metadata.captureDate) return 1
    return compareMediaFiles(a.filePath, b.filePath, projectFolderPath)
  }

  imageItems.sort(sortByDate)
  videoItems.sort(sortByDate)

  // Now generate final items with sequential numbering
  const counters = {}
  const images = await Promise.all(
    imageItems.map((item, index) =>
      createImageItem(item.filePath, item.displayFilePath, index, projectFolderPath, counters, item.metadata)
    )
  )
  const videos = await Promise.all(
    videoItems.map((item, index) => createVideoItem(item.filePath, index, projectFolderPath, counters, item.metadata))
  )
  const models = await Promise.all(
    modelFiles.map((filePath, index) => createModelItem(filePath, images, index, projectFolderPath, counters))
  )

  return { images, videos, models }
}

async function buildProjects() {
  if (!existsSync(mediaProjectsRoot)) {
    mkdirSync(mediaProjectsRoot, { recursive: true })
  }

  const folderNames = readdirSync(mediaProjectsRoot)
    .map((name) => path.join(mediaProjectsRoot, name))
    .filter((folderPath) => statSync(folderPath).isDirectory())
    .map((folderPath) => path.basename(folderPath))

  const projects = await Promise.all(
    folderNames.map(async (slug) => {
      const folderPath = path.join(mediaProjectsRoot, slug)
      console.log(`Processing project: ${slug}`)
      const meta = safeReadProjectMeta(folderPath)
      const { images, videos, models } = await collectProjectMedia(folderPath)

      const thumbnailImage = images[0]
      const thumbnailVideo = videos[0]

      const thumbnailSrc =
        typeof meta.thumbnailSrc === 'string' && meta.thumbnailSrc.length > 0
          ? meta.thumbnailSrc
          : thumbnailImage?.src ?? thumbnailVideo?.src ?? ''

      const thumbnailMonochrome =
        typeof meta.thumbnailSrc === 'string' && meta.thumbnailSrc.length > 0
          ? shouldApplyMonochrome(path.join(projectRoot, 'public', meta.thumbnailSrc.replace(/^\//, '')), folderPath)
          : (thumbnailImage?.monochrome ?? thumbnailVideo?.monochrome ?? false)

      return {
        slug,
        title: typeof meta.title === 'string' && meta.title.length > 0 ? meta.title : slugToTitle(slug),
        categoryId: typeof meta.categoryId === 'string' ? meta.categoryId : 'renders',
        tagIds: Array.isArray(meta.tagIds) ? meta.tagIds.filter((value) => typeof value === 'string') : [],
        summary: typeof meta.summary === 'string' ? meta.summary : '',
        thumbnailSrc,
        thumbnailMonochrome,
        body: Array.isArray(meta.body) ? meta.body.filter((value) => typeof value === 'string') : [],
        images,
        videos,
        models,
      }
    })
  )

  return projects.filter((project) => project.thumbnailSrc || project.images.length || project.videos.length || project.models.length)
}

function writeOutput(projects) {
  const output = `export const generatedProjects = ${JSON.stringify(projects, null, 2)}\n`
  writeFileSync(outputFile, output, 'utf8')
}

async function main() {
  try {
    const projects = await buildProjects()
    writeOutput(projects)
    console.log(`Generated ${projects.length} project(s) from public/media/projects`)
  } finally {
    await exiftool.end()
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})