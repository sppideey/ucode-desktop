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
 * Who runs the model: Google (ucode's own, the default), or a server ucode reaches
 * through its "another server" setting (UCODE_BASE_URL). Free ones list only their
 * free models; the paid ones (your own key, billed to your account) list every chat
 * model they have; Ollama lists what is on this computer.
 */
export const PROVIDERS = {
  google: {
    name: 'Google Gemini', env: 'GEMINI_API_KEY', shape: /^(?:AIza[\w-]{30,}|AQ\.[\w.-]{30,})$/, hint: 'AIza…',
    link: 'https://aistudio.google.com/apikey', default: DEFAULT_MODEL,
    note: 'Free key from Google, no card. The most reliable.',
    steps: ['Click “Get one free”. It opens Google AI Studio.', 'Sign in with your Google account.', 'Click “Create API key” and copy it (it starts with AIza).', 'Click Add here, paste it, and press Check & save.'],
  },
  openai: {
    name: 'OpenAI', url: 'https://api.openai.com/v1', env: 'OPENAI_API_KEY', shape: /^sk-[\w-]{20,}$/, hint: 'sk-…',
    link: 'https://platform.openai.com/api-keys', paid: true, prefer: /^gpt-\d+(?:\.\d+)?-mini$/,
    note: 'GPT models. Paid: billed to your OpenAI account.',
    steps: ['Click “Get one”. It opens platform.openai.com.', 'Sign in, and add credit under Billing (OpenAI charges per use).', 'Click “Create new secret key” and copy it (it starts with sk-).', 'Click Add here, paste it, and press Check & save.'],
  },
  anthropic: {
    name: 'Anthropic', url: 'https://api.anthropic.com/v1', env: 'ANTHROPIC_API_KEY', shape: /^sk-ant-[\w-]{20,}$/, hint: 'sk-ant-…',
    link: 'https://console.anthropic.com/settings/keys', paid: true, prefer: /sonnet/,
    note: 'Claude models. Paid: billed to your Anthropic account.',
    steps: ['Click “Get one”. It opens console.anthropic.com.', 'Sign in, and add credit under Billing (Anthropic charges per use).', 'Click “Create Key” and copy it (it starts with sk-ant-).', 'Click Add here, paste it, and press Check & save.'],
  },
  xai: {
    name: 'xAI', url: 'https://api.x.ai/v1', env: 'XAI_API_KEY', shape: /^xai-[\w-]{20,}$/, hint: 'xai-…',
    link: 'https://console.x.ai', paid: true, prefer: /^grok-code|^grok-\d+(?:\.\d+)?-fast/,
    note: 'Grok models. Paid: billed to your xAI account.',
    steps: ['Click “Get one”. It opens console.x.ai.', 'Sign in, and add credit (xAI charges per use).', 'Open API Keys, click “Create API Key” and copy it (it starts with xai-).', 'Click Add here, paste it, and press Check & save.'],
  },
  deepseek: {
    name: 'DeepSeek', url: 'https://api.deepseek.com/v1', env: 'DEEPSEEK_API_KEY', shape: /^sk-[\w-]{20,}$/, hint: 'sk-…',
    link: 'https://platform.deepseek.com/api_keys', paid: true, prefer: /^deepseek-chat$/,
    note: 'DeepSeek models. Paid, but very cheap: billed to your DeepSeek account.',
    steps: ['Click “Get one”. It opens platform.deepseek.com.', 'Sign in, and top up a little credit (DeepSeek charges per use).', 'Click “Create new API key” and copy it (it starts with sk-).', 'Click Add here, paste it, and press Check & save.'],
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
  ollama: {
    name: 'Ollama', url: 'http://127.0.0.1:11434/v1', local: true, link: 'https://ollama.com/download',
    note: 'Free models that run on this computer. Needs the Ollama app and a model (e.g. qwen3).',
    steps: ['Click “Get Ollama”, install it and open it.', 'In a terminal, run: ollama pull qwen3', 'Come back here and click “Check again”.'],
  },
};

/** Each tried with ucode (2026-10): a whole app on OpenRouter, a streamed tool call on NVIDIA. */
const TRIED = {
  'nvidia/nemotron-3-super-120b-a12b:free': 'NVIDIA, free — quick, built a whole app in 72s, sometimes fumbles a big write',
  'nvidia/nemotron-3-ultra-550b-a55b:free': 'NVIDIA’s biggest, free — good for questions, unsteady on whole apps',
  'google/gemma-4-31b-it:free': 'Google’s open model, free — very busy, often makes you wait',
  'nvidia/nemotron-3-super-120b-a12b': 'free — the quickest here, built a whole app in 94s',
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

const entry = (id, name, context = null, note = 'free — not tried with ucode yet') => ({ id, name, context, note: TRIED[id] ?? note });

/** Each provider's own list, made into ours: what to keep, and what it is called. */
const LISTS = {
  openrouter: (d) => d.data
    .filter((m) => /:free$/.test(m.id) && Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0 && (m.supported_parameters ?? []).includes('tools'))
    .map((m) => entry(m.id, String(m.name || m.id).replace(/^[^:]+:\s*/, '').replace(/\s*\(free\)\s*$/i, '').slice(0, 40), Number(m.context_length) || null)),
  nvidia: (d) => d.data.map((m) => String(m.id))
    .filter((id) => NVIDIA_AGENTIC.test(id) && !/embed|safety|reward|guard|vision|omni/.test(id) && !NVIDIA_NOT.has(id))
    .map((id) => entry(id, pretty(id))),
  // The chat models: not the audio, image, search or embedding ones, nor the dated copies of each.
  openai: (d) => d.data.map((m) => String(m.id))
    .filter((id) => /^(?:gpt-\d|o\d|chatgpt-)/.test(id) && !/audio|realtime|tts|transcribe|search|image|embed|moderation|instruct|-\d{4}-\d{2}-\d{2}$/.test(id))
    .map((id) => entry(id, pretty(id), null, 'paid')),
  anthropic: (d) => d.data.map((m) => entry(String(m.id), String(m.display_name || m.id), null, 'paid')),
  xai: (d) => d.data.map((m) => String(m.id)).filter((id) => /^grok/.test(id) && !/image|imagine|vision/.test(id)).map((id) => entry(id, pretty(id), null, 'paid')),
  deepseek: (d) => d.data.map((m) => entry(String(m.id), pretty(String(m.id)), null, 'paid — very cheap')),
  ollama: (d) => d.data.map((m) => entry(String(m.id), String(m.id), null, 'on this computer, free')),
};

// Each provider's models, as it last offered them. Until the lists arrive: the tried ones.
const offered = {
  openrouter: Object.keys(TRIED).filter((id) => id.endsWith(':free')).map((id) => entry(id, pretty(id))),
  nvidia: Object.keys(TRIED).filter((id) => !id.endsWith(':free')).map((id) => entry(id, pretty(id))),
  openai: [], anthropic: [], xai: [], deepseek: [], ollama: [],
};

let current = 'google';
let ollamaUp = false;
const userContext = process.env.UCODE_MAX_CONTEXT_TOKENS;

/** The provider in use. */
export const providerNow = () => current;

/** Whether a provider can be used: its key is saved (for Ollama: it is running here). */
export const hasKey = (id = current) => (PROVIDERS[id]?.local ? ollamaUp : Boolean((process.env[PROVIDERS[id]?.env] || '').trim()));

/** How a provider wants the key: Anthropic in its own header, the rest as a bearer token. */
const authFor = (id, key) => (id === 'anthropic' ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' } : { Authorization: `Bearer ${key}` });

/** The default first, then the ones tried with ucode, then by name. */
const order = (provider) => (a, b) => (b.id === PROVIDERS[provider].default) - (a.id === PROVIDERS[provider].default)
  || Object.hasOwn(TRIED, b.id) - Object.hasOwn(TRIED, a.id) || a.name.localeCompare(b.name);

/** A provider's models: Google's free ones, the free ones of OpenRouter and NVIDIA, every chat model of the paid ones. */
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

/** The model a provider starts on when none is chosen: its own pick, else the newest of the kind it is best at, else its first. */
export function defaultModel(id) {
  const list = modelList(id);
  const { default: fixed, prefer } = PROVIDERS[id];
  if (list.some((m) => m.id === fixed)) return fixed;
  const newest = [...list].sort((a, b) => b.id.localeCompare(a.id)).find((m) => prefer?.test(m.id));
  return newest?.id ?? list[0]?.id ?? null;
}

/** Switch model within the provider in use: only to one of its models. */
export function setModel(id) {
  const found = modelList().find((m) => m.id === id);
  if (!found) throw Object.assign(new Error(`That is not one of ${PROVIDERS[current].name}'s models here.`), { status: 400 });
  // A small model's window, so ucode folds the conversation before it overflows.
  if (current !== 'google' && found.context) process.env.UCODE_MAX_CONTEXT_TOKENS = String(found.context);
  else if (userContext) process.env.UCODE_MAX_CONTEXT_TOKENS = userContext;
  else delete process.env.UCODE_MAX_CONTEXT_TOKENS;
  return provider.setModel(id);
}

/** Use another provider, on `id` - else its default, else its first model. Nothing changes when it has none. */
export function switchProvider(name, id) {
  const info = PROVIDERS[name];
  if (!info) throw Object.assign(new Error('no such provider'), { status: 400 });
  const list = modelList(name);
  const pick = [id, defaultModel(name)].find((m) => m && list.some((x) => x.id === m));
  if (!pick) {
    const why = info.local ? 'Ollama is not running on this computer, or has no models yet.'
      : hasKey(name) ? `${info.name} has no models right now. Check the internet is on.` : `Add your ${info.name} key first.`;
    throw Object.assign(new Error(why), { status: 409 });
  }
  current = name;
  if (info.url) {
    process.env.UCODE_BASE_URL = info.url;
    process.env.UCODE_API_KEY = info.local ? 'ollama' : (process.env[info.env] || '').trim();
  } else {
    delete process.env.UCODE_BASE_URL;
    delete process.env.UCODE_API_KEY;
  }
  resetConnection();
  return setModel(pick);
}

/**
 * Every provider's models, from its own list, so new ones appear by themselves: the
 * free ones' public lists, the paid ones' with your key, Ollama's from this computer.
 * Google's own: while it is in use.
 */
export async function refreshModels() {
  await Promise.all(Object.entries(LISTS).map(async ([id, make]) => {
    const info = PROVIDERS[id];
    const key = info.env ? (process.env[info.env] || '').trim() : '';
    if (info.paid && !key) { offered[id] = []; return; }
    try {
      const res = await fetch(`${info.url}/models${id === 'anthropic' ? '?limit=100' : ''}`, {
        headers: info.paid ? authFor(id, key) : {},
        signal: AbortSignal.timeout(info.local ? 1500 : 8000),
      });
      const list = res.ok ? make(await res.json()) : null;
      if (info.local) ollamaUp = res.ok;
      if (list?.length || info.local || info.paid) offered[id] = list ?? [];
    } catch {
      if (info.local) { ollamaUp = false; offered[id] = []; }
    }
  }));
  if (current === 'google') await provider.discoverModels().catch(() => []);
}

/** Is this a key that works? Asked of the service itself. NVIDIA's list is public, so it gets one tiny request. */
export async function checkKey(name, value) {
  const owner = Object.keys(PROVIDERS).find((p) => PROVIDERS[p].env === name);
  const ask = (url, init = {}) => fetch(url, { ...init, headers: { ...(init.headers ?? { Authorization: `Bearer ${value}` }) }, signal: AbortSignal.timeout(20_000) })
    .then((r) => { r.body?.cancel().catch(() => {}); return r.status; });
  const said = (status, who) => (status === 200 ? null : [400, 401, 403].includes(status) ? `${who} did not accept this key.` : `${who} did not answer properly (${status}). Try again in a minute.`);
  try {
    if (name === 'GEMINI_API_KEY') return said(await ask(`${BASE_URL}/models`), 'Google');
    if (name === 'VERCEL_TOKEN') return said(await ask('https://api.vercel.com/v2/user'), 'Vercel');
    if (name === 'OPENROUTER_API_KEY') return said(await ask(`${PROVIDERS.openrouter.url}/key`), 'OpenRouter');
    if (name === 'NVIDIA_API_KEY') {
      const status = await ask(`${PROVIDERS.nvidia.url}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${value}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: PROVIDERS.nvidia.default, max_tokens: 1, messages: [{ role: 'user', content: 'Hi' }] }),
      });
      return status === 429 ? null : said(status, 'NVIDIA'); // 429: the key works, NVIDIA is just busy
    }
    if (owner && PROVIDERS[owner].paid) return said(await ask(`${PROVIDERS[owner].url}/models`, { headers: authFor(owner, value) }), PROVIDERS[owner].name);
  } catch {
    return 'Could not reach the service to check the key — is the internet on?';
  }
  return null;
}

/**
 * ucode asks every provider the same way; a few want it put a little differently. Only a
 * request for an answer from the provider in use is touched:
 *  - ucode's quick side jobs (folding a long chat, a commit message) name Google's model:
 *    off Google they go to the model in use instead;
 *  - OpenAI's newer models take max_completion_tokens, and only their own temperature;
 *  - Anthropic needs max_tokens.
 */
export function fitRequest(input, init) {
  try {
    const info = PROVIDERS[current];
    const url = String(input?.url ?? input);
    if (!info?.url || String(init?.method).toUpperCase() !== 'POST' || !url.startsWith(`${info.url}/chat/completions`) || typeof init.body !== 'string') return init;
    const body = JSON.parse(init.body);
    if (provider.MODELS[body.model]) body.model = model();
    if (current === 'openai') {
      if (body.max_tokens) { body.max_completion_tokens = body.max_tokens; delete body.max_tokens; }
      if (/^(?:o\d|gpt-[5-9])/.test(body.model)) delete body.temperature;
    }
    if (current === 'anthropic' && !body.max_tokens) body.max_tokens = 16_000;
    return { ...init, body: JSON.stringify(body) };
  } catch {
    return init;
  }
}
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => realFetch(input, fitRequest(input, init));

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
