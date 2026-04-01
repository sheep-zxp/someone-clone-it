const DEFAULT_BRAND_NAME = 'Claude Code'

export function getBrandName(): string {
  const raw = (process.env.CLAUDE_HAHA_BRAND_NAME || '').trim()
  return raw || DEFAULT_BRAND_NAME
}

export function getWelcomeTitle(): string {
  return `Welcome to ${getBrandName()}`
}
