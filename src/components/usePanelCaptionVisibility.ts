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

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const panel = entry.target as HTMLElement
          panel.dataset.panelInview = entry.isIntersecting && entry.intersectionRatio > 0.05 ? 'true' : 'false'
        }
      },
      {
        threshold: [0, 0.05, 0.2, 0.4],
      },
    )

    for (const panel of panels) {
      panel.dataset.panelInview = 'false'
      observer.observe(panel)
    }

    return () => {
      observer.disconnect()
    }
  }, [rootRef])
}
