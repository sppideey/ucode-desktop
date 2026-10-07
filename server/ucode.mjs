// SPDX-License-Identifier: AGPL-3.0-only - ucode desktop, made and tested by om dixit. Additional terms: see NOTICE.
/**
 * ucode.mjs — the installed ucode, and what the desktop app adds on top of it.
 *
 * The app does not change ucode. It loads the copy installed on this computer
 * (`npm i -g ucode-agent`; main.mjs finds it and sets UCODE_AGENT_DIR) and adds,
 * in this process only:
 *   - a choice of provider: Google, or OpenRouter's or NVIDIA's free models
 *     (through ucode's own "another server" setting, UCODE_BASE_URL);
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
export const { statsLines } = loop;
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

/**
 * Who runs the model: Google (ucode's own), or a server ucode reaches through its
 * "another server" setting (UCODE_BASE_URL). Only ones that are free with no card.
 * Left out (2026-10): Groq (its free limit, 8K tokens a minute, is less than one
 * ucode request), Mistral (it refuses stream_options, which ucode sends), Cerebras
 * (now wants a card) and GitHub Models (closed).
 */
export const PROVIDERS = {
  google: {
    name: 'Google Gemini', env: 'GEMINI_API_KEY', shape: /^(?:AIza[\w-]{30,}|AQ\.[\w.-]{30,})$/, hint: 'AIza…',
    link: 'https://aistudio.google.com/apikey', default: DEFAULT_MODEL,
    note: 'Free key from Google, no card. The most reliable.',
    steps: ['Click “Get one free”. It opens Google AI Studio.', 'Sign in with your Google account.', 'Click “Create API key” and copy it (it starts with AIza).', 'Click Add here, paste it, and press Check & save.'],
  },
  openrouter: {
    name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', env: 'OPENROUTER_API_KEY', shape: /^sk-or-[\w-]{20,}$/, hint: 'sk-or-…',
    link: 'https://openrouter.ai/keys', default: 'nvidia/nemotron-3-super-120b-a12b:free',
    note: 'Every free model on OpenRouter. About 50 free requests a day.',
    steps: ['Click “Get one free”. It opens openrouter.ai.', 'Sign up free (Google or GitHub is quickest).', 'Click “Create API Key”, name it ucode, and copy it (it starts with sk-or-).', 'Click Add here, paste it, and press Check & save.'],
  },
  nvidia: {
    name: 'NVIDIA', url: 'https://integrate.api.nvidia.com/v1', env: 'NVIDIA_API_KEY', shape: /^nvapi-[\w-]{20,}$/, hint: 'nvapi-…',
    link: 'https://build.nvidia.com/settings/api-keys', default: 'nvidia/nemotron-3-super-120b-a12b',
    note: 'NVIDIA’s own free models, very quick. No card.',
    steps: ['Click “Get one free”. It opens build.nvidia.com.', 'Sign up free (no card).', 'Click “Generate API Key” and copy it (it starts with nvapi-).', 'Click Add here, paste it, and press Check & save.'],
  },
};

/** Each tried with ucode (2026-10): a whole app on OpenRouter, a streamed tool call on NVIDIA. */
const TRIED = {
  'nvidia/nemotron-3-super-120b-a12b:free': 'NVIDIA, free — quick, built a whole app in 72s, sometimes fumbles a big write',
  'nvidia/nemotron-3-ultra-550b-a55b:free': 'NVIDIA’s biggest, free — good for questions, unsteady on whole apps',
  'google/gemma-4-31b-it:free': 'Google’s open model, free — very busy, often makes you wait',
  'nvidia/nemotron-3-super-120b-a12b': 'free — the quickest here, answers in about a second',
  'nvidia/nemotron-3-ultra-550b-a55b': 'NVIDIA’s biggest, free — slower, more careful',
  'nvidia/nemotron-3.5-lightning-30b-a3b': 'free — small and quick',
  'openai/gpt-oss-20b': 'OpenAI’s open model, free — quick, smaller',
};

