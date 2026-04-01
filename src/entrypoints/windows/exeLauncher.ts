import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'

function findProjectRoot(entryRelPath: string): string {
  const exeDir = dirname(process.execPath)
  const roots = [process.cwd(), join(exeDir, '..'), exeDir]
  for (const root of roots) {
    if (existsSync(join(root, entryRelPath))) {
      return root
    }
  }
  throw new Error(
    `Cannot locate project files. Expected ${entryRelPath} under cwd or exe directory.`,
  )
}

export function runTsEntrypoint(entryRelPath: string): void {
  try {
    const root = findProjectRoot(entryRelPath)
    const scriptPath = join(root, entryRelPath)
    const args = [scriptPath, ...process.argv.slice(2)]
    const bun = resolveBunCommand()
    const child = spawnSync(bun, args, {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    if (child.error) {
      throw child.error
    }
    if (typeof child.status === 'number') {
      process.exit(child.status)
    }
    process.exit(1)
  } catch (error) {
    // Keep error visible when launched as a standalone .exe
    // biome-ignore lint/suspicious/noConsole: launcher must print startup errors
    console.error('[launcher] startup failed:', error)
    process.exit(1)
  }
}

function resolveBunCommand(): string {
  const candidates = [
    process.env.BUN_EXE,
    process.env.BUN_PATH,
    join(homedir(), '.bun', 'bin', 'bun.exe'),
    'bun',
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    if (candidate === 'bun') return candidate
    if (existsSync(candidate)) return candidate
  }
  return 'bun'
}
