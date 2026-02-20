import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AdminColorField } from '../components/AdminColorField'
import { AdminDock } from '../components/AdminDock'
import { useManagedVideoPreviews } from '../components/useManagedVideoPreviews'
import { useMasonryGrid } from '../components/useMasonryGrid'
import { usePanelCaptionVisibility } from '../components/usePanelCaptionVisibility'
import { usePageTheme } from '../components/usePageTheme'
import {
  categories,
  getProjectCategoryLabel,
  getProjectTagLabels,
  isOverlayBlendMode,
  isOverlayEffect,
  overlayBlendModes,
  overlayEffects,
  type Project,
  tags,
  type CategoryId,
  type TagId,
} from '../content/media'
import type { MediaTileSize } from '../content/site-content-context'
import { useSiteContent } from '../content/use-site-content'

const tilePattern: Array<'small' | 'wide' | 'tall' | 'large'> = ['large', 'small', 'wide', 'small', 'tall', 'small', 'wide']

function getTileForIndex(index: number, total: number): 'small' | 'wide' | 'tall' | 'large' {
  const remaining = total - index
  if (remaining <= 2) {
    return 'small'
  }

  return tilePattern[index % tilePattern.length]
}

function parseChronologyValue(value: string) {
  const normalized = value.trim()

  const dateMatch = normalized.match(/(\d{4})[-_](\d{2})[-_](\d{2})/)
  if (dateMatch) {
    return Number(`${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}`)
  }

  const screenshotMatch = normalized.match(/screenshot\s*(\d{4})[-_](\d{2})[-_](\d{2})/i)
  if (screenshotMatch) {
    return Number(`${screenshotMatch[1]}${screenshotMatch[2]}${screenshotMatch[3]}`)
  }

  const imgIdMatch = normalized.match(/img[_-]?(\d{4,})/i)
  if (imgIdMatch) {
    return Number(imgIdMatch[1])
  }

  const numericParts = normalized.match(/\d+/g)
  if (numericParts && numericParts.length > 0) {
    return Number(numericParts.join('').slice(0, 12))
  }

  return Number.MAX_SAFE_INTEGER
}

function shouldHideTitle(title: string): boolean {
  // Hide very short titles that are just 1-2 characters with letters/numbers (like "b1", "2", "a")
  const trimmed = title.trim()
  if (trimmed.length <= 2) {
    // Check if it's just alphanumeric characters
    return /^[a-z0-9]+$/i.test(trimmed)
  }
  return false
}

function buildTimelineItems(project: Project) {
  const images = (project.images ?? []).map((item, index) => ({
    key: `image-${item.src}-${index}`,
    type: 'image' as const,
    title: item.title,
    location: item.location,
    src: item.src,
    monochrome: item.monochrome ?? false,
    order: parseChronologyValue(`${item.title} ${item.src}`) + index,
  }))

  const videos = (project.videos ?? []).map((item, index) => ({
    key: `video-${item.src}-${index}`,
    type: 'video' as const,
    title: item.title,
    location: item.location,
    src: item.src,
    monochrome: item.monochrome ?? false,
    order: parseChronologyValue(`${item.title} ${item.src}`) + index,
  }))

  const models = (project.models ?? []).map((item, index) => ({
    key: `model-${item.fileSrc}-${index}`,
    type: 'model' as const,
    title: item.title,
    location: item.location,
    previewSrc: item.previewSrc,
    fileSrc: item.fileSrc,
    monochrome: item.monochrome ?? false,
    order: parseChronologyValue(`${item.title} ${item.fileSrc}`) + index,
  }))

  const sorted = [...images, ...videos, ...models].sort((left, right) => left.order - right.order)
  const total = sorted.length

  return sorted.map((item, index) => ({
    ...item,
    baseOrder: index,
    tile: getTileForIndex(index, total),
  }))
}

