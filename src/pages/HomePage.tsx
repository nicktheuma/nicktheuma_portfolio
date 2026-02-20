import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { HeroScene } from '../components/HeroScene'
import { AdminColorField } from '../components/AdminColorField'
import { AdminDock } from '../components/AdminDock'
import { useManagedVideoPreviews } from '../components/useManagedVideoPreviews'
import { usePanelCaptionVisibility } from '../components/usePanelCaptionVisibility'
import { usePageTheme } from '../components/usePageTheme'
import {
  getProjectCategoryLabel,
  getProjectTagLabels,
  isOverlayBlendMode,
  isOverlayEffect,
  overlayBlendModes,
  overlayEffects,
} from '../content/media'
import { useSiteContent } from '../content/use-site-content'
import { videoThumbnailExtensions } from '../content/video-preview-settings'

export function HomePage() {
  const location = useLocation()
  const pageRef = useRef<HTMLElement | null>(null)
  const projectsGridRef = useRef<HTMLDivElement | null>(null)
  const {
    isAdmin,
    projects,
    homeTheme,
    updateHomeTheme,
    homeContent,
    updateHomeContent,
    homeGridSettings,
    updateHomeGridSettings,
  } = useSiteContent()
  usePageTheme(homeTheme)
  useManagedVideoPreviews(pageRef)
  usePanelCaptionVisibility(pageRef)
  const [failedThumbnails, setFailedThumbnails] = useState<Record<string, boolean>>({})
  const [activeAdminSectionId, setActiveAdminSectionId] = useState<string | null>(null)
  const [guideLines, setGuideLines] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] })

  const normalizedSearch = ''

  const filteredProjects = useMemo(() => {
    const filtered = !normalizedSearch
      ? projects
      : projects.filter((project) => {
          const categoryLabel = getProjectCategoryLabel(project)
          const tagLabels = getProjectTagLabels(project)
          const searchableText = [project.title, project.summary, categoryLabel, ...tagLabels].join(' ').toLowerCase()
          return searchableText.includes(normalizedSearch)
        })

    // Sort by most recent captureDate from first image or video (most recent first)
    return [...filtered].sort((a, b) => {
      const aFirstMedia = a.images?.[0] || a.videos?.[0]
      const bFirstMedia = b.images?.[0] || b.videos?.[0]
      
      const aDate = aFirstMedia?.captureDate ? new Date(aFirstMedia.captureDate).getTime() : 0
      const bDate = bFirstMedia?.captureDate ? new Date(bFirstMedia.captureDate).getTime() : 0
      
      return bDate - aDate // Most recent first
    })
  }, [normalizedSearch, projects])

  const projectGridSignature = useMemo(
    () => filteredProjects.map((project) => project.slug).join('|'),
    [filteredProjects],
  )

  const showGridGuides = isAdmin && activeAdminSectionId === 'home-grid'

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
      const gridElement = projectsGridRef.current
      if (!gridElement) {
        return
      }

      const gridRect = gridElement.getBoundingClientRect()
      const cards = Array.from(gridElement.querySelectorAll<HTMLElement>('.project-thumb'))
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
  }, [showGridGuides, projectGridSignature, homeGridSettings.columns, homeGridSettings.rowGap, homeGridSettings.columnGap, homeGridSettings.itemHeight])

  useEffect(() => {
    if (location.hash !== '#projects') {
      return
    }

    const scrollToProjects = () => {
      const projectsElement = document.getElementById('projects')
      if (!projectsElement) {
        return
      }

      projectsElement.scrollIntoView({ block: 'start' })
    }

    scrollToProjects()
    const timer = window.setTimeout(scrollToProjects, 0)
    return () => window.clearTimeout(timer)
  }, [location.hash, filteredProjects.length])

  return (
    <section className="page" ref={pageRef}>
      <div className="home-grid">
        <div className="panel-hero">
          <h2>{homeContent.heading}</h2>
          <p>{homeContent.intro}</p>
          <p>{homeContent.details}</p>
        </div>

        <HeroScene />
      </div>

      {isAdmin ? (
        <AdminDock
          title="Home admin"
          className="admin-dock-page"
          onActiveSectionChange={setActiveAdminSectionId}
          sections={[
            {
              id: 'home-content',
              icon: '✎',
              label: 'Home content',
              content: (
                <div className="admin-panel">
                  <label className="search-label" htmlFor="home-heading">
                    Heading
                  </label>
                  <input
                    id="home-heading"
                    className="search-input"
                    value={homeContent.heading}
                    onChange={(event) => updateHomeContent({ heading: event.target.value })}
                  />

                  <label className="search-label" htmlFor="home-intro">
                    Intro paragraph
                  </label>
                  <textarea
                    id="home-intro"
                    className="admin-textarea"
                    value={homeContent.intro}
                    onChange={(event) => updateHomeContent({ intro: event.target.value })}
                  />

                  <label className="search-label" htmlFor="home-details">
                    Details paragraph
                  </label>
                  <textarea
                    id="home-details"
                    className="admin-textarea"
                    value={homeContent.details}
                    onChange={(event) => updateHomeContent({ details: event.target.value })}
                  />
                </div>
              ),
            },
            {
              id: 'home-grid',
              icon: '⌗',
              label: 'Home grid',
              content: (
                <div className="admin-panel">
                  <div className="admin-grid-two">
                    <div>
                      <label className="search-label" htmlFor="home-grid-columns">
                        Columns
                      </label>
                      <input
                        id="home-grid-columns"
                        className="search-input"
                        type="number"
                        min={1}
                        max={8}
                        value={homeGridSettings.columns}
                        onChange={(event) =>
                          updateHomeGridSettings({ columns: Math.max(1, Math.min(8, Number(event.target.value) || 1)) })
                        }
                      />
                    </div>
                    <div>
                      <label className="search-label" htmlFor="home-grid-item-height">
                        Row size (px)
                      </label>
                      <input
                        id="home-grid-item-height"
                        className="search-input"
                        type="number"
                        min={120}
                        max={720}
                        value={homeGridSettings.itemHeight}
                        onChange={(event) =>
                          updateHomeGridSettings({ itemHeight: Math.max(120, Math.min(720, Number(event.target.value) || 220)) })
                        }
                      />
                    </div>
                    <div>
                      <label className="search-label" htmlFor="home-grid-row-gap">
                        Row gap (rem)
                      </label>
                      <input
                        id="home-grid-row-gap"
                        className="search-input"
                        type="number"
                        step="0.05"
                        min={0}
                        max={3}
                        value={homeGridSettings.rowGap}
                        onChange={(event) =>
                          updateHomeGridSettings({ rowGap: Math.max(0, Math.min(3, Number(event.target.value) || 0)) })
                        }
                      />
                    </div>
                    <div>
                      <label className="search-label" htmlFor="home-grid-column-gap">
                        Column gap (rem)
                      </label>
                      <input
                        id="home-grid-column-gap"
                        className="search-input"
                        type="number"
                        step="0.05"
                        min={0}
                        max={3}
                        value={homeGridSettings.columnGap}
                        onChange={(event) =>
                          updateHomeGridSettings({ columnGap: Math.max(0, Math.min(3, Number(event.target.value) || 0)) })
                        }
                      />
                    </div>
                  </div>
                </div>
              ),
            },
            {
              id: 'home-colors',
              icon: '◉',
              label: 'Home colors',
              content: (
                <div className="admin-panel">
                  <div className="admin-grid-two">
                    <AdminColorField
                      id="home-theme-background"
                      label="Background color"
                      value={homeTheme.backgroundColor}
                      onChange={(value) => updateHomeTheme({ backgroundColor: value })}
                    />
                    <AdminColorField
                      id="home-theme-text"
                      label="Text color"
                      value={homeTheme.textColor}
                      onChange={(value) => updateHomeTheme({ textColor: value })}
                    />
                    <AdminColorField
                      id="home-theme-panel-text"
                      label="Panel text"
                      value={homeTheme.panelTextColor}
                      onChange={(value) => updateHomeTheme({ panelTextColor: value })}
                    />
                    <AdminColorField
                      id="home-theme-border"
                      label="Border color"
                      value={homeTheme.borderColor}
                      onChange={(value) => updateHomeTheme({ borderColor: value })}
                    />
                    <AdminColorField
                      id="home-theme-panel"
                      label="Panel background"
                      value={homeTheme.panelBackground}
                      onChange={(value) => updateHomeTheme({ panelBackground: value })}
                    />
                    <div>
                      <label className="search-label" htmlFor="home-theme-overlay-blend-mode">
                        Overlay blend mode
                      </label>
                      <select
                        id="home-theme-overlay-blend-mode"
                        className="search-input"
                        value={homeTheme.overlayBlendMode}
                        onChange={(event) => {
                          const nextBlendMode = event.target.value
                          if (isOverlayBlendMode(nextBlendMode)) {
                            updateHomeTheme({ overlayBlendMode: nextBlendMode })
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
                      <label className="search-label" htmlFor="home-theme-overlay-effect">
                        Overlay effect
                      </label>
                      <select
                        id="home-theme-overlay-effect"
                        className="search-input"
                        value={homeTheme.overlayEffect}
                        onChange={(event) => {
                          const nextEffect = event.target.value
                          if (isOverlayEffect(nextEffect)) {
                            updateHomeTheme({ overlayEffect: nextEffect })
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
                </div>
              ),
            },
          ]}
        />
      ) : null}

      {/* <div className="search-panel">
        <label className="search-label" htmlFor="project-search">
          Search by project title, category, or tag
        </label>
        <input
          id="project-search"
          className="search-input"
          type="search"
          placeholder="Try: furniture, parametric, workshop"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
        />

        <div className="category-list" aria-label="Central categories list">
          {filteredCategories.map((category) => (
            <button key={category.id} type="button" className="category-chip" onClick={() => setSearchValue(category.label)}>
              {category.label}
            </button>
          ))}
        </div>
      </div> */}

      <div
        ref={projectsGridRef}
        id="projects"
        className={`projects-grid${showGridGuides ? ' is-guiding-grid' : ''}`}
        style={
          {
            '--home-grid-columns': homeGridSettings.columns,
            '--home-grid-row-gap': `${homeGridSettings.rowGap}rem`,
            '--home-grid-column-gap': `${homeGridSettings.columnGap}rem`,
            '--home-grid-item-height': `${homeGridSettings.itemHeight}px`,
          } as CSSProperties
        }
      >
        {showGridGuides ? (
          <div className="project-grid-guides" aria-hidden="true">
            {guideLines.x.map((xValue) => (
              <span key={`home-x-${xValue}`} className="project-grid-guide-line vertical" style={{ left: `${xValue}px` }} />
            ))}
            {guideLines.y.map((yValue) => (
              <span key={`home-y-${yValue}`} className="project-grid-guide-line horizontal" style={{ top: `${yValue}px` }} />
            ))}
          </div>
        ) : null}

        {filteredProjects.map((project) => {
          const normalizedThumbnailSrc = project.thumbnailSrc.toLowerCase()
          const isVideoThumbnail = videoThumbnailExtensions.some((extension) => normalizedThumbnailSrc.endsWith(extension))

          // If main thumbnail fails, fallback to first video/image
          const fallbackImage = project.images?.[0]
          const fallbackVideo = project.videos?.[0]
          const hasFallback = !!fallbackImage || !!fallbackVideo

          const displayingThumbnail = failedThumbnails[project.slug] ? null : project.thumbnailSrc

          // Determine what to show if thumbnail failed
          let fallbackSrc = ''
          let isFallbackVideo = false
          if (!displayingThumbnail && hasFallback) {
            // Prefer video fallback over image
            if (fallbackVideo?.src) {
              fallbackSrc = fallbackVideo.src
              isFallbackVideo = true
            } else if (fallbackImage?.src) {
              fallbackSrc = fallbackImage.src
              isFallbackVideo = false
            }
          }

          // Find the thumbnail placeholder for the main thumbnail (if it's a video or image)
          let thumbnailPlaceholder = ''
          if (isVideoThumbnail) {
            // Find the video item that matches the thumbnail src
            const matchingVideo = project.videos?.find((video) => video.src === project.thumbnailSrc)
            thumbnailPlaceholder = matchingVideo?.thumbnail || ''
          } else {
            // Find the image item that matches the thumbnail src
            const matchingImage = project.images?.find((image) => image.src === project.thumbnailSrc)
            thumbnailPlaceholder = matchingImage?.thumbnail || ''
          }

          // Find thumbnail for fallback
          const fallbackThumbnail = isFallbackVideo ? fallbackVideo?.thumbnail || '' : fallbackImage?.thumbnail || ''

          return (
            <article key={project.slug} className="project-thumb" data-video-panel="true" data-caption-panel="true">
              <Link to={`/projects/${project.slug}`}>
                {!displayingThumbnail && !fallbackSrc ? (
                  <div className="media-empty" aria-hidden="true" />
                ) : displayingThumbnail && !failedThumbnails[project.slug] ? isVideoThumbnail ? (
                  <div
                    className="media-card-video-wrapper"
                    style={thumbnailPlaceholder ? { backgroundImage: `url('${thumbnailPlaceholder}')`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                  >
                    <video
                      src={project.thumbnailSrc}
                      className={project.thumbnailMonochrome ? 'media-monochrome' : undefined}
                      data-preview-loop="true"
                      data-loaded="false"
                      muted
                      playsInline
                      preload="metadata"
                      loop
                      onLoadedData={(e) => {
                        e.currentTarget.dataset.loaded = 'true'
                      }}
                      onError={() => {
                        setFailedThumbnails((previous) => ({ ...previous, [project.slug]: true }))
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="media-card-image-wrapper"
                    style={thumbnailPlaceholder ? { backgroundImage: `url('${thumbnailPlaceholder}')`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                  >
                    <img
                      src={project.thumbnailSrc}
                      className={project.thumbnailMonochrome ? 'media-monochrome' : undefined}
                      alt={project.title}
                      loading="lazy"
                      data-loaded="false"
                      onLoad={(e) => {
                        e.currentTarget.dataset.loaded = 'true'
                      }}
                      onError={() => {
                        setFailedThumbnails((previous) => ({ ...previous, [project.slug]: true }))
                      }}
                    />
                  </div>
                ) : isFallbackVideo ? (
                  <div
                    className="media-card-video-wrapper"
                    style={fallbackThumbnail ? { backgroundImage: `url('${fallbackThumbnail}')`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                  >
                    <video
                      src={fallbackSrc}
                      data-preview-loop="true"
                      data-loaded="false"
                      muted
                      playsInline
                      preload="metadata"
                      loop
                      onLoadedData={(e) => {
                        e.currentTarget.dataset.loaded = 'true'
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="media-card-image-wrapper"
                    style={fallbackThumbnail ? { backgroundImage: `url('${fallbackThumbnail}')`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                  >
                    <img
                      src={fallbackSrc}
                      alt={project.title}
                      loading="lazy"
                      data-loaded="false"
                      onLoad={(e) => {
                        e.currentTarget.dataset.loaded = 'true'
                      }}
                    />
                  </div>
                )}
                <div className="media-card-body panel-caption">
                  <h3>{project.title}</h3>
                  <p>{project.summary}</p>
                  <p className="tag-row">{getProjectTagLabels(project).join(' • ')}</p>
                </div>
              </Link>
            </article>
          )
        })}
      </div>

      {filteredProjects.length === 0 ? <p className="empty-state">No projects matched your search yet.</p> : null}
    </section>
  )
}