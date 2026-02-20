import { useEffect, type RefObject } from 'react'

type UseManagedVideoPreviewsOptions = {
  minVisibleRatio?: number
}

type VideoState = {
  video: HTMLVideoElement
  panel: HTMLElement
}

export function useManagedVideoPreviews(
  rootRef: RefObject<HTMLElement | null>,
  options: UseManagedVideoPreviewsOptions = {},
) {
  const { minVisibleRatio = 0.01 } = options

  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    const allVideos = Array.from(root.querySelectorAll<HTMLVideoElement>('video[data-preview-loop="true"]'))
    if (allVideos.length === 0) {
      return
    }

    const entries = new Map<HTMLVideoElement, IntersectionObserverEntry>()
    const videoStates: VideoState[] = []

    const getVisibilityRatio = (video: HTMLVideoElement) => {
      const entry = entries.get(video)
      if (entry) {
        return entry.isIntersecting ? entry.intersectionRatio : 0
      }

      const rect = video.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        return 0
      }

      const horizontalVisible = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)
      const verticalVisible = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
      const visibleArea = Math.max(0, horizontalVisible) * Math.max(0, verticalVisible)
      const totalArea = rect.width * rect.height

      if (totalArea === 0) {
        return 0
      }

      return visibleArea / totalArea
    }

    const getArea = (video: HTMLVideoElement) => {
      const rect = video.getBoundingClientRect()
      return Math.max(0, rect.width * rect.height)
    }

    const isMobileViewport = () => window.matchMedia('(hover: none), (pointer: coarse)').matches

    for (const video of allVideos) {
      const panel = video.closest<HTMLElement>('[data-video-panel="true"]') ?? video

      if (video.dataset.originalMuted == null) {
        video.dataset.originalMuted = String(video.muted)
      }

      if (video.dataset.originalControls == null) {
        video.dataset.originalControls = String(video.controls)
      }

      if (video.dataset.originalPlaybackRate == null) {
        video.dataset.originalPlaybackRate = String(video.playbackRate || 1)
      }

      if (video.dataset.previewHover == null) {
        video.dataset.previewHover = 'false'
      }

      video.preload = 'metadata'
      video.loop = true
      video.playsInline = true
      videoStates.push({ video, panel })
    }

    const pauseVideo = (video: HTMLVideoElement) => {
      video.preload = 'metadata'
      if (!video.paused) {
        video.pause()
      }
    }

    const playVideo = (video: HTMLVideoElement) => {
      video.preload = 'auto'
      video.playbackRate = Number(video.dataset.originalPlaybackRate ?? '1') || 1

      if (video.paused) {
        void video.play().catch(() => {
          return
        })
      }
    }

    const setControlsState = (video: HTMLVideoElement, enabled: boolean) => {
      video.controls = enabled
    }

    const updatePlaybackState = () => {
      if (document.hidden) {
        for (const state of videoStates) {
          pauseVideo(state.video)
        }
        return
      }

      const mobileViewport = isMobileViewport()
      const ranked = videoStates
        .map((state) => ({
          state,
          ratio: getVisibilityRatio(state.video),
          hovered: state.video.dataset.previewHover === 'true',
          area: getArea(state.video),
        }))
        .filter((item) => item.ratio >= minVisibleRatio)
        .sort((left, right) => {
          if (!mobileViewport && right.hovered !== left.hovered) {
            return Number(right.hovered) - Number(left.hovered)
          }

          if (right.ratio !== left.ratio) {
            return right.ratio - left.ratio
          }

          return right.area - left.area
        })

      const hoveredVideo = ranked.find((item) => item.hovered)?.state.video
      const activeVideo = mobileViewport ? ranked[0]?.state.video : hoveredVideo ?? ranked[0]?.state.video

      for (const state of videoStates) {
        const hovered = state.video.dataset.previewHover === 'true'

        if (state.video === activeVideo) {
          state.video.muted = !(hovered && !mobileViewport)
          playVideo(state.video)
          setControlsState(state.video, false)
        } else {
          state.video.muted = true
          pauseVideo(state.video)
          setControlsState(state.video, false)
        }
      }
    }

    const observer = new IntersectionObserver(
      (intersectionEntries) => {
        for (const entry of intersectionEntries) {
          const video = entry.target as HTMLVideoElement
          entries.set(video, entry)
        }

        updatePlaybackState()
      },
      {
        threshold: [0, 0.01],
      },
    )

    const panelListeners = new Map<HTMLElement, { enter: () => void; leave: () => void }>()

    for (const state of videoStates) {
      observer.observe(state.video)

      if (!panelListeners.has(state.panel)) {
        const enter = () => {
          const panelVideos = state.panel.querySelectorAll<HTMLVideoElement>('video[data-preview-loop="true"]')
          panelVideos.forEach((video) => {
            video.dataset.previewHover = 'true'
          })
          updatePlaybackState()
        }

        const leave = () => {
          const panelVideos = state.panel.querySelectorAll<HTMLVideoElement>('video[data-preview-loop="true"]')
          panelVideos.forEach((video) => {
            video.dataset.previewHover = 'false'
          })
          updatePlaybackState()
        }

        state.panel.addEventListener('pointerenter', enter)
        state.panel.addEventListener('pointerleave', leave)
        panelListeners.set(state.panel, { enter, leave })
      }
    }

    const handleVisibilityChange = () => {
      updatePlaybackState()
    }

    const handleResize = () => {
      updatePlaybackState()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('resize', handleResize)

    updatePlaybackState()

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('resize', handleResize)

      for (const [panel, listeners] of panelListeners.entries()) {
        panel.removeEventListener('pointerenter', listeners.enter)
        panel.removeEventListener('pointerleave', listeners.leave)
      }

      for (const state of videoStates) {
        const video = state.video
        if (!video.paused) {
          video.pause()
        }

        if (video.dataset.originalMuted === 'false') {
          video.muted = false
        }

        if (video.dataset.originalControls === 'true') {
          video.controls = true
        }

        video.playbackRate = Number(video.dataset.originalPlaybackRate ?? '1') || 1
      }
    }
  }, [minVisibleRatio, rootRef])
}
