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

    const updateOverlayOpacity = () => {
      const viewportHeight = window.innerHeight
      const viewportCenter = viewportHeight / 2

      for (const panel of panels) {
        const rect = panel.getBoundingClientRect()
        const panelCenter = rect.top + rect.height / 2
        const distance = Math.abs(panelCenter - viewportCenter)
        
        // Calculate opacity based on distance from viewport center
        // 0px distance (focused tile) = 0 opacity
        // ~300px distance (adjacent tiles) = 0.5 opacity (50% of max)
        // >500px distance (far tiles) = 1.0 opacity (full overlay)
        let opacity = 0
        if (distance < 100) {
          // Very close to center: smooth transition from 0 to 0.5
          opacity = (distance / 100) * 0.5
        } else if (distance < 400) {
          // Medium distance: transition from 0.5 to 1.0
          opacity = 0.5 + ((distance - 100) / 300) * 0.5
        } else {
          // Far away: full opacity
          opacity = 1.0
        }

        panel.style.setProperty('--panel-caption-overlay-opacity', opacity.toString())
      }
    }

    // Update on scroll
    const scrollHandler = () => {
      updateOverlayOpacity()
    }

    // Initial update
    updateOverlayOpacity()

    root.addEventListener('scroll', scrollHandler, { passive: true })
    window.addEventListener('resize', scrollHandler, { passive: true })

    return () => {
      root.removeEventListener('scroll', scrollHandler)
      window.removeEventListener('resize', scrollHandler)
    }
  }, [rootRef])
}
