import { useEffect } from 'react'
import type { OverlayEffect, PageTheme } from '../content/media'

const overlayEffectFilterMap: Record<OverlayEffect, string> = {
  none: 'blur(8px)',
  '2-tone': 'blur(8px) grayscale(1) contrast(4.4) saturate(0.6)',
  '3-tone': 'blur(8px) grayscale(1) contrast(2.8) saturate(0.8)',
  '10-tone': 'blur(8px) grayscale(1) contrast(1.45) saturate(0.95)',
}

export function usePageTheme(theme: PageTheme) {
  useEffect(() => {
    const rootStyle = document.documentElement.style
    const previousValues = new Map<string, string>()

    const setThemeVariable = (name: string, value: string) => {
      previousValues.set(name, rootStyle.getPropertyValue(name))
      rootStyle.setProperty(name, value)
    }

    setThemeVariable('--background-color', theme.backgroundColor)
    setThemeVariable('--text-color', theme.textColor)
    setThemeVariable('--panel-text-color', theme.panelTextColor)
    setThemeVariable('--border-color', theme.borderColor)
    setThemeVariable('--panel-background', theme.panelBackground)
    setThemeVariable('--transparent-color', theme.transparentColor)
    setThemeVariable('--overlay-blend-mode', theme.overlayBlendMode)
    setThemeVariable('--overlay-effect-filter', overlayEffectFilterMap[theme.overlayEffect])
    setThemeVariable('--panel-title-text-transform', theme.panelTitleCapitalized ? 'uppercase' : 'none')

    return () => {
      for (const [variableName, previousValue] of previousValues.entries()) {
        if (previousValue) {
          rootStyle.setProperty(variableName, previousValue)
        } else {
          rootStyle.removeProperty(variableName)
        }
      }
    }
  }, [
    theme.backgroundColor,
    theme.textColor,
    theme.panelTextColor,
    theme.borderColor,
    theme.panelBackground,
    theme.transparentColor,
    theme.overlayBlendMode,
    theme.overlayEffect,
    theme.panelTitleCapitalized,
  ])
}
