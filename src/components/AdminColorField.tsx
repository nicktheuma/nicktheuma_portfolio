type EyeDropperResult = {
  sRGBHex: string
}

type EyeDropperInstance = {
  open: () => Promise<EyeDropperResult>
}

type EyeDropperConstructor = new () => EyeDropperInstance

type AdminColorFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function byteToHex(value: number) {
  return clampByte(value).toString(16).padStart(2, '0')
}

function normalizeHex(value: string) {
  const trimmed = value.trim()
  const shortMatch = trimmed.match(/^#([\da-fA-F]{3})$/)
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split('')
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }

  const longMatch = trimmed.match(/^#([\da-fA-F]{6})$/)
  if (longMatch) {
    return `#${longMatch[1].toLowerCase()}`
  }

  return null
}

function parseRgba(value: string) {
  const rgbaMatch = value
    .trim()
    .match(/^rgba?\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i)

  if (!rgbaMatch) {
    return null
  }

  const red = clampByte(Number(rgbaMatch[1]))
  const green = clampByte(Number(rgbaMatch[2]))
  const blue = clampByte(Number(rgbaMatch[3]))
  const alphaRaw = rgbaMatch[4]
  const alpha = alphaRaw === undefined ? 1 : Math.max(0, Math.min(1, Number(alphaRaw)))

  return { red, green, blue, alpha }
}

function colorInputValueFor(value: string) {
  const hexValue = normalizeHex(value)
  if (hexValue) {
    return hexValue
  }

  const rgbaValue = parseRgba(value)
  if (rgbaValue) {
    return `#${byteToHex(rgbaValue.red)}${byteToHex(rgbaValue.green)}${byteToHex(rgbaValue.blue)}`
  }

  return '#000000'
}

function alphaFor(value: string) {
  const rgbaValue = parseRgba(value)
  return rgbaValue ? rgbaValue.alpha : 1
}

function withColor(value: string, hex: string) {
  const normalizedHex = normalizeHex(hex) ?? '#000000'
  const rgbaValue = parseRgba(value)

  if (!rgbaValue) {
    return normalizedHex
  }

  const red = Number.parseInt(normalizedHex.slice(1, 3), 16)
  const green = Number.parseInt(normalizedHex.slice(3, 5), 16)
  const blue = Number.parseInt(normalizedHex.slice(5, 7), 16)
  return `rgba(${red}, ${green}, ${blue}, ${Number(rgbaValue.alpha.toFixed(2))})`
}

function withAlpha(value: string, alpha: number) {
  const rgbHex = colorInputValueFor(value)
  const red = Number.parseInt(rgbHex.slice(1, 3), 16)
  const green = Number.parseInt(rgbHex.slice(3, 5), 16)
  const blue = Number.parseInt(rgbHex.slice(5, 7), 16)
  return `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(2))})`
}

export function AdminColorField({ id, label, value, onChange }: AdminColorFieldProps) {
  const canUseEyeDropper =
    typeof window !== 'undefined' &&
    'EyeDropper' in window &&
    typeof (window as Window & { EyeDropper?: EyeDropperConstructor }).EyeDropper === 'function'

  const openEyeDropper = async () => {
    if (!canUseEyeDropper) {
      return
    }

    try {
      const EyeDropperApi = (window as Window & { EyeDropper?: EyeDropperConstructor }).EyeDropper
      if (!EyeDropperApi) {
        return
      }

      const result = await new EyeDropperApi().open()
      onChange(withColor(value, result.sRGBHex))
    } catch {
      // user canceled eyedropper
    }
  }

  const hasAlpha = parseRgba(value) !== null

  return (
    <div className="admin-color-field">
      <label className="search-label" htmlFor={id}>
        {label}
      </label>

      <div className="admin-color-row">
        <input
          id={id}
          className="admin-color-native"
          type="color"
          value={colorInputValueFor(value)}
          onChange={(event) => onChange(withColor(value, event.target.value))}
          aria-label={`${label} color picker`}
        />
        <input
          className="search-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} value`}
        />
        <button
          type="button"
          className="admin-button"
          onClick={openEyeDropper}
          disabled={!canUseEyeDropper}
          title={canUseEyeDropper ? 'Pick a color from the page' : 'Eyedropper is not supported in this browser'}
        >
          Eyedropper
        </button>
      </div>

      {hasAlpha ? (
        <div className="admin-alpha-row">
          <span>Opacity</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={alphaFor(value)}
            onChange={(event) => onChange(withAlpha(value, Number(event.target.value)))}
            aria-label={`${label} opacity`}
          />
          <span>{Math.round(alphaFor(value) * 100)}%</span>
        </div>
      ) : null}
    </div>
  )
}