function tileFromDragDelta(startTile: MediaTileSize, deltaX: number, deltaY: number): MediaTileSize {
  const tileVectors: Record<MediaTileSize, { x: number; y: number }> = {
    tiny: { x: 1, y: 1 },
    small: { x: 1, y: 1 },
    wide: { x: 2, y: 1 },
    tall: { x: 1, y: 2 },
    large: { x: 2, y: 2 },
    xwide: { x: 3, y: 1 },
    xtall: { x: 1, y: 3 },
    hero: { x: 3, y: 2 },
  }

  const stepX = deltaX > 120 ? 2 : deltaX > 44 ? 1 : deltaX < -120 ? -2 : deltaX < -44 ? -1 : 0
  const stepY = deltaY > 120 ? 2 : deltaY > 44 ? 1 : deltaY < -120 ? -2 : deltaY < -44 ? -1 : 0

  const startVector = tileVectors[startTile]
  const targetX = Math.max(1, Math.min(3, startVector.x + stepX))
  const targetY = Math.max(1, Math.min(3, startVector.y + stepY))

  const presets: Array<{ tile: MediaTileSize; x: number; y: number }> = [
    { tile: 'tiny', x: 1, y: 1 },
    { tile: 'small', x: 1, y: 1 },
    { tile: 'wide', x: 2, y: 1 },
    { tile: 'tall', x: 1, y: 2 },
    { tile: 'large', x: 2, y: 2 },
    { tile: 'xwide', x: 3, y: 1 },
    { tile: 'xtall', x: 1, y: 3 },
    { tile: 'hero', x: 3, y: 2 },
  ]

  let best = startTile
  let bestScore = Number.POSITIVE_INFINITY
  for (const preset of presets) {
    const score = Math.abs(preset.x - targetX) + Math.abs(preset.y - targetY)
    if (score < bestScore) {
      best = preset.tile
      bestScore = score
    }
  }

  return best
}

function reorderKeysBeforeTarget(keys: string[], movingKey: string, targetKey: string) {
  const fromIndex = keys.indexOf(movingKey)
  const toIndex = keys.indexOf(targetKey)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return keys
  }

  const nextKeys = [...keys]
  nextKeys.splice(fromIndex, 1)
  const insertIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
  nextKeys.splice(insertIndex, 0, movingKey)
  return nextKeys
}

function swapKeys(keys: string[], leftKey: string, rightKey: string) {
  const leftIndex = keys.indexOf(leftKey)
  const rightIndex = keys.indexOf(rightKey)
  if (leftIndex < 0 || rightIndex < 0 || leftIndex === rightIndex) {
    return keys
  }

  const nextKeys = [...keys]
  const temp = nextKeys[leftIndex]
  nextKeys[leftIndex] = nextKeys[rightIndex]
  nextKeys[rightIndex] = temp
  return nextKeys
}

function tileVector(tile: MediaTileSize) {
  switch (tile) {
    case 'tiny':
    case 'small':
      return { x: 1, y: 1 }
    case 'wide':
      return { x: 2, y: 1 }
    case 'tall':
      return { x: 1, y: 2 }
    case 'large':
      return { x: 2, y: 2 }
    case 'xwide':
      return { x: 3, y: 1 }
    case 'xtall':
      return { x: 1, y: 3 }
    case 'hero':
      return { x: 3, y: 2 }
    default:
      return { x: 1, y: 1 }
  }
}

function shouldReplaceAndFit(movingTile: MediaTileSize, targetTile: MediaTileSize) {
  const moving = tileVector(movingTile)
  const target = tileVector(targetTile)
  return moving.x > target.x || moving.y > target.y
}

