import { applyClaudeLoginProfile, loadEnvIfPresent } from './launcherUtils.js'

loadEnvIfPresent('.env')
loadEnvIfPresent('.env.claude')
applyClaudeLoginProfile()

await import('../cli.tsx')
