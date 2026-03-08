import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecFile = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execFile: mockExecFile }));

import { openBrowser } from '../browser.js';

describe('openBrowser', () => {
  beforeEach(() => mockExecFile.mockReset());

  it('uses xdg-open on linux', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    openBrowser('https://example.com');
    expect(mockExecFile).toHaveBeenCalledWith('xdg-open', ['https://example.com'], expect.any(Function));
  });

  it('uses open on darwin', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    openBrowser('https://example.com');
    expect(mockExecFile).toHaveBeenCalledWith('open', ['https://example.com'], expect.any(Function));
  });

  it('uses start on win32', () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    openBrowser('https://example.com');
    expect(mockExecFile).toHaveBeenCalledWith('start', ['https://example.com'], expect.any(Function));
  });
});
