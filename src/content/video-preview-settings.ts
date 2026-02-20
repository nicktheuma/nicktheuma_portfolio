export const videoThumbnailExtensions = ['.mp4', '.webm', '.mov', '.m4v'] as const

export type VideoPreviewLimitSet = {
  home: {
    maxConcurrent: number
    maxCandidates: number
  }
  project: {
    maxConcurrent: number
    maxCandidates: number
  }
}

export const videoPreviewPresets: Record<'low' | 'balanced' | 'high', VideoPreviewLimitSet> = {
  low: {
    home: {
      maxConcurrent: 1,
      maxCandidates: 4,
    },
    project: {
      maxConcurrent: 2,
      maxCandidates: 6,
    },
  },
  balanced: {
    home: {
      maxConcurrent: 2,
      maxCandidates: 8,
    },
    project: {
      maxConcurrent: 3,
      maxCandidates: 12,
    },
  },
  high: {
    home: {
      maxConcurrent: 3,
      maxCandidates: 12,
    },
    project: {
      maxConcurrent: 4,
      maxCandidates: 16,
    },
  },
} as const

export const activeVideoPreviewMode: keyof typeof videoPreviewPresets = 'balanced'

export const videoPreviewSettings = videoPreviewPresets[activeVideoPreviewMode]