export function ProjectPage() {
  const pageRef = useRef<HTMLElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const { slug } = useParams()
  const {
    isAdmin,
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
  } = useSiteContent()
  const project = slug ? getProjectBySlug(slug) : undefined
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})
  const [failedModelPreviews, setFailedModelPreviews] = useState<Record<string, boolean>>({})
  const [failedVideos, setFailedVideos] = useState<Record<string, boolean>>({})
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null)
  const [previewOrderKeys, setPreviewOrderKeys] = useState<string[] | null>(null)
  const [resizingKey, setResizingKey] = useState<string | null>(null)
  const [activeAdminSectionId, setActiveAdminSectionId] = useState<string | null>(null)
  const [editedTileKey, setEditedTileKey] = useState<string | null>(null)
  const [guideLines, setGuideLines] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] })
  const [previewTileByKey, setPreviewTileByKey] = useState<Record<string, MediaTileSize>>({})
  const [modalOpenedKey, setModalOpenedKey] = useState<string | null>(null)
  const resizeStartRef = useRef<{ key: string; tile: MediaTileSize; x: number; y: number } | null>(null)
  const editedTimerRef = useRef<number | null>(null)
  const projectTheme = getProjectTheme(slug ?? '')
  usePageTheme(projectTheme)
  useManagedVideoPreviews(pageRef)
  usePanelCaptionVisibility(pageRef)
  useMasonryGrid(pageRef)

  const projectSlug = project?.slug ?? ''
  const projectGridSettings = getProjectGridSettings(projectSlug)
  const storedMediaLayout = getProjectMediaLayout(projectSlug)
  const baseTimelineItems = useMemo(() => (project ? buildTimelineItems(project) : []), [project])
  const timelineItems = useMemo(() => {
    return [...baseTimelineItems]
      .map((item) => ({
        ...item,
        order: storedMediaLayout[item.key]?.order ?? item.baseOrder,
        tile: previewTileByKey[item.key] ?? storedMediaLayout[item.key]?.tile ?? item.tile,
        monochrome: storedMediaLayout[item.key]?.monochrome ?? item.monochrome,
      }))
      .sort((left, right) => left.order - right.order)
  }, [baseTimelineItems, storedMediaLayout, previewTileByKey])

  const displayTimelineItems = useMemo(() => {
    if (!previewOrderKeys || previewOrderKeys.length === 0) {
      return timelineItems
    }

    const timelineByKey = new Map(timelineItems.map((item) => [item.key, item]))
    const ordered = previewOrderKeys.map((key) => timelineByKey.get(key)).filter((item) => item !== undefined)
    const missing = timelineItems.filter((item) => !previewOrderKeys.includes(item.key))
    return [...ordered, ...missing]
  }, [timelineItems, previewOrderKeys])

  const guideLayoutSignature = useMemo(
    () => displayTimelineItems.map((item) => `${item.key}:${item.tile}`).join('|'),
    [displayTimelineItems],
  )

  useEffect(() => {
    return () => {
      if (editedTimerRef.current !== null) {
        window.clearTimeout(editedTimerRef.current)
      }
    }
  }, [])

  const markTileEdited = (itemKey: string) => {
    setEditedTileKey(itemKey)
    if (editedTimerRef.current !== null) {
      window.clearTimeout(editedTimerRef.current)
    }

    editedTimerRef.current = window.setTimeout(() => {
      setEditedTileKey((current) => (current === itemKey ? null : current))
      editedTimerRef.current = null
    }, 900)
  }

  useEffect(() => {
    if (!isAdmin || !resizingKey) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const start = resizeStartRef.current
      if (!start || start.key !== resizingKey) {
        return
      }

      const nextTile = tileFromDragDelta(start.tile, event.clientX - start.x, event.clientY - start.y)
      setPreviewTileByKey((previous) => ({ ...previous, [start.key]: nextTile }))
    }

    const handlePointerUp = () => {
      const start = resizeStartRef.current
      if (!start) {
        setResizingKey(null)
        return
      }

      const nextTile = previewTileByKey[start.key] ?? start.tile
      const existing = getProjectMediaLayout(projectSlug)
      const existingOrder =
        existing[start.key]?.order ?? timelineItems.findIndex((item) => item.key === start.key)
      const boundedOrder = Math.max(0, existingOrder)

      setProjectMediaLayout(projectSlug, {
        ...existing,
        [start.key]: {
          order: boundedOrder,
          tile: nextTile,
          monochrome: existing[start.key]?.monochrome,
        },
      })
      markTileEdited(start.key)

      resizeStartRef.current = null
      setResizingKey(null)
      setPreviewTileByKey((previous) => {
        const rest = { ...previous }
        delete rest[start.key]
        return rest
      })
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isAdmin, resizingKey, previewTileByKey, getProjectMediaLayout, projectSlug, setProjectMediaLayout, timelineItems])

  const commitOrder = (orderedKeys: string[], tileOverrides?: Record<string, MediaTileSize>) => {
    const existing = getProjectMediaLayout(projectSlug)
    const nextLayout = orderedKeys.reduce<Record<string, { order: number; tile: MediaTileSize; monochrome?: boolean }>>((acc, key, index) => {
      const currentItem = timelineItems.find((item) => item.key === key)
      if (!currentItem) {
        return acc
      }

      acc[key] = {
        order: index,
        tile: tileOverrides?.[key] ?? existing[key]?.tile ?? currentItem.tile,
        monochrome: existing[key]?.monochrome ?? currentItem.monochrome,
      }
      return acc
    }, {})

    setProjectMediaLayout(projectSlug, nextLayout)
    if (draggingKey) {
      markTileEdited(draggingKey)
    }
  }

  const getBaseKeys = () => displayTimelineItems.map((timelineItem) => timelineItem.key)

  const applyDropOnTarget = (targetKey: string) => {
    if (!draggingKey || draggingKey === targetKey) {
      return
    }

    const movingItem = displayTimelineItems.find((item) => item.key === draggingKey)
    const targetItem = displayTimelineItems.find((item) => item.key === targetKey)
    if (!movingItem || !targetItem) {
      return
    }

    const replaceAndFit = shouldReplaceAndFit(movingItem.tile, targetItem.tile)
    const baseKeys = previewOrderKeys ?? getBaseKeys()
    const orderedKeys = replaceAndFit
      ? swapKeys(baseKeys, draggingKey, targetKey)
      : reorderKeysBeforeTarget(baseKeys, draggingKey, targetKey)

    commitOrder(orderedKeys, replaceAndFit ? { [draggingKey]: targetItem.tile } : undefined)
  }

  const updatePreviewOrder = (targetKey: string) => {
    if (!draggingKey || draggingKey === targetKey) {
      return
    }

    setPreviewOrderKeys((previous) => {
      const baseKeys = previous ?? timelineItems.map((item) => item.key)
      return reorderKeysBeforeTarget(baseKeys, draggingKey, targetKey)
    })
  }

  const toggleItemMonochrome = (itemKey: string, currentMonochrome: boolean, currentTile: MediaTileSize) => {
    const existing = getProjectMediaLayout(projectSlug)
    const existingOrder = existing[itemKey]?.order ?? timelineItems.findIndex((item) => item.key === itemKey)

    setProjectMediaLayout(projectSlug, {
      ...existing,
      [itemKey]: {
        order: existingOrder,
        tile: existing[itemKey]?.tile ?? currentTile,
        monochrome: !currentMonochrome,
      },
    })
    markTileEdited(itemKey)
  }

  const tileUnitSpan = Math.max(1, Math.floor(projectGridSettings.columns / 4))
  const tileWideSpan = Math.min(projectGridSettings.columns, Math.max(2, tileUnitSpan * 2))
  const tileXwideSpan = Math.min(projectGridSettings.columns, Math.max(3, tileUnitSpan * 3))
  const showGridGuides = isAdmin && (draggingKey !== null || activeAdminSectionId === 'project-layout')

  const areNumberArraysEqual = (left: number[], right: number[]) => {
    if (left.length !== right.length) {
      return false
    }

    for (let index = 0; index < left.length; index += 1) {
      if (Math.abs(left[index] - right[index]) > 0.5) {
        return false
      }
    }

    return true
  }

  useEffect(() => {
    if (!showGridGuides) {
      return
    }

    const recalculateGuides = () => {
      const gridElement = gridRef.current
      if (!gridElement) {
        return
      }

      const gridRect = gridElement.getBoundingClientRect()
      const cards = Array.from(gridElement.querySelectorAll<HTMLElement>('.media-card'))
      const xEdges: number[] = [0, gridRect.width]
      const yEdges: number[] = [0, gridRect.height]

      for (const card of cards) {
        const rect = card.getBoundingClientRect()
        xEdges.push(rect.left - gridRect.left, rect.right - gridRect.left)
        yEdges.push(rect.top - gridRect.top, rect.bottom - gridRect.top)
      }

      const uniqueSorted = (values: number[]) => {
        const sorted = [...values].sort((a, b) => a - b)
        const deduped: number[] = []
        for (const value of sorted) {
          if (deduped.length === 0 || Math.abs(deduped[deduped.length - 1] - value) > 1) {
            deduped.push(value)
          }
        }
        return deduped
      }

      const nextGuideLines = {
        x: uniqueSorted(xEdges),
        y: uniqueSorted(yEdges),
      }

      setGuideLines((previous) => {
        if (areNumberArraysEqual(previous.x, nextGuideLines.x) && areNumberArraysEqual(previous.y, nextGuideLines.y)) {
          return previous
        }

        return nextGuideLines
      })
    }

    const rafId = window.requestAnimationFrame(recalculateGuides)
    window.addEventListener('resize', recalculateGuides)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', recalculateGuides)
    }
  }, [showGridGuides, guideLayoutSignature, projectGridSettings.columns, projectGridSettings.rowHeight, projectGridSettings.rowGap, projectGridSettings.columnGap])

  if (!project) {
    return <Navigate to="/" replace />
  }

  return (
    <section className="page" ref={pageRef}>
      <p className="project-meta">{getProjectCategoryLabel(project)}</p>
      <h2>{project.title}</h2>
      <p className="tag-row">{getProjectTagLabels(project).join(' • ')}</p>

      {project.body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}

      {isAdmin ? (
        <AdminDock
          title="Project admin"
          className="admin-dock-page"
          onActiveSectionChange={setActiveAdminSectionId}
          sections={[
            {
              id: 'project-content',
              icon: '✎',
              label: 'Project content',
              content: (
                <div className="admin-panel">
                  <label className="search-label" htmlFor="project-title">
                    Title
                  </label>
                  <input
                    id="project-title"
                    className="search-input"
                    value={project.title}
                    onChange={(event) => updateProject(project.slug, { title: event.target.value })}
                  />

                  <label className="search-label" htmlFor="project-summary">
                    Summary
                  </label>
                  <textarea
                    id="project-summary"
                    className="admin-textarea"
                    value={project.summary}
                    onChange={(event) => updateProject(project.slug, { summary: event.target.value })}
                  />

                  <label className="search-label" htmlFor="project-body">
                    Body paragraphs (one paragraph per line)
                  </label>
                  <textarea
                    id="project-body"
                    className="admin-textarea"
                    value={project.body.join('\n')}
                    onChange={(event) =>
                      updateProject(project.slug, {
                        body: event.target.value
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean),
                      })
                    }
                  />

                  <div className="admin-grid-two">
                    <div>
                      <label className="search-label" htmlFor="project-category">
                        Category
                      </label>
                      <select
                        id="project-category"
                        className="search-input"
                        value={project.categoryId}
                        onChange={(event) => updateProject(project.slug, { categoryId: event.target.value as CategoryId })}
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="search-label" htmlFor="project-tags">
                        Tags (comma separated IDs)
                      </label>
                      <input
                        id="project-tags"
                        className="search-input"
                        value={project.tagIds.join(', ')}
                        onChange={(event) => {
                          const nextTagIds = event.target.value
                            .split(',')
                            .map((value) => value.trim())
                            .filter(Boolean)
                            .filter((tagId, index, self) => self.indexOf(tagId) === index)

                          const knownTagIds = new Set<TagId>(tags.map((tag) => tag.id))
                          const filteredTagIds = nextTagIds.filter((tagId): tagId is TagId =>
                            knownTagIds.has(tagId as TagId),
                          )
                          updateProject(project.slug, { tagIds: filteredTagIds })
                        }}
                      />
                    </div>
                  </div>
                </div>
              ),
            },
            {
              id: 'project-colors',
              icon: '◉',
              label: 'Project colors',
              content: (
                <div className="admin-panel">
                  <div className="admin-grid-two">
                    <AdminColorField
                      id="project-theme-background"
                      label="Background color"
                      value={projectTheme.backgroundColor}
                      onChange={(value) => updateProjectTheme(project.slug, { backgroundColor: value })}
                    />
                    <AdminColorField
                      id="project-theme-text"
                      label="Text color"
                      value={projectTheme.textColor}
                      onChange={(value) => updateProjectTheme(project.slug, { textColor: value })}
                    />
                    <AdminColorField
                      id="project-theme-border"
                      label="Border color"
                      value={projectTheme.borderColor}
                      onChange={(value) => updateProjectTheme(project.slug, { borderColor: value })}
                    />
                    <AdminColorField
                      id="project-theme-panel"
                      label="Panel background"
                      value={projectTheme.panelBackground}
                      onChange={(value) => updateProjectTheme(project.slug, { panelBackground: value })}
                    />
                    <div>
                      <label className="search-label" htmlFor="project-theme-overlay-blend-mode">
                        Overlay blend mode
                      </label>
                      <select
                        id="project-theme-overlay-blend-mode"
                        className="search-input"
                        value={projectTheme.overlayBlendMode}
                        onChange={(event) => {
                          const nextBlendMode = event.target.value
                          if (isOverlayBlendMode(nextBlendMode)) {
                            updateProjectTheme(project.slug, { overlayBlendMode: nextBlendMode })
                          }
                        }}
                      >
                        {overlayBlendModes.map((blendMode) => (
                          <option key={blendMode} value={blendMode}>
                            {blendMode}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="search-label" htmlFor="project-theme-overlay-effect">
                        Overlay effect
                      </label>
                      <select
                        id="project-theme-overlay-effect"
                        className="search-input"
                        value={projectTheme.overlayEffect}
                        onChange={(event) => {
                          const nextEffect = event.target.value
                          if (isOverlayEffect(nextEffect)) {
                            updateProjectTheme(project.slug, { overlayEffect: nextEffect })
                          }
                        }}
                      >
                        {overlayEffects.map((effect) => (
                          <option key={effect} value={effect}>
                            {effect}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button type="button" className="admin-button" onClick={() => clearProjectTheme(project.slug)}>
                    Revert to home defaults
                  </button>
                </div>
              ),
            },
            {
              id: 'project-layout',
              icon: '▦',
              label: 'Grid layout',
              content: (
                <div className="admin-panel">
                  <p>Drag cards to reorder placement. Drag each corner handle to resize.</p>
                  <div className="admin-grid-two">
                    <div>
                      <label className="search-label" htmlFor="project-grid-columns">
                        Columns
                      </label>
                      <input
                        id="project-grid-columns"
                        className="search-input"
                        type="number"
                        min={4}
                        max={24}
                        value={projectGridSettings.columns}
                        onChange={(event) =>
                          updateProjectGridSettings(project.slug, {
                            columns: Math.max(4, Math.min(24, Number(event.target.value) || 12)),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="search-label" htmlFor="project-grid-row-height">
                        Row size (px)
                      </label>
                      <input
                        id="project-grid-row-height"
                        className="search-input"
                        type="number"
                        min={2}
                        max={32}
                        value={projectGridSettings.rowHeight}
                        onChange={(event) =>
                          updateProjectGridSettings(project.slug, {
                            rowHeight: Math.max(2, Math.min(32, Number(event.target.value) || 8)),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="search-label" htmlFor="project-grid-row-gap">
                        Row gap (rem)
                      </label>
                      <input
                        id="project-grid-row-gap"
                        className="search-input"
                        type="number"
                        step="0.05"
                        min={0}
                        max={2}
                        value={projectGridSettings.rowGap}
                        onChange={(event) =>
                          updateProjectGridSettings(project.slug, {
                            rowGap: Math.max(0, Math.min(2, Number(event.target.value) || 0)),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="search-label" htmlFor="project-grid-column-gap">
                        Column gap (rem)
                      </label>
                      <input
                        id="project-grid-column-gap"
                        className="search-input"
                        type="number"
                        step="0.05"
                        min={0}
                        max={2}
                        value={projectGridSettings.columnGap}
                        onChange={(event) =>
                          updateProjectGridSettings(project.slug, {
                            columnGap: Math.max(0, Math.min(2, Number(event.target.value) || 0)),
                          })
                        }
                      />
                    </div>
                  </div>
                  <button type="button" className="admin-button" onClick={() => clearProjectMediaLayout(project.slug)}>
                    Reset grid layout
                  </button>
                </div>
              ),
            },
          ]}
        />
      ) : null}

      {timelineItems.length > 0 ? (
        <div
          ref={gridRef}
          className={`project-media-grid${showGridGuides ? ' is-dragging-grid' : ''}`}
          style={
            {
              '--project-grid-columns': projectGridSettings.columns,
              '--project-grid-row-height': `${projectGridSettings.rowHeight}px`,
              '--project-grid-row-gap': `${projectGridSettings.rowGap}rem`,
              '--project-grid-column-gap': `${projectGridSettings.columnGap}rem`,
              '--tile-unit-span': tileUnitSpan,
              '--tile-wide-span': tileWideSpan,
              '--tile-xwide-span': tileXwideSpan,
            } as CSSProperties
          }
        >
          {showGridGuides ? (
            <div className="project-grid-guides" aria-hidden="true">
              {guideLines.x.map((xValue) => (
                <span key={`x-${xValue}`} className="project-grid-guide-line vertical" style={{ left: `${xValue}px` }} />
              ))}
              {guideLines.y.map((yValue) => (
                <span key={`y-${yValue}`} className="project-grid-guide-line horizontal" style={{ top: `${yValue}px` }} />
              ))}
            </div>
          ) : null}

          {displayTimelineItems.map((item) => {
            if (item.type === 'image') {
              const imageKey = item.key
              return (
                <article
                  key={item.key}
                  className={`media-card tile-${item.tile}${item.monochrome ? ' media-monochrome' : ''}${isAdmin ? ' admin-draggable' : ''}${draggingKey === item.key ? ' is-dragging' : ''}${dropTargetKey === item.key ? ' is-drop-target' : ''}${resizingKey === item.key || draggingKey === item.key || editedTileKey === item.key ? ' is-editing' : ''}`}
                  data-caption-panel="true"
                  draggable={isAdmin}
                  onDragStart={(event) => {
                    if (!isAdmin) {
                      return
                    }

                    setDraggingKey(item.key)
                    setDropTargetKey(null)
                    setPreviewOrderKeys(displayTimelineItems.map((timelineItem) => timelineItem.key))
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', item.key)
                  }}
                  onDragEnter={() => {
                    if (isAdmin && draggingKey && draggingKey !== item.key) {
                      setDropTargetKey(item.key)
                      updatePreviewOrder(item.key)
                    }
                  }}
                  onDragOver={(event) => {
                    if (isAdmin) {
                      event.preventDefault()
                      if (draggingKey && draggingKey !== item.key) {
                        setDropTargetKey(item.key)
                        updatePreviewOrder(item.key)
                      }
                    }
                  }}
                  onDrop={(event) => {
                    if (!isAdmin || !draggingKey || draggingKey === item.key) {
                      return
                    }

                    event.preventDefault()
                    applyDropOnTarget(item.key)
                    setDraggingKey(null)
                    setDropTargetKey(null)
                    setPreviewOrderKeys(null)
                  }}
                  onDragEnd={() => {
                    setDraggingKey(null)
                    setDropTargetKey(null)
                    setPreviewOrderKeys(null)
                  }}
                >
                  {!item.src || failedImages[imageKey] ? (
                    <div className="media-empty" aria-hidden="true" />
                  ) : (
                    <button
                      type="button"
                      className="media-card-image-button"
                      onClick={() => setModalOpenedKey(item.key)}
                      aria-label={`View ${item.title}`}
                    >
                      <img
                        src={item.src}
                        alt={item.title}
                        loading="lazy"
                        onError={() => {
                          setFailedImages((previous) => ({ ...previous, [imageKey]: true }))
                        }}
                      />
                    </button>
                  )}
                  <div className="media-card-body panel-caption">
                    {!shouldHideTitle(item.title) && <h3>{item.title}</h3>}
                    {item.location && <p>{item.location}</p>}
                  </div>
                  {isAdmin ? (
                    <span className="media-card-move-indicator" aria-hidden="true" title="Move tool">
                      ↕
                    </span>
                  ) : null}
                  {isAdmin ? (
                    <button
                      type="button"
                      className="media-card-mono-toggle"
                      aria-label={item.monochrome ? 'Disable monochrome' : 'Enable monochrome'}
                      onClick={() => toggleItemMonochrome(item.key, item.monochrome, item.tile)}
                    >
                      {item.monochrome ? 'Mono On' : 'Mono Off'}
                    </button>
                  ) : null}
                  {isAdmin ? (
                    <button
                      type="button"
                      className="media-card-resize"
                      title="Scale tool"
                      aria-label="Resize media tile"
                      onPointerDown={(event) => {
                        event.preventDefault()
                        resizeStartRef.current = {
                          key: item.key,
                          tile: item.tile,
                          x: event.clientX,
                          y: event.clientY,
                        }
                        setResizingKey(item.key)
                      }}
                    >
                      ⤡
                    </button>
                  ) : null}
                </article>
              )
            }

            if (item.type === 'video') {
              const videoKey = item.key
              return (
                <article
                  key={item.key}
                  className={`media-card tile-${item.tile}${item.monochrome ? ' media-monochrome' : ''}${isAdmin ? ' admin-draggable' : ''}${draggingKey === item.key ? ' is-dragging' : ''}${dropTargetKey === item.key ? ' is-drop-target' : ''}${resizingKey === item.key || draggingKey === item.key || editedTileKey === item.key ? ' is-editing' : ''}`}
                  data-video-panel="true"
                  data-caption-panel="true"
                  draggable={isAdmin}
                  onDragStart={(event) => {
                    if (!isAdmin) {
                      return
                    }

                    setDraggingKey(item.key)
                    setDropTargetKey(null)
                    setPreviewOrderKeys(displayTimelineItems.map((timelineItem) => timelineItem.key))
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', item.key)
                  }}
                  onDragEnter={() => {
                    if (isAdmin && draggingKey && draggingKey !== item.key) {
                      setDropTargetKey(item.key)
                      updatePreviewOrder(item.key)
                    }
                  }}
                  onDragOver={(event) => {
                    if (isAdmin) {
                      event.preventDefault()
                      if (draggingKey && draggingKey !== item.key) {
                        setDropTargetKey(item.key)
                        updatePreviewOrder(item.key)
                      }
                    }
                  }}
                  onDrop={(event) => {
                    if (!isAdmin || !draggingKey || draggingKey === item.key) {
                      return
                    }

                    event.preventDefault()
                    applyDropOnTarget(item.key)
                    setDraggingKey(null)
                    setDropTargetKey(null)
                    setPreviewOrderKeys(null)
                  }}
                  onDragEnd={() => {
                    setDraggingKey(null)
                    setDropTargetKey(null)
                    setPreviewOrderKeys(null)
                  }}
                >
                  {failedVideos[videoKey] || !item.src ? (
                    <div className="media-empty" aria-hidden="true" />
                  ) : (
                    <button
                      type="button"
                      className="media-card-video-button"
                      onClick={() => setModalOpenedKey(item.key)}
                      aria-label={`View video ${item.title}`}
                    >
                      <video
                        className="video-timeline-only"
                        src={item.src}
                        data-preview-loop="true"
                        data-interactive-controls="true"
                        controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
                        preload="metadata"
                        loop
                        onError={() => {
                          setFailedVideos((previous) => ({ ...previous, [videoKey]: true }))
                        }}
                      />
                    </button>
                  )}
                  <div className="media-card-body panel-caption">
                    {!shouldHideTitle(item.title) && <h3>{item.title}</h3>}
                    {item.location && <p>{item.location}</p>}
                  </div>
                  {isAdmin ? (
                    <span className="media-card-move-indicator" aria-hidden="true" title="Move tool">
                      ↕
                    </span>
                  ) : null}
                  {isAdmin ? (
                    <button
                      type="button"
                      className="media-card-mono-toggle"
                      aria-label={item.monochrome ? 'Disable monochrome' : 'Enable monochrome'}
                      onClick={() => toggleItemMonochrome(item.key, item.monochrome, item.tile)}
                    >
                      {item.monochrome ? 'Mono On' : 'Mono Off'}
                    </button>
                  ) : null}
                  {isAdmin ? (
                    <button
                      type="button"
                      className="media-card-resize"
                      title="Scale tool"
                      aria-label="Resize media tile"
                      onPointerDown={(event) => {
                        event.preventDefault()
                        resizeStartRef.current = {
                          key: item.key,
                          tile: item.tile,
                          x: event.clientX,
                          y: event.clientY,
                        }
                        setResizingKey(item.key)
                      }}
                    >
                      ⤡
                    </button>
                  ) : null}
                </article>
              )
            }

            const modelKey = item.key
            return (
              <article
                key={item.key}
                className={`media-card tile-${item.tile}${item.monochrome ? ' media-monochrome' : ''}${isAdmin ? ' admin-draggable' : ''}${draggingKey === item.key ? ' is-dragging' : ''}${dropTargetKey === item.key ? ' is-drop-target' : ''}${resizingKey === item.key || draggingKey === item.key || editedTileKey === item.key ? ' is-editing' : ''}`}
                data-caption-panel="true"
                draggable={isAdmin}
                onDragStart={(event) => {
                  if (!isAdmin) {
                    return
                  }

                  setDraggingKey(item.key)
                  setDropTargetKey(null)
                  setPreviewOrderKeys(displayTimelineItems.map((timelineItem) => timelineItem.key))
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', item.key)
                }}
                onDragEnter={() => {
                  if (isAdmin && draggingKey && draggingKey !== item.key) {
                    setDropTargetKey(item.key)
                    updatePreviewOrder(item.key)
                  }
                }}
                onDragOver={(event) => {
                  if (isAdmin) {
                    event.preventDefault()
                    if (draggingKey && draggingKey !== item.key) {
                      setDropTargetKey(item.key)
                      updatePreviewOrder(item.key)
                    }
                  }
                }}
                onDrop={(event) => {
                  if (!isAdmin || !draggingKey || draggingKey === item.key) {
                    return
                  }

                  event.preventDefault()
                  applyDropOnTarget(item.key)
                  setDraggingKey(null)
                  setDropTargetKey(null)
                  setPreviewOrderKeys(null)
                }}
                onDragEnd={() => {
                  setDraggingKey(null)
                  setDropTargetKey(null)
                  setPreviewOrderKeys(null)
                }}
              >
                {!item.previewSrc || failedModelPreviews[modelKey] ? (
                  <div className="media-empty" aria-hidden="true" />
                ) : (
                  <img
                    src={item.previewSrc}
                    alt={item.title}
                    loading="lazy"
                    onError={() => {
                      setFailedModelPreviews((previous) => ({ ...previous, [modelKey]: true }))
                    }}
                  />
                )}
                <div className="media-card-body panel-caption">
                  {!shouldHideTitle(item.title) && <h3>{item.title}</h3>}
                  {item.location && <p>{item.location}</p>}
                  <a className="download-link" href={item.fileSrc} target="_blank" rel="noreferrer">
                    Open model file
                  </a>
                </div>
                {isAdmin ? (
                  <span className="media-card-move-indicator" aria-hidden="true" title="Move tool">
                    ↕
                  </span>
                ) : null}
                {isAdmin ? (
                  <button
                    type="button"
                    className="media-card-mono-toggle"
                    aria-label={item.monochrome ? 'Disable monochrome' : 'Enable monochrome'}
                    onClick={() => toggleItemMonochrome(item.key, item.monochrome, item.tile)}
                  >
                    {item.monochrome ? 'Mono On' : 'Mono Off'}
                  </button>
                ) : null}
                {isAdmin ? (
                  <button
                    type="button"
                    className="media-card-resize"
                    title="Scale tool"
                    aria-label="Resize media tile"
                    onPointerDown={(event) => {
                      event.preventDefault()
                      resizeStartRef.current = {
                        key: item.key,
                        tile: item.tile,
                        x: event.clientX,
                        y: event.clientY,
                      }
                      setResizingKey(item.key)
                    }}
                  >
                    ⤡
                  </button>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : null}

      {modalOpenedKey ? (
        (() => {
          const modalItem = timelineItems.find((item) => item.key === modalOpenedKey)
          if (!modalItem) return null

          return (
            <div className="media-modal-backdrop" onClick={() => setModalOpenedKey(null)}>
              <div className="media-modal" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="media-modal-close"
                  onClick={() => setModalOpenedKey(null)}
                  aria-label="Close modal"
                >
                  ✕
                </button>
                {modalItem.type === 'image' && (
                  <img src={modalItem.src} alt={modalItem.title} className="media-modal-content" />
                )}
                {modalItem.type === 'video' && (
                  <video
                    src={modalItem.src}
                    className="media-modal-content"
                    controls
                    autoPlay
                    controlsList="nodownload"
                  />
                )}
              </div>
            </div>
          )
        })()
      ) : null}

      <p>
        <Link className="download-link" to="/#projects">
          Back to all projects
        </Link>
      </p>
    </section>
  )
}