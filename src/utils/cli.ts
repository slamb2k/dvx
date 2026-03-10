import * as clack from '@clack/prompts'

export interface UxOptions {
  quiet: boolean
  noColor: boolean
}

let uxState: UxOptions = { quiet: false, noColor: false }

export function setUxOptions(opts: UxOptions): void {
  uxState = opts
}

export function getUxOptions(): UxOptions {
  return uxState
}

export function isInteractive(): boolean {
  return Boolean(process.stderr.isTTY) && !uxState.quiet
}

export interface SpinnerHandle {
  start(msg: string): void
  stop(msg: string): void
  message(msg: string): void
  error(msg: string): void
}

export function createSpinner(): SpinnerHandle {
  if (!isInteractive()) {
    return { start() {}, stop() {}, message() {}, error() {} }
  }
  const s = clack.spinner()
  return {
    start(msg: string) { s.start(msg) },
    stop(msg: string) { s.stop(msg) },
    message(msg: string) { s.message(msg) },
    error(msg: string) { s.stop(msg) },
  }
}

export function logSuccess(msg: string): void {
  if (isInteractive()) {
    clack.log.success(msg)
  } else {
    process.stderr.write(`${msg}\n`)
  }
}

export function logError(msg: string): void {
  if (isInteractive()) {
    clack.log.error(msg)
  } else {
    process.stderr.write(`Error: ${msg}\n`)
  }
}

export function logWarn(msg: string): void {
  if (!isInteractive()) return
  clack.log.warn(msg)
}

export function logInfo(msg: string): void {
  if (isInteractive()) {
    clack.log.info(msg)
  } else {
    process.stderr.write(`Hint: ${msg}\n`)
  }
}

export function logStep(msg: string): void {
  if (!isInteractive()) return
  clack.log.step(msg)
}

export function logDryRun(method: string, url: string, body?: unknown): void {
  if (isInteractive()) {
    clack.log.warn(`[DRY RUN] ${method} ${url}`)
    if (body !== undefined) {
      clack.log.info(`Body: ${JSON.stringify(body)}`)
    }
  } else {
    process.stderr.write(`[DRY RUN] ${method} ${url}\n`)
    if (body !== undefined) {
      process.stderr.write(`[DRY RUN] Body: ${JSON.stringify(body)}\n`)
    }
  }
}

export function logMutationSuccess(msg: string): void {
  if (!isInteractive()) return
  clack.log.success(msg)
}

export async function promptConfirmClack(msg: string): Promise<boolean> {
  if (!isInteractive()) return false
  const result = await clack.confirm({ message: msg })
  if (clack.isCancel(result)) return false
  return result
}

export async function promptUrl(msg: string, placeholder?: string): Promise<string> {
  const url = await clack.text({
    message: msg,
    placeholder: placeholder ?? 'https://org.crm.dynamics.com',
    validate: (value) => {
      if (!value) return 'Please enter a valid URL'
      try {
        new URL(value)
      } catch {
        return 'Please enter a valid URL'
      }
    },
  })

  if (clack.isCancel(url)) {
    clack.cancel('Operation cancelled.')
    process.exit(0)
  }

  return url as string
}

export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '')
}
