import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

function stripQuotes(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eqIdx = line.indexOf('=')
    if (eqIdx <= 0) continue
    const key = line.slice(0, eqIdx).trim()
    if (!key) continue
    const value = stripQuotes(line.slice(eqIdx + 1))
    out[key] = value
  }
  return out
}

export function loadEnvIfPresent(filename: string): void {
  const entryDir = dirname(fileURLToPath(import.meta.url))
  const projectRoot = join(entryDir, '..', '..', '..')
  const candidates = [join(process.cwd(), filename), join(projectRoot, filename)]
  for (const file of candidates) {
    if (!existsSync(file)) continue
    const parsed = parseEnvFile(readFileSync(file, 'utf8'))
    for (const [k, v] of Object.entries(parsed)) {
      if (process.env[k] === undefined) {
        process.env[k] = v
      }
    }
  }
}

function appendCustomHeader(headerName: string, headerValue: string): void {
  const line = `${headerName}: ${headerValue}`
  const current = process.env.ANTHROPIC_CUSTOM_HEADERS
  if (!current || !current.trim()) {
    process.env.ANTHROPIC_CUSTOM_HEADERS = line
    return
  }
  const hasHeader = current
    .split(/\r?\n/)
    .some(item => item.trim().toLowerCase().startsWith(`${headerName.toLowerCase()}:`))
  if (!hasHeader) {
    process.env.ANTHROPIC_CUSTOM_HEADERS = `${current}\n${line}`
  }
}

function syncModelFrom(prefix: string): void {
  const model = process.env[`${prefix}_MODEL`]
  if (!model) return
  process.env.ANTHROPIC_MODEL ??= model
  process.env.ANTHROPIC_DEFAULT_SONNET_MODEL ??= model
  process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL ??= model
  process.env.ANTHROPIC_DEFAULT_OPUS_MODEL ??= model
}

type RenameProvider =
  | 'anthropic-compatible'
  | 'openrouter'
  | 'openai'
  | 'google'

export function getRenameProvider(): RenameProvider {
  const raw = (process.env.HAHA_API_PROVIDER || '').trim().toLowerCase()
  if (!raw) return 'anthropic-compatible'
  if (
    raw === 'anthropic-compatible' ||
    raw === 'anthropic_compatible' ||
    raw === 'anthropic'
  ) {
    return 'anthropic-compatible'
  }
  if (raw === 'openrouter') return 'openrouter'
  if (raw === 'openai') return 'openai'
  if (raw === 'google' || raw === 'gemini') return 'google'
  return 'anthropic-compatible'
}

export function applyClaudeLoginProfile(): void {
  const forceOauth = process.env.HAHA_LOGIN_FORCE_OAUTH !== '0'
  if (forceOauth) {
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_AUTH_TOKEN
    delete process.env.ANTHROPIC_BASE_URL
  }
  process.env.CLAUDE_HAHA_LAUNCHER = 'Claude.exe'
}

export function applyClaudeRenameProfile(): void {
  process.env.CLAUDE_HAHA_LAUNCHER = 'claude_rename.exe'
  process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC ??= '1'
  process.env.DISABLE_TELEMETRY ??= '1'
  process.env.API_TIMEOUT_MS ??= '3000000'

  const provider = getRenameProvider()
  process.env.HAHA_API_PROVIDER = provider
  if (provider === 'openai') {
    process.env.CLAUDE_CODE_USE_OPENAI = '1'
  } else {
    delete process.env.CLAUDE_CODE_USE_OPENAI
  }

  if (provider === 'openrouter') {
    process.env.ANTHROPIC_BASE_URL ??=
      process.env.OPENROUTER_ANTHROPIC_BASE_URL ||
      'https://openrouter.ai/api/v1/anthropic'
    process.env.ANTHROPIC_AUTH_TOKEN ??= process.env.OPENROUTER_API_KEY
    syncModelFrom('OPENROUTER')
    if (process.env.OPENROUTER_SITE_URL) {
      appendCustomHeader('HTTP-Referer', process.env.OPENROUTER_SITE_URL)
    }
    if (process.env.OPENROUTER_SITE_NAME) {
      appendCustomHeader('X-Title', process.env.OPENROUTER_SITE_NAME)
    }
    return
  }

  if (provider === 'openai') {
    process.env.OPENAI_BASE_URL ??=
      process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1'
    process.env.OPENAI_API_KEY ??=
      process.env.OPENAI_AUTH_TOKEN ||
      process.env.ANTHROPIC_AUTH_TOKEN ||
      process.env.ANTHROPIC_API_KEY
    syncModelFrom('OPENAI')
    return
  }

  if (provider === 'google') {
    process.env.ANTHROPIC_BASE_URL ??= process.env.GOOGLE_ANTHROPIC_BASE_URL
    process.env.ANTHROPIC_AUTH_TOKEN ??= process.env.GOOGLE_API_KEY
    syncModelFrom('GOOGLE')
  }
}
