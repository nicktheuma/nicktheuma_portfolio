import { useEffect, type RefObject } from 'react'

export function usePanelCaptionVisibility(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-caption-panel="true"]'))
    if (panels.length === 0) {
      return
    }

    // Detect touch device
    const isTouchDevice = () => {
      return (
        window.matchMedia('(hover: none)').matches ||
        window.matchMedia('(pointer: coarse)').matches ||
        navigator.maxTouchPoints > 0
      )
    }

    // Detect if we're on a project page
    const isProjectPage = () => {
      return window.location.pathname.startsWith('/project/')
    }

    const isTouch = isTouchDevice()
    const onProjectPage = isProjectPage()

    if (isTouch) {
      // Mobile: Scroll-based visibility - centered tile has no overlay
      let animationFrameId: number | null = null

      const updateMobileOverlay = () => {
        const viewportHeight = window.innerHeight
        const viewportCenter = viewportHeight / 2

        for (const panel of panels) {
          const rect = panel.getBoundingClientRect()
          const panelCenter = rect.top + rect.height / 2
          const distance = Math.abs(panelCenter - viewportCenter)
          
          // Tight fade around center tile
          // 0-75px: 0-50% opacity (center tile mostly visible)
          // 75-200px: 50-100% opacity (fading in adjacent tiles)
          // 200+px: 100% opacity (full overlay on far tiles)
          let opacity = 0
          if (distance < 75) {
            opacity = (distance / 75) * 0.5
          } else if (distance < 200) {
            opacity = 0.5 + ((distance - 75) / 125) * 0.5
          } else {
            opacity = 1.0
          }

          panel.style.setProperty('--panel-caption-overlay-opacity', opacity.toString())
        }
      }

      const scheduleUpdate = () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId)
        }
        animationFrameId = requestAnimationFrame(updateMobileOverlay)
      }

      // Initial update
      updateMobileOverlay()

      // Use both scroll listeners - document and window
      document.addEventListener('scroll', scheduleUpdate, { passive: true })
      window.addEventListener('scroll', scheduleUpdate, { passive: true })
      root.addEventListener('scroll', scheduleUpdate, { passive: true })
      window.addEventListener('resize', scheduleUpdate, { passive: true })

      return () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId)
        }
        document.removeEventListener('scroll', scheduleUpdate)
        window.removeEventListener('scroll', scheduleUpdate)
        root.removeEventListener('scroll', scheduleUpdate)
        window.removeEventListener('resize', scheduleUpdate)
      }
    } else if (onProjectPage) {
      // Desktop on project page: Use scroll distance for fade and mouse proximity
      let animationFrameId: number | null = null
      const scrollOpacity = new Map<HTMLElement, number>()
      const mouseProximityOpacity = new Map<HTMLElement, number>()

      const updateScrollOverlay = () => {
        const viewportHeight = window.innerHeight
        const viewportCenter = viewportHeight / 2

        for (const panel of panels) {
          const rect = panel.getBoundingClientRect()
          const panelCenter = rect.top + rect.height / 2
          const distance = Math.abs(panelCenter - viewportCenter)
          
          // Tight fade around center tile
          // 0-75px: 0-50% opacity (center tile mostly visible)
          // 75-200px: 50-100% opacity (fading in adjacent tiles)
          // 200+px: 100% opacity (full overlay on far tiles)
          let opacity = 0
          if (distance < 75) {
            opacity = (distance / 75) * 0.5
          } else if (distance < 200) {
            opacity = 0.5 + ((distance - 75) / 125) * 0.5
          } else {
            opacity = 1.0
          }

          scrollOpacity.set(panel, opacity)
          updatePanelOpacity(panel)
        }
      }

      const scheduleScrollUpdate = () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId)
        }
        animationFrameId = requestAnimationFrame(updateScrollOverlay)
      }

      const updatePanelOpacity = (panel: HTMLElement) => {
        // Use the lower of the two opacities (to show content when either condition is met)
        const sOpacity = scrollOpacity.get(panel) ?? 1
        const mOpacity = mouseProximityOpacity.get(panel) ?? 1
        const finalOpacity = Math.min(sOpacity, mOpacity)
        panel.style.setProperty('--panel-caption-overlay-opacity', finalOpacity.toString())
      }

      const handleMouseMove = (e: MouseEvent) => {
        const mouseX = e.clientX
        const mouseY = e.clientY

        for (const panel of panels) {
          const rect = panel.getBoundingClientRect()
          const panelCenterX = rect.left + rect.width / 2
          const panelCenterY = rect.top + rect.height / 2

          const distance = Math.sqrt(
            Math.pow(mouseX - panelCenterX, 2) + Math.pow(mouseY - panelCenterY, 2)
          )

          // Tight proximity fade based on cursor distance
          // 0-75px: 0% opacity (cursor on tile)
          // 75-200px: 0-100% opacity (fade in)
          // 200+px: 100% opacity (far from cursor)
          let opacity = 1
          if (distance < 75) {
            opacity = (distance / 75) * 0.5
          } else if (distance < 200) {
            opacity = 0.5 + ((distance - 75) / 125) * 0.5
          }

          mouseProximityOpacity.set(panel, opacity)
          updatePanelOpacity(panel)
        }
      }

      for (const panel of panels) {
        scrollOpacity.set(panel, 1)
        mouseProximityOpacity.set(panel, 1)
        panel.style.setProperty('--panel-caption-overlay-opacity', '1')
      }

      updateScrollOverlay()

      document.addEventListener('scroll', scheduleScrollUpdate, { passive: true })
      window.addEventListener('scroll', scheduleScrollUpdate, { passive: true })
      root.addEventListener('scroll', scheduleScrollUpdate, { passive: true })
      window.addEventListener('resize', scheduleScrollUpdate, { passive: true })
      root.addEventListener('mousemove', handleMouseMove, { passive: true })

      return () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId)
        }
        document.removeEventListener('scroll', scheduleScrollUpdate)
        window.removeEventListener('scroll', scheduleScrollUpdate)
        root.removeEventListener('scroll', scheduleScrollUpdate)
        window.removeEventListener('resize', scheduleScrollUpdate)
        root.removeEventListener('mousemove', handleMouseMove)
      }
    } else {
      // Desktop on homepage: Use hover to reveal/hide overlay
      for (const panel of panels) {
        // Default to full overlay (hidden content)
        panel.style.setProperty('--panel-caption-overlay-opacity', '1')

        panel.addEventListener('mouseenter', () => {
          panel.style.setProperty('--panel-caption-overlay-opacity', '0')
        })

        panel.addEventListener('mouseleave', () => {
          panel.style.setProperty('--panel-caption-overlay-opacity', '1')
        })
      }

      return () => {
        // Event listeners are automatically cleaned up when component unmounts
      }
    }
  }, [rootRef])
}
