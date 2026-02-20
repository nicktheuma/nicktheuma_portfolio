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

        for (const panel of panels) {
          const rect = panel.getBoundingClientRect()
          
          // Calculate what percentage of the tile is visible
          const visibleTop = Math.max(rect.top, 0)
          const visibleBottom = Math.min(rect.bottom, viewportHeight)
          const visibleHeight = Math.max(0, visibleBottom - visibleTop)
          const visibilityRatio = visibleHeight / rect.height
          
          // 0% opacity when >= 30% visible, fade to 100% as it goes from 30% to 0% visible
          let opacity = 0
          if (visibilityRatio >= 0.3) {
            opacity = 0
          } else {
            // Linear fade from 0% (at 30% visible) to 100% (at 0% visible)
            opacity = (0.3 - visibilityRatio) / 0.3
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
      // Desktop on project page: Use IntersectionObserver for scroll visibility and mouse proximity
      const intersectionOpacity = new Map<HTMLElement, number>()
      const mouseProximityOpacity = new Map<HTMLElement, number>()

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const panel = entry.target as HTMLElement
            
            // 0% opacity when >= 30% visible, fade to 100% as it goes from 30% to 0% visible
            let opacity = 0
            if (entry.intersectionRatio >= 0.3) {
              opacity = 0
            } else {
              // Linear fade from 0% (at 30% visible) to 100% (at 0% visible)
              opacity = (0.3 - entry.intersectionRatio) / 0.3
            }
            intersectionOpacity.set(panel, opacity)
            updatePanelOpacity(panel)
          }
        },
        {
          threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        },
      )

      const updatePanelOpacity = (panel: HTMLElement) => {
        // Use the lower of the two opacities (to show content when either condition is met)
        const scrollOpacity = intersectionOpacity.get(panel) ?? 1
        const mouseOpacity = mouseProximityOpacity.get(panel) ?? 1
        const finalOpacity = Math.min(scrollOpacity, mouseOpacity)
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

          // Opacity based on distance from cursor
          // 0px = 0 opacity (cursor on tile)
          // ~150px = 0.5 opacity (near tile)
          // >300px = 1.0 opacity (far from tile)
          let opacity = 1
          if (distance < 300) {
            opacity = (distance / 300) * 1.0
          }

          mouseProximityOpacity.set(panel, opacity)
          updatePanelOpacity(panel)
        }
      }

      for (const panel of panels) {
        // Initialize opacities
        intersectionOpacity.set(panel, 1)
        mouseProximityOpacity.set(panel, 1)
        panel.style.setProperty('--panel-caption-overlay-opacity', '1')
        observer.observe(panel)
      }

      root.addEventListener('mousemove', handleMouseMove, { passive: true })

      return () => {
        observer.disconnect()
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
