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
      const updateMobileOverlay = () => {
        const viewportHeight = window.innerHeight
        const viewportCenter = viewportHeight / 2

        for (const panel of panels) {
          const rect = panel.getBoundingClientRect()
          const panelCenter = rect.top + rect.height / 2
          const distance = Math.abs(panelCenter - viewportCenter)
          
          // Calculate opacity based on distance from viewport center
          // 0px distance (focused tile) = 0 opacity
          // ~300px distance (adjacent tiles) = 0.5 opacity
          // >500px distance (far tiles) = 1.0 opacity
          let opacity = 0
          if (distance < 100) {
            opacity = (distance / 100) * 0.5
          } else if (distance < 400) {
            opacity = 0.5 + ((distance - 100) / 300) * 0.5
          } else {
            opacity = 1.0
          }

          panel.style.setProperty('--panel-caption-overlay-opacity', opacity.toString())
        }
      }

      // Initial update
      updateMobileOverlay()

      root.addEventListener('scroll', updateMobileOverlay, { passive: true })
      window.addEventListener('resize', updateMobileOverlay, { passive: true })

      return () => {
        root.removeEventListener('scroll', updateMobileOverlay)
        window.removeEventListener('resize', updateMobileOverlay)
      }
    } else if (onProjectPage) {
      // Desktop on project page: Use IntersectionObserver for scroll visibility and mouse proximity
      const intersectionOpacity = new Map<HTMLElement, number>()
      const mouseProximityOpacity = new Map<HTMLElement, number>()

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const panel = entry.target as HTMLElement
            
            // If visible >= 50% on screen, no overlay (opacity 0)
            // If visible < 50% on screen, full overlay (opacity 1)
            const opacity = entry.intersectionRatio >= 0.5 ? 0 : 1
            intersectionOpacity.set(panel, opacity)
            updatePanelOpacity(panel)
          }
        },
        {
          threshold: [0, 0.25, 0.5, 0.75, 1],
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
