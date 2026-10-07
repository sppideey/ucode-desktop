// SPDX-License-Identifier: AGPL-3.0-only - ucode desktop, made and tested by om dixit. Additional terms: see NOTICE.
/**
 * main.mjs — start ucode desktop's server on top of the installed ucode.
 *
 *   node server/main.mjs --serve   print "UCODE_APP_URL <url>" for the desktop window to open
 *   node server/main.mjs --open    also open it in an Edge or Chrome app window
 *
 * ucode comes with the app (engine/), so only Node is needed. UCODE_AGENT_DIR
 * points at another copy (for testing a checkout); without either, the one
 * `npm i -g ucode-agent` installed is used.
 * When it is missing, one line says so ("UCODE_APP_ERROR ...") and the app
 * shows that instead.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OLDEST = [1, 68, 1];

function fail(message) {
  process.stdout.write(`UCODE_APP_ERROR ${message}\n`);
  process.exit(2);
}

function findUcode() {
  if (process.env.UCODE_AGENT_DIR) return process.env.UCODE_AGENT_DIR;
  const bundled = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'engine', 'node_modules', 'ucode-agent');
  if (existsSync(path.join(bundled, 'package.json'))) return bundled;
  try {
    const root = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['root', '-g'], {
      encoding: 'utf8', shell: process.platform === 'win32', windowsHide: true, timeout: 20_000,
    }).trim();
    return path.join(root, 'ucode-agent');
  } catch {
    return null;
  }
}

const dir = findUcode();
const pkg = dir && existsSync(path.join(dir, 'package.json')) ? JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) : null;
if (!pkg || pkg.name !== 'ucode-agent') fail('ucode is missing from the app. Reinstall ucode desktop.');
const have = String(pkg.version).split('.').map(Number);
const older = OLDEST.findIndex((n, i) => (have[i] ?? 0) !== n);
if (older !== -1 && (have[older] ?? 0) < OLDEST[older]) fail(`ucode ${pkg.version} is too old. Update it: npm i -g ucode-agent`);
process.env.UCODE_AGENT_DIR = dir;

const { startApp, openWindow } = await import('./server.mjs');
const app = await startApp({ log: process.argv.includes('--debug') ? (err) => process.stderr.write(`${err?.stack ?? err}\n`) : () => {} });
process.stdout.write(`UCODE_APP_URL ${app.url}\n`);
if (process.argv.includes('--open')) openWindow(app.url);

const quit = async () => { await app.close().catch(() => {}); process.exit(0); };
process.on('SIGINT', quit);
process.on('SIGTERM', quit);
// The desktop app can close without stopping it (an update's installer closes it at once):
// the server follows it out within a few seconds, rather than staying on in the background.
const owner = Number(process.env.UCODE_DESKTOP_PID);
if (owner) setInterval(() => { try { process.kill(owner, 0); } catch { quit(); } }, 3000);
