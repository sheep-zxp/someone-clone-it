import {
  ColorDiff as NativeColorDiff,
  ColorFile as NativeColorFile,
  getSyntaxTheme as nativeGetSyntaxTheme,
  type SyntaxTheme,
} from 'color-diff-napi'
import {
  ColorDiff as TsColorDiff,
  ColorFile as TsColorFile,
  getSyntaxTheme as tsGetSyntaxTheme,
} from '../../native-ts/color-diff/index.js'
import { isEnvDefinedFalsy } from '../../utils/envUtils.js'

export type ColorModuleUnavailableReason = 'env'

/**
 * Returns a static reason why the color-diff module is unavailable, or null if available.
 * 'env' = disabled via CLAUDE_CODE_SYNTAX_HIGHLIGHT
 *
 * The TS port of color-diff works in all build modes, so the only way to
 * disable it is via the env var.
 */
export function getColorModuleUnavailableReason(): ColorModuleUnavailableReason | null {
  if (isEnvDefinedFalsy(process.env.CLAUDE_CODE_SYNTAX_HIGHLIGHT)) {
    return 'env'
  }
  return null
}

export function expectColorDiff(): typeof NativeColorDiff | null {
  if (getColorModuleUnavailableReason() !== null) return null
  const candidate = hasRenderMethod(NativeColorDiff) ? NativeColorDiff : TsColorDiff
  return candidate as unknown as typeof NativeColorDiff
}

export function expectColorFile(): typeof NativeColorFile | null {
  if (getColorModuleUnavailableReason() !== null) return null
  const candidate = hasRenderMethod(NativeColorFile) ? NativeColorFile : TsColorFile
  return candidate as unknown as typeof NativeColorFile
}

export function getSyntaxTheme(themeName: string): SyntaxTheme | null {
  if (getColorModuleUnavailableReason() !== null) return null
  const fn = typeof nativeGetSyntaxTheme === 'function' ? nativeGetSyntaxTheme : tsGetSyntaxTheme
  return fn(themeName) as SyntaxTheme
}

function hasRenderMethod(
  ctor: unknown,
): ctor is new (...args: unknown[]) => { render: (...args: unknown[]) => unknown } {
  if (typeof ctor !== 'function') return false
  const proto = (ctor as { prototype?: unknown }).prototype as
    | { render?: unknown }
    | undefined
  return typeof proto?.render === 'function'
}