/**
 * NVIDIA lists every model it hosts; these kinds can use tools. Not offered: ones a
 * free account cannot use (they answer 404) and ones that never answered (2026-10-07).
 */
const NVIDIA_AGENTIC = /^(?:nvidia\/nemotron-\d+(?:\.\d+)?-(?:super|ultra|lightning)-|moonshotai\/kimi|z-ai\/glm|deepseek-ai\/deepseek-v\d|openai\/gpt-oss|qwen\/qwen3|meta\/llama-4|minimaxai\/minimax)/;
const NVIDIA_NOT = new Set([
  'moonshotai/kimi-k2.6', 'moonshotai/kimi-k3', 'z-ai/glm-5.3', 'z-ai/glm-5.3-flash', 'deepseek-ai/deepseek-v4.1-flash',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
]);

/** "nvidia/nemotron-3-super-120b-a12b" → "Nemotron 3 Super 120B A12B". */
const pretty = (id) => id.split('/').pop().replace(/:free$/, '').split('-')
  .filter((w) => w && w !== 'it' && w !== 'instruct')
  .map((w) => (/^(?:\d|[a-z]\d)|^(?:gpt|oss|glm|xs)$/.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
  .join(' ');

const entry = (id, name, context = null) => ({ id, name, context, note: TRIED[id] ?? 'free — not tried with ucode yet' });

// Each provider's models, as it last offered them. Until the lists arrive: the tried ones.
const offered = {
  openrouter: Object.keys(TRIED).filter((id) => id.endsWith(':free')).map((id) => entry(id, pretty(id))),
  nvidia: Object.keys(TRIED).filter((id) => !id.endsWith(':free')).map((id) => entry(id, pretty(id))),
};

let current = 'google';
const userContext = process.env.UCODE_MAX_CONTEXT_TOKENS;

/** The provider in use. */
export const providerNow = () => current;

/** Whether a provider's key is saved. */
export const hasKey = (id = current) => Boolean((process.env[PROVIDERS[id]?.env] || '').trim());

/** The default first, then the ones tried with ucode, then by name. */
const order = (provider) => (a, b) => (b.id === PROVIDERS[provider].default) - (a.id === PROVIDERS[provider].default)
  || Object.hasOwn(TRIED, b.id) - Object.hasOwn(TRIED, a.id) || a.name.localeCompare(b.name);

/** A provider's models, every one free: Google's without the paid ones, the others as they list them. */
export function modelList(id = current) {
  const ready = hasKey(id);
  if (id === 'google') {
    const now = Date.now();
    return provider.modelList()
      .filter((m) => !m.paid)
      .map(({ id: m, name, note, context: ctx, star, spentUntil }) => ({ id: m, name, note, context: ctx, star: Boolean(star), ready, spentUntil: spentUntil > now ? spentUntil : null }));
  }
  return [...offered[id]].sort(order(id)).map((m) => ({ ...m, star: m.id === PROVIDERS[id].default, ready, spentUntil: null }));
}

/** Switch model within the provider in use: only to one of its free models. */
export function setModel(id) {
  const found = modelList().find((m) => m.id === id);
  if (!found) throw Object.assign(new Error(`That is not one of ${PROVIDERS[current].name}'s free models.`), { status: 400 });
  // A small model's window, so ucode folds the conversation before it overflows.
  if (current !== 'google' && found.context) process.env.UCODE_MAX_CONTEXT_TOKENS = String(found.context);
  else if (userContext) process.env.UCODE_MAX_CONTEXT_TOKENS = userContext;
  else delete process.env.UCODE_MAX_CONTEXT_TOKENS;
  return provider.setModel(id);
}

/** Use another provider, on `id` - else its default, else its first model. Nothing changes when it has none. */
export function useProvider(name, id) {
  const info = PROVIDERS[name];
  if (!info) throw Object.assign(new Error('no such provider'), { status: 400 });
  const list = modelList(name);
  const pick = [id, info.default, list[0]?.id].find((m) => m && list.some((x) => x.id === m));
  if (!pick) throw Object.assign(new Error(`${info.name} has no free models right now. Check the internet is on.`), { status: 503 });
  current = name;
  if (info.url) {
    process.env.UCODE_BASE_URL = info.url;
    process.env.UCODE_API_KEY = (process.env[info.env] || '').trim();
  } else {
    delete process.env.UCODE_BASE_URL;
    delete process.env.UCODE_API_KEY;
  }
  resetConnection();
  return setModel(pick);
}

/** Each provider's models from its own public list, so new free ones appear by themselves. Google's: while it is in use. */
export async function refreshModels() {
  const read = (url) => fetch(url, { signal: AbortSignal.timeout(8000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [or, nv] = await Promise.all([read(`${PROVIDERS.openrouter.url}/models`), read(`${PROVIDERS.nvidia.url}/models`)]);
  const free = (m) => /:free$/.test(m.id) && Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0
    && (m.supported_parameters ?? []).includes('tools');
  if (or?.data?.length) {
    offered.openrouter = or.data.filter(free).map((m) => entry(
      m.id, String(m.name || m.id).replace(/^[^:]+:\s*/, '').replace(/\s*\(free\)\s*$/i, '').slice(0, 40), Number(m.context_length) || null,
    ));
  }
  if (nv?.data?.length) {
    offered.nvidia = nv.data.map((m) => String(m.id)).filter((id) => NVIDIA_AGENTIC.test(id) && !/embed|safety|reward|guard|vision|omni/.test(id) && !NVIDIA_NOT.has(id)).map((id) => entry(id, pretty(id)));
  }
  if (current === 'google') await provider.discoverModels().catch(() => []);
}

/** Is this a key that works? Asked of the service itself. NVIDIA's list is public, so it gets one tiny request. */
export async function checkKey(name, value) {
  const ask = (url, init = {}) => fetch(url, { ...init, headers: { Authorization: `Bearer ${value}`, ...init.headers }, signal: AbortSignal.timeout(20_000) })
    .then((r) => { r.body?.cancel().catch(() => {}); return r.status; });
  try {
    if (name === 'GEMINI_API_KEY') return (await ask(`${BASE_URL}/models`)) === 200 ? null : 'Google did not accept this key.';
    if (name === 'OPENROUTER_API_KEY') return (await ask(`${PROVIDERS.openrouter.url}/key`)) === 200 ? null : 'OpenRouter did not accept this key.';
    if (name === 'VERCEL_TOKEN') return (await ask('https://api.vercel.com/v2/user')) === 200 ? null : 'Vercel did not accept this token.';
    if (name === 'NVIDIA_API_KEY') {
      const status = await ask(`${PROVIDERS.nvidia.url}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: PROVIDERS.nvidia.default, max_tokens: 1, messages: [{ role: 'user', content: 'Hi' }] }),
      });
      if (status === 200 || status === 429) return null; // 429: the key works, NVIDIA is just busy
      return status === 401 || status === 403 ? 'NVIDIA did not accept this key.' : `NVIDIA did not answer properly (${status}). Try again in a minute.`;
    }
  } catch {
    return 'Could not reach the service to check the key — is the internet on?';
  }
  return null;
}

/** What the mic heard. Off Google a Gemini model listens, so the mic needs a Google key there. */
export async function transcribe(wav) {
  if (current === 'google') return provider.transcribe(wav);
  if (!providerKey()) throw new Error('The mic needs a free Google key — add one in Settings → Models.');
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
  // The provider in use reads its key from UCODE_API_KEY: a new one counts at once.
  if (PROVIDERS[current].url && PROVIDERS[current].env === name) process.env.UCODE_API_KEY = value ?? '';
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
