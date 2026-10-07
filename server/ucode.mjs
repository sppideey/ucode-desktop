// SPDX-License-Identifier: AGPL-3.0-only - ucode desktop, made and tested by om dixit. Additional terms: see NOTICE.
/**
 * ucode.mjs — the installed ucode, and what the desktop app adds on top of it.
 *
 * The app does not change ucode. It loads the copy installed on this computer
 * (`npm i -g ucode-agent`; main.mjs finds it and sets UCODE_AGENT_DIR) and adds,
 * in this process only:
 *   - a choice of provider: Google, or OpenRouter's free models (through
 *     ucode's own "another server" setting, UCODE_BASE_URL);
 *   - no paid models in the lists;
 *   - keys saved from the app's Settings;
 *   - streaming and the preview panel for each chat's agent.
 */

import path from 'node:path';
import { promises as fs, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const dir = process.env.UCODE_AGENT_DIR;
if (!dir) throw new Error('UCODE_AGENT_DIR is not set - start the app with server/main.mjs');
const load = (p) => import(pathToFileURL(path.join(dir, p)).href);

const [loop, provider, history, attach, opener, voice, context, version, theme, shell, browser, tools, skills, mcp] = await Promise.all([
  load('src/core/loop.js'), load('src/core/provider.js'), load('src/core/history.js'), load('src/core/attach.js'),
  load('src/core/opener.js'), load('src/core/voice.js'), load('src/core/context.js'), load('src/core/version.js'),
  load('src/ui/theme.js'), load('src/tools/shell.js'), load('src/tools/browser.js'), load('src/tools/index.js'),
  load('src/core/skills.js'), load('src/core/mcp.js'),
]);

export const { loadSkills } = skills;
export const { readServers, USER_MCP, projectMcpFile } = mcp;

export const { load: loadSession, save: saveSession, remove: removeSession } = history;
export const clearSessions = async () => { await history.removeAll(); listed = null; };
export const { projectFiles } = attach;
export const { insideRoot, openInBrowser } = opener;
export const { isSilent, cleanTranscript } = voice;
export const { MEMORY_FILE } = context;
export const UCODE_VERSION = version.VERSION;
export const { CREDIT, bare, asLabel, asNarrationLine, tidyReply, trimAnswer } = theme;
export const { stopServers, serversReadySince } = shell;
export const { closeBrowser } = browser;
export const { model, resetConnection, providerKey, DEFAULT_MODEL, BASE_URL, ENV_FILE } = provider;

// -- providers -----------------------------------------------------------------

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1';
export const OPENROUTER_DEFAULT = 'nvidia/nemotron-3-super-120b-a12b:free';

/** OpenRouter's free models, each tried with a whole-app build (2026-10-06). */
const OPENROUTER_MODELS = {
  'nvidia/nemotron-3-super-120b-a12b:free': {
    name: 'Nemotron 3 Super', context: 262_144, star: true,
    note: 'NVIDIA, free — quick, built a whole app in 72s, sometimes fumbles a big write',
  },
  'nvidia/nemotron-3-ultra-550b-a55b:free': {
    name: 'Nemotron 3 Ultra', context: 1_000_000,
    note: 'NVIDIA\'s biggest, free — good for questions, unsteady on whole apps',
  },
  'google/gemma-4-31b-it:free': {
    name: 'Gemma 4 31B', context: 262_144,
    note: 'Google\'s open model, free on OpenRouter — very busy, often makes you wait',
  },
};

export const openRouterKey = () => (process.env.OPENROUTER_API_KEY || '').trim();
const onOpenRouter = () => /openrouter\.ai/i.test(process.env.UCODE_BASE_URL || '');

/** Who answers for a model id. */
export const serviceFor = (id = model()) => (OPENROUTER_MODELS[id] || String(id).includes('/') ? 'openrouter' : 'google');

/** Whether the key that model needs is saved. */
export const hasKeyFor = (id = model()) => (serviceFor(id) === 'openrouter' ? Boolean(openRouterKey()) : Boolean(providerKey()));

/** Switch model, and with it the server ucode talks to. */
export function setModel(id) {
  if (serviceFor(id) === 'openrouter') {
    process.env.UCODE_BASE_URL = OPENROUTER_URL;
    process.env.UCODE_API_KEY = openRouterKey();
  } else if (onOpenRouter()) {
    delete process.env.UCODE_BASE_URL;
    delete process.env.UCODE_API_KEY;
  }
  resetConnection();
  return provider.setModel(id);
}

/** Every model the app offers: Google's free ones (never a paid one) and OpenRouter's. */
export function modelList() {
  const now = Date.now();
  const google = provider.modelList()
    .filter((m) => !m.paid)
    .map(({ id, name, note, context: ctx, star, spentUntil }) => ({ id, name, note, context: ctx, star: Boolean(star), via: 'google', ready: Boolean(providerKey()), spentUntil: spentUntil > now ? spentUntil : null }));
  const openrouter = Object.entries(OPENROUTER_MODELS)
    .map(([id, m]) => ({ id, name: m.name, note: m.note, context: m.context, star: Boolean(m.star), via: 'openrouter', ready: Boolean(openRouterKey()), spentUntil: null }));
  return [...google, ...openrouter];
}

let qwenChecked = false;

/** New free Google models (ucode's own check), and a free Qwen on OpenRouter the day there is one. */
export async function discoverModels(opts = {}) {
  const found = onOpenRouter() ? [] : await provider.discoverModels(opts).catch(() => []);
  if (!qwenChecked || opts.again) {
    qwenChecked = true;
    try {
      const res = await fetch(`${OPENROUTER_URL}/models`, { signal: AbortSignal.timeout(6000) });
      for (const m of res.ok ? (await res.json()).data ?? [] : []) {
        const id = String(m.id ?? '');
        if (OPENROUTER_MODELS[id] || !/^qwen\/[\w.-]+:free$/.test(id)) continue;
        if (Number(m.pricing?.prompt) !== 0 || Number(m.pricing?.completion) !== 0) continue;
        if (!(m.supported_parameters ?? []).includes('tools')) continue;
        OPENROUTER_MODELS[id] = {
          name: String(m.name || id).replace(/^[^:]+:\s*/, '').replace(/\s*\(free\)\s*$/i, '').slice(0, 40),
          context: Number(m.context_length) || 128_000,
          note: 'new on OpenRouter, free — not yet tried with ucode',
        };
        found.push(id);
      }
    } catch { /* offline: the list stays as it is */ }
  }
  return found;
}

/** What the mic heard. On OpenRouter a Gemini model listens, so the mic needs a Google key there. */
export async function transcribe(wav) {
  if (!onOpenRouter()) return provider.transcribe(wav);
  if (!providerKey()) throw new Error('The mic needs a free Google key — add one in Settings → Keys.');
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${providerKey()}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe the speech in this recording word for word, in the language spoken. Reply with only the words spoken - no quotes, no notes. If nothing is said, reply with nothing.' },
          { type: 'input_audio', input_audio: { data: wav.toString('base64'), format: 'wav' } },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`Google could not listen just now (HTTP ${res.status}).`);
  return (await res.json()).choices?.[0]?.message?.content ?? '';
}

