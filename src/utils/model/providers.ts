import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../services/analytics/index.js'
import { isEnvTruthy } from '../envUtils.js'

export type APIProvider = 'firstParty' | 'bedrock' | 'vertex' | 'foundry'
export type HahaProvider =
  | 'anthropic-compatible'
  | 'openai'
  | 'openrouter'
  | 'google'

export function getAPIProvider(): APIProvider {
  return isEnvTruthy(process.env.CLAUDE_CODE_USE_BEDROCK)
    ? 'bedrock'
    : isEnvTruthy(process.env.CLAUDE_CODE_USE_VERTEX)
      ? 'vertex'
      : isEnvTruthy(process.env.CLAUDE_CODE_USE_FOUNDRY)
        ? 'foundry'
        : 'firstParty'
}

export function getAPIProviderForStatsig(): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS {
  return getAPIProvider() as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
}

export function getHahaProvider(): HahaProvider | null {
  const raw = (process.env.HAHA_API_PROVIDER || '').trim().toLowerCase()
  if (!raw) return null
  if (raw === 'openai') return 'openai'
  if (raw === 'openrouter') return 'openrouter'
  if (raw === 'google' || raw === 'gemini') return 'google'
  if (
    raw === 'anthropic-compatible' ||
    raw === 'anthropic_compatible' ||
    raw === 'anthropic'
  ) {
    return 'anthropic-compatible'
  }
  return null
}

export function isOpenAIProviderEnabled(): boolean {
  return (
    isEnvTruthy(process.env.CLAUDE_CODE_USE_OPENAI) ||
    getHahaProvider() === 'openai'
  )
}

export function getEffectiveProviderLabel(): string {
  if (isOpenAIProviderEnabled()) return 'OpenAI'

  const hahaProvider = getHahaProvider()
  if (hahaProvider === 'anthropic-compatible') return 'Anthropic-Compatible'
  if (hahaProvider === 'openrouter') return 'OpenRouter (Anthropic-Compatible)'
  if (hahaProvider === 'google') return 'Google (Anthropic-Compatible)'

  const provider = getAPIProvider()
  if (provider === 'bedrock') return 'AWS Bedrock'
  if (provider === 'vertex') return 'Google Vertex AI'
  if (provider === 'foundry') return 'Microsoft Foundry'
  return 'Anthropic'
}

/**
 * Check if ANTHROPIC_BASE_URL is a first-party Anthropic API URL.
 * Returns true if not set (default API) or points to api.anthropic.com
 * (or api-staging.anthropic.com for ant users).
 */
export function isFirstPartyAnthropicBaseUrl(): boolean {
  const baseUrl = process.env.ANTHROPIC_BASE_URL
  if (!baseUrl) {
    return true
  }
  try {
    const host = new URL(baseUrl).host
    const allowedHosts = ['api.anthropic.com']
    if (process.env.USER_TYPE === 'ant') {
      allowedHosts.push('api-staging.anthropic.com')
    }
    return allowedHosts.includes(host)
  } catch {
    return false
  }
}
