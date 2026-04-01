import {
  applyClaudeRenameProfile,
  getRenameProvider,
  loadEnvIfPresent,
} from './launcherUtils.js'
import { createInterface } from 'readline/promises'
import { stdin, stdout } from 'process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readFileSync, writeFileSync } from 'fs'

loadEnvIfPresent('.env')
loadEnvIfPresent('.env.rename')
await askRenameRuntimeConfig()
applyClaudeRenameProfile()

await import('../cli.tsx')

async function askRenameRuntimeConfig(): Promise<void> {
  if (!stdin.isTTY || !stdout.isTTY) return
  // avoid prompt in non-interactive utilities
  if (
    process.argv.includes('--version') ||
    process.argv.includes('-v') ||
    process.argv.includes('-p') ||
    process.argv.includes('--print')
  ) {
    return
  }
  const rl = createInterface({ input: stdin, output: stdout })
  const updates: Record<string, string> = {}
  try {
    const current = (process.env.CLAUDE_HAHA_BRAND_NAME || '').trim()
    const namePrompt = current
      ? `Welcome name (current: ${current}, Enter to keep): `
      : 'Welcome name (default: Claude Code): '
    const brandInput = (await rl.question(namePrompt)).trim()
    if (brandInput) {
      process.env.CLAUDE_HAHA_BRAND_NAME = brandInput
      updates.CLAUDE_HAHA_BRAND_NAME = brandInput
    } else if (!current) {
      delete process.env.CLAUDE_HAHA_BRAND_NAME
      updates.CLAUDE_HAHA_BRAND_NAME = ''
    }

    const providerCurrent = getRenameProvider()
    const providerPrompt =
      `Provider [openai/anthropic-compatible] ` +
      `(current: ${providerCurrent}, Enter to keep): `
    const providerInput = (await rl.question(providerPrompt)).trim().toLowerCase()
    const provider =
      providerInput === 'openai'
        ? 'openai'
        : providerInput === 'anthropic-compatible'
          ? 'anthropic-compatible'
          : providerCurrent
    process.env.HAHA_API_PROVIDER = provider
    updates.HAHA_API_PROVIDER = provider

    const baseUrlEnvKey =
      provider === 'openai' ? 'OPENAI_BASE_URL' : 'ANTHROPIC_BASE_URL'
    const baseUrlLabel =
      provider === 'openai'
        ? 'OpenAI API Base URL'
        : 'Anthropic-compatible API Base URL'
    const baseUrlExample =
      provider === 'openai'
        ? 'https://api.openai.com/v1'
        : 'https://openrouter.ai/api/v1/anthropic'
    const currentBaseUrl = (process.env[baseUrlEnvKey] || '').trim()
    const baseUrlPrompt = currentBaseUrl
      ? `${baseUrlLabel} (current: ${currentBaseUrl}, Enter to keep): `
      : `${baseUrlLabel} (e.g. ${baseUrlExample}): `
    const baseUrlInput = (await rl.question(baseUrlPrompt)).trim()
    if (baseUrlInput) {
      process.env[baseUrlEnvKey] = baseUrlInput
      updates[baseUrlEnvKey] = baseUrlInput
    }

    const currentModel =
      (process.env.ANTHROPIC_MODEL || process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || '').trim()
    const modelPrompt = currentModel
      ? `Model name (current: ${currentModel}, Enter to keep): `
      : provider === 'openai'
        ? 'Model name (e.g. gpt-4.1): '
        : 'Model name (e.g. MiniMax-M2.7-highspeed): '
    const modelInput = (await rl.question(modelPrompt)).trim()
    if (modelInput) {
      process.env.ANTHROPIC_MODEL = modelInput
      process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = modelInput
      process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = modelInput
      process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = modelInput
      updates.ANTHROPIC_MODEL = modelInput
      updates.ANTHROPIC_DEFAULT_SONNET_MODEL = modelInput
      updates.ANTHROPIC_DEFAULT_HAIKU_MODEL = modelInput
      updates.ANTHROPIC_DEFAULT_OPUS_MODEL = modelInput
    }

    const keyEnvKey =
      provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_AUTH_TOKEN'
    const keyPrompt = `${keyEnvKey} (Enter to keep current env value, input hidden is not supported): `
    const keyInput = (await rl.question(keyPrompt)).trim()
    if (keyInput) {
      process.env[keyEnvKey] = keyInput
      updates[keyEnvKey] = keyInput
      if (provider !== 'openai') {
        process.env.ANTHROPIC_API_KEY = keyInput
        updates.ANTHROPIC_API_KEY = keyInput
      }
    }

    persistRenameEnv(updates)
  } finally {
    rl.close()
  }
}

function persistRenameEnv(updates: Record<string, string>): void {
  const filePath = resolveRenameEnvPath()
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf8') : ''
  const map = parseSimpleEnv(existing)

  for (const [key, value] of Object.entries(updates)) {
    if (value === '') {
      delete map[key]
      continue
    }
    map[key] = value
  }

  const nextContent =
    Object.entries(map)
      .map(([k, v]) => `${k}=${formatEnvValue(v)}`)
      .join('\n') + '\n'
  writeFileSync(filePath, nextContent, 'utf8')
}

function resolveRenameEnvPath(): string {
  const entryDir = dirname(fileURLToPath(import.meta.url))
  const projectRoot = join(entryDir, '..', '..', '..')
  return join(projectRoot, '.env.rename')
}

function parseSimpleEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    if (key) out[key] = value
  }
  return out
}

function formatEnvValue(value: string): string {
  if (/^[A-Za-z0-9._:/-]+$/.test(value)) {
    return value
  }
  return `"${value.replaceAll('"', '\\"')}"`
}
