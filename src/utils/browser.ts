import { execFile } from 'node:child_process';

export function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
  execFile(cmd, [url], (err) => {
    if (err) {
      console.error(`Failed to open browser: ${err.message}`);
      console.error(`Please open this URL manually: ${url}`);
    }
  });
}
