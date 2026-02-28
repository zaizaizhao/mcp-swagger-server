import chalk from 'chalk';
import { format } from 'util';

let consoleReroutedForStdio = false;

export function setupWindowsConsole() {
  if (process.platform === 'win32') {
    try {
      process.stderr.write('\x1b[?25h');
      
      if (!process.env.FORCE_COLOR && !process.stdout.isTTY) {
        chalk.level = 0;
      }
    } catch (error) {
      // Ignore encoding setup errors
    }
  }
}

/**
 * Route console.log/info/debug output to stderr.
 * This is required for stdio transport so MCP protocol output remains clean on stdout.
 */
export function routeConsoleToStderrForStdio(): void {
  if (consoleReroutedForStdio) {
    return;
  }

  const writeToStderr = (...args: unknown[]) => {
    process.stderr.write(`${format(...args)}\n`);
  };

  console.log = writeToStderr as typeof console.log;
  console.info = writeToStderr as typeof console.info;
  console.debug = writeToStderr as typeof console.debug;
  consoleReroutedForStdio = true;
}
