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

    const isTouch = isTouchDevice()

    if (isTouch) {
      // Mobile: Use hover to reveal/hide overlay
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
    } else {
      // Desktop: Use IntersectionObserver for visibility-based overlay with fade
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const panel = entry.target as HTMLElement
            
            // If visible >= 50% on screen, no overlay (opacity 0)
            // If visible < 50% on screen, full overlay (opacity 1)
            const opacity = entry.intersectionRatio >= 0.5 ? 0 : 1
            panel.style.setProperty('--panel-caption-overlay-opacity', opacity.toString())
          }
        },
        {
          threshold: [0, 0.25, 0.5, 0.75, 1],
        },
      )

      for (const panel of panels) {
        // Default to full overlay until intersection data available
        panel.style.setProperty('--panel-caption-overlay-opacity', '1')
        observer.observe(panel)
      }

      return () => {
        observer.disconnect()
      }
    }
  }, [rootRef])
}
