import { vi } from 'vitest'

/**
 * Standard mock for `../../utils/cli.js`.
 *
 * Usage inside a test file (vitest hoists vi.mock, so the factory must be
 * self-contained — but vi.fn() is available because vitest injects it):
 *
 *   vi.mock('../../utils/cli.js', () => createCliMock())
 *
 * For tests that need to override specific exports (e.g. `isInteractive`),
 * hoist the overrides first, then spread them in:
 *
 *   const { mockIsInteractive } = vi.hoisted(() => ({
 *     mockIsInteractive: vi.fn().mockReturnValue(false),
 *   }))
 *   vi.mock('../../utils/cli.js', () => ({ ...createCliMock(), isInteractive: mockIsInteractive }))
 */
export function createCliMock() {
  return {
    createSpinner: () => ({ start() {}, stop() {}, message() {}, error() {} }),
    isInteractive: () => false,
    logDryRun: vi.fn(),
    logSuccess: vi.fn(),
    logError: vi.fn(),
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logStep: vi.fn(),
    logMutationSuccess: vi.fn(),
    promptConfirmClack: vi.fn().mockResolvedValue(true),
    promptUrl: vi.fn(),
    stripAnsi: (s: string) => s,
    setUxOptions: vi.fn(),
    getUxOptions: () => ({ quiet: false, noColor: false }),
  }
}
