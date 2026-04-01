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
      `Provider [openai/google/anthropic-compatible] ` +
      `(current: ${providerCurrent}, Enter to keep): `
    const providerInput = (await rl.question(providerPrompt)).trim().toLowerCase()
    const provider =
      providerInput === 'openai'
        ? 'openai'
        : providerInput === 'google'
          ? 'google'
        : providerInput === 'anthropic-compatible'
          ? 'anthropic-compatible'
          : providerCurrent
    process.env.HAHA_API_PROVIDER = provider
    updates.HAHA_API_PROVIDER = provider

    const baseUrlEnvKey =
      provider === 'openai'
        ? 'OPENAI_BASE_URL'
        : provider === 'google'
          ? 'GOOGLE_BASE_URL'
          : 'ANTHROPIC_BASE_URL'
    const baseUrlLabel =
      provider === 'openai'
        ? 'OpenAI API Base URL'
        : provider === 'google'
          ? 'Google API Base URL'
        : 'Anthropic-compatible API Base URL'
    const baseUrlExample =
      provider === 'openai'
        ? 'https://api.openai.com/v1'
        : provider === 'google'
          ? 'https://generativelanguage.googleapis.com/v1beta/openai'
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
        : provider === 'google'
          ? 'Model name (e.g. gemini-2.5-pro): '
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
      if (provider === 'openai') {
        process.env.OPENAI_MODEL = modelInput
        updates.OPENAI_MODEL = modelInput
      }
      if (provider === 'google') {
        process.env.GOOGLE_MODEL = modelInput
        updates.GOOGLE_MODEL = modelInput
      }
    }

    const keyEnvKey =
      provider === 'openai'
        ? 'OPENAI_API_KEY'
        : provider === 'google'
          ? 'GOOGLE_API_KEY'
          : 'ANTHROPIC_AUTH_TOKEN'
    rl.pause()
    const keyInput = await questionHidden(
      `${keyEnvKey} (input hidden, Enter to keep current): `,
    )
    rl.resume()
    if (keyInput) {
      process.env[keyEnvKey] = keyInput
      updates[keyEnvKey] = keyInput
      if (provider === 'anthropic-compatible') {
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

async function questionHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY) return ''
  stdout.write(prompt)
  const wasRaw = stdin.isRaw
  stdin.setRawMode?.(true)
  stdin.resume()
  let value = ''
  try {
    return await new Promise<string>(resolve => {
      const onData = (chunk: string | Buffer) => {
        const text = chunk.toString('utf8')
        for (const ch of text) {
          if (ch === '\r' || ch === '\n') {
            stdout.write('\n')
            stdin.off('data', onData)
            resolve(value.trim())
            return
          }
          if (ch === '\u0003') {
            stdout.write('\n')
            stdin.off('data', onData)
            resolve('')
            return
          }
          if (ch === '\b' || ch === '\u007f') {
            value = value.slice(0, -1)
            continue
          }
          value += ch
        }
      }
      stdin.on('data', onData)
    })
  } finally {
    stdin.setRawMode?.(Boolean(wasRaw))
  }
}
