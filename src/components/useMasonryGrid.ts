import { useEffect, type RefObject } from 'react'

type UseMasonryGridOptions = {
  gridSelector?: string
  itemSelector?: string
}

export function useMasonryGrid(rootRef: RefObject<HTMLElement | null>, options: UseMasonryGridOptions = {}) {
  const { gridSelector = '.project-media-grid', itemSelector = '.media-card' } = options

  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    const grid = root.querySelector<HTMLElement>(gridSelector)
    if (!grid) {
      return
    }

    const items = Array.from(grid.querySelectorAll<HTMLElement>(itemSelector))
    if (items.length === 0) {
      return
    }

    const resizeItem = (item: HTMLElement) => {
      const styles = window.getComputedStyle(grid)
      const rowGap = Number.parseFloat(styles.rowGap || '0') || 0
      const rowHeight = Number.parseFloat(styles.gridAutoRows || '1') || 1

      item.style.gridRowEnd = 'auto'
      const itemHeight = item.getBoundingClientRect().height
      const span = Math.max(1, Math.ceil((itemHeight + rowGap) / (rowHeight + rowGap)))
      item.style.gridRowEnd = `span ${span}`
    }

    const resizeAll = () => {
      items.forEach((item) => resizeItem(item))
    }

    const mediaListeners: Array<{ target: Element; event: string; handler: EventListener }> = []

    for (const item of items) {
      const mediaElements = item.querySelectorAll('img, video')
      for (const mediaElement of mediaElements) {
        const handler = () => resizeItem(item)
        mediaElement.addEventListener('load', handler)
        mediaElement.addEventListener('loadedmetadata', handler)
        mediaElement.addEventListener('error', handler)

        mediaListeners.push({ target: mediaElement, event: 'load', handler })
        mediaListeners.push({ target: mediaElement, event: 'loadedmetadata', handler })
        mediaListeners.push({ target: mediaElement, event: 'error', handler })
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      resizeAll()
    })

    resizeObserver.observe(grid)
    for (const item of items) {
      resizeObserver.observe(item)
    }

    const timerId = window.setTimeout(resizeAll, 0)
    window.addEventListener('resize', resizeAll)

    return () => {
      window.clearTimeout(timerId)
      window.removeEventListener('resize', resizeAll)
      resizeObserver.disconnect()

      for (const listener of mediaListeners) {
        listener.target.removeEventListener(listener.event, listener.handler)
      }
    }
  }, [gridSelector, itemSelector, rootRef])
}