// -- keys ------------------------------------------------------------------------

/** Which variable a pasted key belongs in, by its shape. */
export function keyName(key) {
  const k = String(key ?? '').trim();
  if (/^(?:AIza[\w-]{30,}|AQ\.[\w.-]{30,})$/.test(k)) return 'GEMINI_API_KEY';
  if (/^sk-or-[\w-]{20,}$/.test(k)) return 'OPENROUTER_API_KEY';
  return null;
}

/** Write one NAME=value line to ~/.ucode/.env (null removes it), keeping the rest, owner-only. */
export async function saveEnv(name, value) {
  if (value !== null && /[\r\n]/.test(String(value))) throw new Error('A key is one line.');
  const existing = await fs.readFile(ENV_FILE, 'utf8').catch(() => '');
  const out = [];
  let done = false;
  for (const line of existing.split(/\r?\n/)) {
    if (new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`).test(line)) {
      if (!done && value !== null) out.push(`${name}=${value}`);
      done = true;
    } else out.push(line);
  }
  if (!done && value !== null) {
    while (out.length && out[out.length - 1].trim() === '') out.pop();
    out.push(`${name}=${value}`, '');
  }
  await fs.mkdir(path.dirname(ENV_FILE), { recursive: true });
  await fs.writeFile(ENV_FILE, out.join('\n'), { encoding: 'utf8', mode: 0o600 });
  await fs.chmod(ENV_FILE, 0o600).catch(() => {});
  if (value === null) delete process.env[name];
  else process.env[name] = value;
  if (name === 'OPENROUTER_API_KEY' && onOpenRouter()) process.env.UCODE_API_KEY = value ?? '';
}

// -- chats ---------------------------------------------------------------------------

let listed = null;

/** Saved chats, read again only when the sessions folder has changed. */
export async function listSessions() {
  let stamp = 0;
  try { stamp = statSync(history.sessionsDir()).mtimeMs; } catch { /* no chats yet */ }
  if (listed && listed.stamp === stamp) return listed.list;
  const list = await history.list();
  listed = { stamp, list };
  return list;
}

/** One file's change since a snapshot, as a unified diff. */
export async function diffSince(snaps, id, file) {
  const now = await snaps.take('now');
  if (!now) return '';
  const diff = await snaps.git(['diff', '--no-renames', '--no-color', id, now, '--', file]);
  return diff.code === 0 ? diff.out : '';
}

/** Things ucode says to the model in the user's name: not shown as the user's words. */
export const INTERNAL = /^(?:I stopped that\.|Your last tool call was rejected|Your reply stopped at the output limit|ucode checked the files you changed|Your plan still has|You changed .{0,400} and did not check|You stopped without saying anything|ucode opened the app and found errors|I opened the app and looked at it|I looked at https?:)/;

/**
 * ucode's agent, for one chat in the window: it streams its reply (ucode does
 * that only for a "full" screen), shows what it opens in the preview panel,
 * and can be made the one the tools work for when the window moves between chats.
 */
export class Agent extends loop.Agent {
  constructor(opts) {
    super(opts);
    this.full = true;
  }

  openInBrowser(target) {
    return this.ui.showPreview(target);
  }

  /** A server that came up during the turn goes to the preview panel - without ucode's "opened in your browser". */
  openWhenReady(since) {
    const server = shell.serversReadySince(since).at(-1);
    if (!server || (this.opened ??= new Set()).has(server.url)) return;
    this.opened.add(server.url);
    this.openInBrowser(server.url);
  }

  async activate() {
    tools.setRoot(this.cwd);
    let asking = Promise.resolve();
    tools.setConfirm((request) => {
      const next = asking.then(() => this.ui.confirm(request));
      asking = next.catch(() => {});
      return next;
    });
    if (this.settings) await this.loadSettings();
  }
}
