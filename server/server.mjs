// SPDX-License-Identifier: AGPL-3.0-only - ucode desktop, made and tested by om dixit. Additional terms: see NOTICE.
/**
 * server.js — ucode desktop: ucode in a window instead of a terminal.
 *
 * A small web server on this computer only (127.0.0.1) serves the app's page
 * and runs ucode for it: one agent per chat, its steps and replies sent to the
 * window as they happen (server-sent events), its questions answered from it.
 * The desktop app is a window pointed at this server (main.mjs starts it on top
 * of the installed ucode, which it does not change).
 *
 * It can run commands on this computer, so nothing but the window may use it:
 *   - it listens on 127.0.0.1 only, on a port chosen at random;
 *   - the first visit carries a random token, swapped for a cookie no other
 *     site is sent (SameSite=Strict), and every request needs it;
 *   - the Host must be this server, so a website cannot rebind its own name
 *     to 127.0.0.1 and talk to it (DNS rebinding);
 *   - anything that changes something is a POST, and a POST must come from
 *     this server's own page (Origin), so another tab cannot send one.
 * The apps ucode builds are shown from a second port - another origin - so
 * their scripts cannot reach any of this either.
 */

import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { promises as fs, existsSync, statSync, readFileSync } from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Agent, model, setModel, modelList, refreshModels, PROVIDERS, providerNow, switchProvider, hasKey, checkKey, resetConnection,
  statsLines, bare, transcribe, listSessions, loadSession, saveSession,
  removeSession, clearSessions, saveEnv, projectFiles, insideRoot, openInBrowser, isSilent, cleanTranscript, MEMORY_FILE,
  UCODE_VERSION, CREDIT, stopServers, closeBrowser, diffSince, INTERNAL, loadSkills, readServers, USER_MCP, projectMcpFile,
} from './ucode.mjs';
import { WebUI } from './webui.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const UI_DIR = process.env.UI_DIR || path.join(HERE, '..', 'out');
const VERSION = JSON.parse(readFileSync(path.join(HERE, '..', 'package.json'), 'utf8')).version;
const KEYS_HOME = path.join(os.homedir(), '.ucode'); // the keys live here: never shown to the window
const APP_FILE = path.join(KEYS_HOME, 'app.json');
const UPLOADS = path.join(KEYS_HOME, 'uploads');
const MAX_BODY = 12 * 1024 * 1024;
const MAX_WINDOWS = 8; // event streams at once; each holds a socket open

/** Where chats that are not in a project keep their files. */
export function defaultFolder() {
  const docs = path.join(os.homedir(), 'Documents');
  return path.join(existsSync(docs) ? docs : os.homedir(), 'ucode');
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
};

const same = (a, b) => {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && timingSafeEqual(x, y);
};

const cookieOf = (req, name) =>
  String(req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')).find(([k]) => k === name)?.[1];

/** A message asking for the app to go online: "deploy it", "and put it online", "publish it", "give me a link". */
const DEPLOY = /\b(?:deploy|publish|put (?:it |this |them )?(?:up )?online|share (?:it |this )?online|host (?:it|this)|make (?:it|this) live|go live|(?:give|get) me a (?:live )?link)\b/i;

/** A file under `root`, or null when the path would leave it. */
function within(root, rel) {
  const abs = path.resolve(root, `.${path.sep}${String(rel ?? '').replace(/^[/\\]+/, '')}`);
  return abs === path.resolve(root) || insideRoot(abs, root) ? abs : null;
}

const fail = (status, message) => Object.assign(new Error(message), { status });

/** \\host\share or //host/share. Even checking one exists has Windows sign in to that host - handing it a password hash. */
const isUnc = (p) => /^[\\/]{2}/.test(String(p ?? ''));

/** `p` is `root` or inside it (path.relative compares case-insensitively on Windows). */
const under = (p, root) => {
  const rel = path.relative(root, p);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
};

/** ~/.ucode, where the keys are; only its uploads folder is the window's. */
const secret = (p) => under(p, KEYS_HOME) && !under(p, UPLOADS);

/** A chat id as sessions are named (mfx8k2a1-1a2b3c4d); anything else could name another file. */
const chatId = (id) => {
  if (!/^[\w-]+$/.test(String(id ?? ''))) throw fail(400, 'not a chat id');
  return String(id);
};

/** A promise given `ms` to settle, so one stuck call cannot hold up closing. */
const soon = (promise, ms = 1500) =>
  Promise.race([Promise.resolve(promise).catch(() => {}), new Promise((resolve) => setTimeout(resolve, ms).unref())]);

async function sendFile(res, file, { cache = false } = {}) {
  let target = file;
  try {
    if ((await fs.stat(target)).isDirectory()) target = path.join(target, 'index.html');
    const body = await fs.readFile(target);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': cache ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readBody(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); return; }
      parts.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}

/** A folder chosen with the computer's own dialog; null when cancelled. */
function chooseFolder(platform = process.platform) {
  const [cmd, args] = platform === 'win32'
    ? ['powershell.exe', ['-NoProfile', '-STA', '-Command',
      'Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; ' +
      '$d.Description = "Choose a folder for ucode"; $d.ShowNewFolderButton = $true; ' +
      '$f = New-Object System.Windows.Forms.Form; $f.TopMost = $true; ' +
      'if ($d.ShowDialog($f) -eq "OK") { [Console]::Out.Write($d.SelectedPath) }']]
    : platform === 'darwin'
      ? ['osascript', ['-e', 'POSIX path of (choose folder with prompt "Choose a folder for ucode")']]
      : ['zenity', ['--file-selection', '--directory', '--title=Choose a folder for ucode']];
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 10 * 60_000, windowsHide: false }, (err, stdout) => {
      const picked = String(stdout ?? '').trim();
      resolve(picked ? picked.replace(/[/\\]$/, '') || picked : null);
    });
  });
}

/** What a saved conversation looks like in the window: what was said, not the working. */
export function transcript(messages = []) {
  const items = [];
  let steps = 0;
  for (const m of messages) {
    if (m.role === 'user' && m.said !== undefined) {
      if (steps) items.push({ role: 'steps', count: steps });
      steps = 0;
      items.push({ role: 'user', text: m.said });
    } else if (m.role === 'user' && !messages.some((x) => x.said !== undefined) && m.content?.trim() && !m.skill && !INTERNAL.test(m.content)) {
      // Saved before the app existed: the request is the first paragraph.
      items.push({ role: 'user', text: String(m.content).split('\n\n')[0] });
    } else if (m.role === 'assistant') {
      steps += m.toolCalls?.length ?? 0;
      if (m.content?.trim() && !m.toolCalls?.length) {
        if (steps) items.push({ role: 'steps', count: steps });
        steps = 0;
        items.push({ role: 'ucode', text: m.content });
      }
    }
  }
  if (steps) items.push({ role: 'steps', count: steps });
  return items;
}


export async function startApp({ port = 0, uiDir = UI_DIR, log = () => {} } = {}) {
  const token = randomBytes(24).toString('hex');
  const shown = randomBytes(12).toString('hex'); // the preview server's path prefix
  const clients = new Set();
  const chats = new Map(); // chat id -> { id, agent, ui, events, folder }
  const previews = new Map(); // id -> folder served on the preview port
  let running = null; // the chat whose turn is in flight: the tools serve one folder at a time
  let active = null;
  let mode = 'build';

  // The token is the key to this server: it never goes into a log.
  const scrub = (text) => String(text).split(token).join('…');
  const say = (err) => log(scrub(err?.stack ?? err));

  // One bad request or a stray rejection must not close the window on the user: say it and carry on.
  // Set up once the server is listening, and taken down by close().
  const keepAlive = (err) => process.stderr.write(`ucode desktop carried on after an error: ${scrub(err?.stack ?? err)}\n`);

  const readApp = async () => {
    try { return JSON.parse(await fs.readFile(APP_FILE, 'utf8')); } catch { return { projects: [] }; }
  };
  const writeApp = async (data) => {
    await fs.mkdir(path.dirname(APP_FILE), { recursive: true });
    await fs.writeFile(APP_FILE, JSON.stringify(data, null, 2));
  };

  /** Every chat's agent on the model in use. */
  const everyAgent = () => {
    for (const entry of chats.values()) { entry.agent.preferred = model(); entry.agent.session.model = model(); }
  };
  /** The provider chosen in Settings, on the default model chosen for it there. */
  const switchTo = (name, id) => { switchProvider(name, id); everyAgent(); };
  const saved = await readApp();
  if (!process.env.UCODE_MODEL) {
    try { switchTo(PROVIDERS[saved.provider] ? saved.provider : 'google', saved.defaults?.[saved.provider]); } catch { /* an old file */ }
  }
  // Each provider's free models are looked for in the background - now and every hour: the window never
  // waits on the network. A default only on the full list goes on once the list is in, unless you picked another.
  refreshModels().then(() => {
    const wanted = saved.defaults?.[providerNow()];
    if (wanted && !running && model() === PROVIDERS[providerNow()].default && modelList().some((m) => m.id === wanted)) switchTo(providerNow(), wanted);
  }).catch(() => {});
  setInterval(() => refreshModels().catch(() => {}), 60 * 60_000).unref();
  // The chat list is read once now; after that only changed files are read again.
  const warming = listSessions().catch(() => []);

  const broadcast = (event) => {
    const line = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of clients) {
      // A window closed mid-write is dropped, not written to.
      if (res.writableEnded || res.destroyed) { clients.delete(res); continue; }
      try { res.write(line); } catch { clients.delete(res); }
    }
  };

  /**
   * The folder `target` is in, of those the window may look in: ucode's own,
   * the projects, the chats' (open or saved) and the uploads. Null for any
   * other - for another machine's (UNC) and for ~/.ucode always.
   */
  const rootFor = async (target) => {
    if (!target || isUnc(target)) return null;
    const abs = path.resolve(String(target));
    if (isUnc(abs) || secret(abs)) return null;
    const sessions = await listSessions().catch(() => []);
    const roots = [defaultFolder(), UPLOADS, ...(await readApp()).projects, ...[...chats.values()].map((c) => c.folder), ...sessions.map((s) => s.cwd)];
    // Too wide to be a project: the home folder (or above it), or a whole drive, would open up .ssh, AppData and the rest.
    const broad = (r) => under(os.homedir(), r) || r === path.parse(r).root;
    return roots.filter((r) => r && !isUnc(r)).map((r) => path.resolve(r)).filter((r) => !broad(r)).find((r) => under(abs, r)) ?? null;
  };
  const allowedFolder = async (folder) => {
    if (!(await rootFor(folder))) throw fail(403, 'ucode only looks in your projects and chats');
    return path.resolve(String(folder));
  };

  /** Any failure a handler did not plan for - a lone % in the address - is a 400, never a crash. */
  const guard = (handler) => (req, res) => handler(req, res).catch((err) => {
    say(err);
    if (res.headersSent) { res.destroy(); return; }
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('bad request');
  });

  // -- the preview server: another port, so another origin -------------------

  const previewServer = http.createServer(guard(async (req, res) => {
    const [, prefix, id, ...rest] = decodeURIComponent(new URL(req.url, 'http://x').pathname).split('/');
    const folder = previews.get(id);
    const file = prefix === shown && folder ? within(folder, rest.join('/')) : null;
    if (!file || !(await sendFile(res, file))) { res.writeHead(404); res.end('not found'); }
  }));
  await new Promise((resolve) => previewServer.listen(0, '127.0.0.1', resolve));
  const previewPort = previewServer.address().port;

  /** A web address the preview panel can show for what ucode opened. */
  const previewUrl = (target) => {
    if (/^https?:\/\//.test(target)) return target;
    const file = target.startsWith('file:') ? fileURLToPath(target) : target;
    if (isUnc(file)) return null; // another machine's: not even looked at
    const dir = existsSync(file) && statSync(file).isDirectory() ? file : path.dirname(file);
    let id = [...previews].find(([, f]) => f === dir)?.[0];
    if (!id) { id = randomBytes(6).toString('hex'); previews.set(id, dir); }
    const page = dir === file ? '' : path.basename(file);
    return `http://127.0.0.1:${previewPort}/${shown}/${id}/${encodeURIComponent(page)}`;
  };

  // -- chats -----------------------------------------------------------------

  const emitFor = (entry) => (event) => {
    const full = { chat: entry.id, ...event };
    if (event.type === 'preview') {
      const app = entry.agent.apps?.at(-1);
      const page = app && !existsSync(path.join(app, 'package.json')) && existsSync(path.join(app, 'index.html'))
        ? path.join(app, 'index.html') : null;
      full.url = /^https?:\/\/(?:localhost|127\.0\.0\.1)[:/]/i.test(event.target) && page ? previewUrl(page) : previewUrl(event.target);
    }
    entry.events.push(full);
    broadcast(full);
  };

  async function openChat(id) {
    if (chats.has(id)) return chats.get(id);
    const session = await loadSession(id);
    const folder = session.cwd;
    await fs.mkdir(folder, { recursive: true });
    const entry = { id, folder, events: [] };
    entry.ui = new WebUI({ cwd: folder, emit: emitFor(entry) });
    entry.agent = new Agent({ cwd: folder, ui: entry.ui });
    await entry.agent.bootstrap();
    await entry.agent.resume(id);
    entry.agent.startMcp();
    chats.set(id, entry);
    active = entry;
    return entry;
  }

  async function newChat(folder) {
    await fs.mkdir(folder, { recursive: true });
    const entry = { folder, events: [] };
    entry.ui = new WebUI({ cwd: folder, emit: emitFor(entry) });
    entry.agent = new Agent({ cwd: folder, ui: entry.ui });
    entry.id = entry.agent.session.id;
    await entry.agent.bootstrap();
    entry.agent.startMcp();
    chats.set(entry.id, entry);
    active = entry;
    return entry;
  }

  /** Make this chat's agent the one the tools work for. */
  async function enter(entry) {
    if (active !== entry) { await entry.agent.activate(); active = entry; }
    entry.agent.preferred = model();
    entry.ui.mode = mode;
  }

  /** Puts the chat's newest app online, and says where in one line. */
  async function deployNow(entry, send) {
    if (!process.env.VERCEL_TOKEN) {
      send({ type: 'reply', text: 'To put it online, add a free Vercel token in **Settings → Keys** — the steps are there. Then say "put it online".' });
      return;
    }
    const from = entry.events.length;
    await entry.agent.command('/deploy');
    const said = entry.events.slice(from).map((e) => [e.text, ...(e.lines ?? [])].join(' ')).join(' ');
    const link = /https:\/\/[\w.-]+\.vercel\.app\S*/.exec(said)?.[0]?.replace(/[).,]+$/, '');
    send({ type: 'reply', text: link ? `It is online: ${link}` : 'It could not go online this time — the reason is above. Say "put it online" to try again.' });
  }

  async function runTurn(entry, text, files) {
    running = entry.id;
    entry.events = [];
    const send = emitFor(entry);
    send({ type: 'user', text, files: files.map((f) => path.basename(f)) });
    try {
      await enter(entry);
      for (const f of files) entry.ui.addAttachment(f);
      if (text.startsWith('/')) await entry.agent.command(text);
      // Only asking to deploy ("put it online", "deploy it"): no need to ask the AI anything.
      // A question about it ("how do I deploy?") goes to the AI like any other.
      else if (DEPLOY.test(text) && text.split(/\s+/).length <= 6 && !/^(?:how|what|why|when|where|which|who)\b/i.test(text)) await deployNow(entry, send);
      else {
        await entry.agent.turn(text);
        if (DEPLOY.test(text) && entry.agent.apps?.length && !entry.agent.endedSilently) await deployNow(entry, send);
      }
    } catch (err) {
      entry.ui.error(err);
    } finally {
      running = null;
      send({ type: 'idle', model: model(), title: entry.agent.session.title });
    }
  }

  /** A settings command (/doctor, /skills...), its lines collected for the page that asked. */
  async function capture(entry, text) {
    if (running) throw Object.assign(new Error('ucode is busy in a chat — wait for it or press stop'), { status: 409 });
    await enter(entry);
    entry.ui.capture = [];
    try {
      await entry.agent.command(text);
      return { title: entry.ui.capture.title ?? text, lines: [...entry.ui.capture] };
    } finally {
      entry.ui.capture = null;
    }
  }

  /** An agent for a folder's settings, outside any chat. */
  const helpers = new Map();
  async function helperFor(folder) {
    if (helpers.has(folder)) return helpers.get(folder);
    const entry = { id: `settings:${folder}`, folder, events: [] };
    entry.ui = new WebUI({ cwd: folder, emit: emitFor(entry) });
    entry.agent = new Agent({ cwd: folder, ui: entry.ui });
    await fs.mkdir(folder, { recursive: true });
    await entry.agent.bootstrap();
    active = entry;
    helpers.set(folder, entry);
    return entry;
  }

  async function state() {
    await warming;
    const sessions = await listSessions().catch(() => []);
    const app = await readApp();
    const folders = new Set([...app.projects]);
    return {
      version: `${VERSION} · ucode ${UCODE_VERSION}`,
      appVersion: VERSION,
      ucodeVersion: UCODE_VERSION,
      credit: CREDIT,
      model: model(),
      mode,
      provider: providerNow(),
      running,
      models: modelList(),
      // Every provider; the models of those with a key (and of the one in use).
      providers: Object.entries(PROVIDERS).map(([id, p]) => {
        const models = hasKey(id) || id === providerNow() ? modelList(id) : [];
        const wanted = app.defaults?.[id];
        return {
          id, name: p.name, note: p.note, env: p.env, hint: p.hint, link: p.link, steps: p.steps, hasKey: hasKey(id), models,
          default: models.some((m) => m.id === wanted) ? wanted : p.default,
        };
      }),
      keys: { vercel: Boolean(process.env.VERCEL_TOKEN), tavily: Boolean(process.env.TAVILY_API_KEY) },
      defaultFolder: defaultFolder(),
      projects: [...folders].map((p) => ({ path: p, name: path.basename(p) || p, exists: existsSync(p) })),
      chats: sessions.filter((s) => s.messageCount > 0).map((s) => ({
        id: s.id, title: s.title, folder: s.cwd, updatedAt: s.updatedAt, createdAt: s.createdAt,
        preview: s.preview ?? '', turns: s.turns,
      })),
    };
  }

  // -- routes ----------------------------------------------------------------

  const routes = {
    'GET /api/state': async () => state(),

    'GET /api/chat': async (q) => {
      const id = chatId(q.get('id'));
      const live = chats.get(id);
      const session = live?.agent.session ?? (await loadSession(id));
      const made = live?.agent.apps?.at(-1);
      const app = made && existsSync(path.join(made, 'index.html')) && !existsSync(path.join(made, 'package.json')) ? made : appOf(session);
      return {
        id, title: session.title, folder: session.cwd,
        preview: app ? previewUrl(path.join(app, 'index.html')) : null,
        items: transcript(session.messages),
        // A turn still running: what has happened in it so far.
        live: running === id ? live.events : [],
        busy: running === id,
      };
    },

    'POST /api/send': async (b) => {
      const text = String(b.text ?? '').trim();
      if (!text) throw Object.assign(new Error('nothing to send'), { status: 400 });
      if (running) throw Object.assign(new Error('ucode is still working in a chat — wait for it or press stop'), { status: 409 });
      if (isUnc(b.folder)) throw fail(400, 'choose a folder on this computer');
      const entry = b.chat ? await openChat(chatId(b.chat)) : await newChat(path.resolve(b.folder || defaultFolder()));
      const files = (Array.isArray(b.files) ? b.files : []).map(String).filter((f) => within(UPLOADS, path.relative(UPLOADS, f)) && existsSync(f));
      runTurn(entry, text, files).catch(say); // the reply comes as events
      return { chat: entry.id };
    },

    'POST /api/stop': async (b) => {
      const entry = chats.get(b.chat);
      if (entry?.agent.abort) entry.agent.abort.abort();
      entry?.ui.dropQuestions();
      return { ok: true };
    },

    'POST /api/answer': async (b) => {
      for (const entry of [...chats.values(), ...helpers.values()]) if (entry.ui.answer(b.id, b.value)) return { ok: true };
      return { ok: false };
    },

    'POST /api/model': async (b) => {
      setModel(String(b.id));
      everyAgent();
      return { model: model(), ready: hasKey() };
    },

    'POST /api/provider': async (b) => {
      const name = String(b.provider);
      const app = await readApp();
      switchTo(name, app.defaults?.[name]);
      await writeApp({ ...app, provider: name });
      return { provider: providerNow(), model: model(), ready: hasKey() };
    },

    // The model a provider starts on. For the provider in use, it is used from now on too.
    'POST /api/default': async (b) => {
      const name = String(b.provider);
      const id = String(b.model);
      if (!PROVIDERS[name]) throw fail(400, 'no such provider');
      if (!modelList(name).some((m) => m.id === id)) throw fail(400, `That is not one of ${PROVIDERS[name].name}'s free models.`);
      const app = await readApp();
      await writeApp({ ...app, defaults: { ...app.defaults, [name]: id } });
      if (name === providerNow()) { setModel(id); everyAgent(); }
      return { ok: true, model: model() };
    },

    // /stats, for its popup: this chat's time, steps and tokens since the app opened it.
    'GET /api/stats': async (q) => {
      const agent = chats.get(String(q.get('chat') ?? ''))?.agent;
      if (!agent?.stats) return { rows: [] };
      const rows = statsLines(agent.stats, agent.session?.messages?.length ?? 0).map((l) => bare(l).trim()).filter(Boolean).slice(1);
      return { rows: rows.map((l) => /^(\S+)\s{2,}(.*)$/.exec(l)).filter(Boolean).map(([, label, value]) => ({ label, value })) };
    },

    'POST /api/mode': async (b) => {
      mode = b.mode === 'plan' ? 'plan' : 'build';
      return { mode };
    },

    'POST /api/key': async (b) => {
      const name = String(b.name);
      const owner = Object.keys(PROVIDERS).find((p) => PROVIDERS[p].env === name);
      if (!owner && !['VERCEL_TOKEN', 'TAVILY_API_KEY'].includes(name)) throw fail(400, 'not a key ucode keeps');
      const value = b.value === null ? null : String(b.value ?? '').trim();
      if (value !== null) {
        if (!value) return { ok: false, message: 'Paste the key first.' };
        // One line of plain text: a line break or a control character would write more into ~/.ucode/.env.
        if (value.length > 300 || value.startsWith('=') || /[\u0000-\u001f\u007f]/.test(value)) {
          return { ok: false, message: 'That does not look like a key — paste just the key, on one line.' };
        }
        if (owner && !PROVIDERS[owner].shape.test(value)) {
          return { ok: false, message: `That is not ${owner === 'google' ? 'a' : 'an'} ${PROVIDERS[owner].name} key — they start with ${PROVIDERS[owner].hint.replace('…', '')}` };
        }
        const problem = await checkKey(name, value);
        if (problem) return { ok: false, message: problem };
      }
      await saveEnv(name, value);
      resetConnection();
      // The provider in use has no key now, and another does: use that one - the one just added, if it was one.
      if (!hasKey()) {
        const other = owner && value !== null ? owner : Object.keys(PROVIDERS).find((p) => hasKey(p));
        if (other) {
          const app = await readApp();
          switchTo(other, app.defaults?.[other]);
          await writeApp({ ...app, provider: other });
        }
      }
      refreshModels().catch(() => {});
      return { ok: true, message: value === null ? 'Key removed' : 'Key saved — it works', model: model() };
    },

    'POST /api/chat/rename': async (b) => {
      const title = String(b.title ?? '').trim().slice(0, 120);
      if (!title) throw Object.assign(new Error('a name is needed'), { status: 400 });
      const id = chatId(b.chat);
      const live = chats.get(id);
      if (live) { live.agent.session.title = title; await live.agent.persist(); await live.agent.settled(); }
      else { const s = await loadSession(id); s.title = title; await saveSession(s); }
      return { ok: true };
    },

    'POST /api/chat/delete': async (b) => {
      const id = chatId(b.chat);
      if (running === id) throw Object.assign(new Error('stop it first'), { status: 409 });
      chats.get(id)?.agent.mcp?.close();
      chats.delete(id);
      await removeSession(id);
      return { ok: true };
    },

    'POST /api/chats/clear': async () => {
      if (running) throw Object.assign(new Error('ucode is still working in a chat — stop it first'), { status: 409 });
      for (const entry of chats.values()) entry.agent.mcp?.close();
      chats.clear();
      active = null;
      await clearSessions();
      return { ok: true };
    },

    'POST /api/pick-folder': async () => ({ path: await chooseFolder() }),

    // Settings pages, read straight from ucode's files: a second or less, nothing started.
    'GET /api/skills': async (q) => {
      const folder = await allowedFolder(q.get('folder') || defaultFolder());
      const list = await loadSkills({ cwd: folder });
      return {
        lines: list.length
          ? list.flatMap((s) => [`${s.name}${s.triggers?.length ? '  (loads by itself)' : ''}`, `    ${s.description}`])
          : ['No skills yet.'],
      };
    },

    'GET /api/addons': async (q) => {
      const folder = await allowedFolder(q.get('folder') || defaultFolder());
      const mine = await readServers(USER_MCP).catch(() => ({}));
      const here = await readServers(projectMcpFile(folder)).catch(() => ({}));
      const rows = [
        ...Object.entries(mine).map(([name, spec]) => `${name}  — every project  (${spec.url ?? [spec.command, ...(spec.args ?? [])].join(' ')})`),
        ...Object.entries(here).map(([name, spec]) => `${name}  — this project  (${spec.url ?? [spec.command, ...(spec.args ?? [])].join(' ')})`),
      ];
      return { lines: rows.length ? rows : ['No add-ons yet.'] };
    },

    // "Check everything", all at once with short deadlines: a few seconds, not ucode's minute.
    'GET /api/doctor': async () => {
      const timed = { signal: AbortSignal.timeout(6000) };
      const ask = async (url, headers = {}) => {
        try { return (await fetch(url, { ...timed, headers })).status; } catch { return 0; }
      };
      const key = ([env, what], problem) => (!(process.env[env] || '').trim() ? `-  ${what} — not added (Settings → ${env === 'VERCEL_TOKEN' ? 'Keys' : 'Models'})`
        : !problem ? `✓  ${what} — works` : /reach/.test(problem) ? `?  ${what} — could not check (internet?)` : `✗  ${what} — ${problem}`);
      const browsers = process.platform === 'win32'
        ? [['Microsoft Edge', path.join(process.env['ProgramFiles(x86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')], ['Google Chrome', path.join(process.env.ProgramFiles ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe')]]
        : [['Google Chrome', '/Applications/Google Chrome.app'], ['Microsoft Edge', '/Applications/Microsoft Edge.app'], ['Chrome', '/usr/bin/google-chrome'], ['Chromium', '/usr/bin/chromium']];
      const keys = [...Object.values(PROVIDERS).map((p) => [p.env, `${p.name} key`]), ['VERCEL_TOKEN', 'Vercel token (putting apps online)']];
      const [net, ...problems] = await Promise.all([
        ask('https://www.google.com/generate_204'),
        ...keys.map(([env]) => ((process.env[env] || '').trim() ? checkKey(env, process.env[env].trim()) : null)),
      ]);
      const browser = browsers.find(([, p]) => existsSync(p))?.[0];
      return {
        lines: [
          net ? '✓  Internet — on' : '✗  Internet — off: ucode needs it to reach the AI',
          ...keys.map((k, i) => key(k, problems[i])),
          `✓  Node.js — ${process.version}`,
          `✓  ucode — ${UCODE_VERSION}`,
          browser ? `✓  Browser for checking apps — ${browser}` : '-  Browser for checking apps — none found: ucode skips its own look at the app',
        ],
      };
    },

    'POST /api/projects': async (b) => {
      const app = await readApp();
      let folder = null;
      if (isUnc(b.add)) throw fail(400, 'choose a folder on this computer');
      if (b.add) folder = path.resolve(String(b.add));
      if (b.create) {
        const name = String(b.create).trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').slice(0, 60);
        if (!name) throw Object.assign(new Error('a name is needed'), { status: 400 });
        folder = path.join(defaultFolder(), name);
        await fs.mkdir(folder, { recursive: true });
      }
      if (folder && !app.projects.includes(folder)) app.projects.push(folder);
      if (b.remove) app.projects = app.projects.filter((p) => p !== b.remove);
      await writeApp(app);
      return { ok: true, path: folder };
    },

    'POST /api/upload': async (b, req, raw) => {
      const name = path.basename(decodeURIComponent(String(req.headers['x-name'] ?? 'file'))).replace(/[^\w.\- ]/g, '_').slice(0, 80) || 'file';
      await fs.mkdir(UPLOADS, { recursive: true });
      const file = path.join(UPLOADS, `${randomBytes(4).toString('hex')}-${name}`);
      await fs.writeFile(file, raw);
      return { path: file, name };
    },

    'POST /api/transcribe': async (b, req, raw) => {
      if (!raw.length || isSilent(raw)) return { text: '', note: 'Heard nothing — check the microphone is on, then speak a little louder.' };
      return { text: cleanTranscript(await transcribe(raw)) };
    },

    // POSTs, though they only read: each one commits a snapshot of the folder, so another tab must not trigger them.
    'POST /api/changes': async (b) => {
      const entry = chats.get(b.chat);
      const first = entry?.agent.undoStack?.[0]?.id;
      if (!first || !(await entry.agent.snaps?.ready())) return { files: [], turns: 0 };
      return { files: await entry.agent.snaps.changedSince(first), turns: entry.agent.undoStack.length };
    },

    'POST /api/diff': async (b) => {
      const entry = chats.get(b.chat);
      const first = entry?.agent.undoStack?.[0]?.id;
      if (!first) return { diff: '' };
      return { diff: await diffSince(entry.agent.snaps, first, String(b.file)) };
    },

    'POST /api/undo': async (b) => {
      const entry = chats.get(b.chat);
      if (!entry) return { ok: false, lines: ['nothing to undo in this chat yet'] };
      return capture(entry, `/undo ${Math.max(1, Number(b.turns) || 1)}`);
    },

    'GET /api/files': async (q) => {
      const folder = q.get('folder') ? await allowedFolder(q.get('folder')) : chats.get(q.get('chat'))?.folder;
      if (!folder) return { files: [] };
      return { folder, files: (await projectFiles(folder, 400)).map((f) => f.split(path.sep).join('/')) };
    },

    'GET /api/file': async (q) => {
      const folder = await allowedFolder(q.get('folder'));
      const file = within(folder, q.get('path'));
      if (!file) throw Object.assign(new Error('outside the project'), { status: 403 });
      // A link in the project can point anywhere: never at the keys.
      if (secret(await fs.realpath(file).catch(() => file))) throw fail(403, 'ucode only looks in your projects and chats');
      const info = await fs.stat(file);
      if (info.size > 300_000) return { text: null, note: 'This file is too big to show here.' };
      const buf = await fs.readFile(file);
      if (buf.includes(0)) return { text: null, note: 'This is not a text file.' };
      return { text: buf.toString('utf8') };
    },

    // A link in a reply, or "open in browser". The text came from a model, so:
    // web pages through the system's URL handler (no shell to inject into),
    // and files only of kinds that open in a viewer. Anything else - a .exe, a
    // .js Windows would run - only has its folder opened.
    'POST /api/open': async (b) => {
      const target = String(b.target ?? '');
      // A scheme of two letters or more is an address (C:\ is a drive): only http(s), never file:, ms-* or the like.
      if (/^[a-z][\w+.-]+:/i.test(target)) {
        let url;
        try { url = new URL(target); } catch { return { ok: false }; }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false };
        const [cmd, args] = process.platform === 'win32' ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url.href]]
          : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url.href]];
        spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true }).on('error', () => {}).unref();
        return { ok: true };
      }
      // Checked before the disk is touched: a UNC path is refused here, unlooked-at.
      const root = await rootFor(target);
      if (!root) throw fail(403, 'ucode only opens files in your projects and chats');
      const abs = path.resolve(target);
      if (!existsSync(abs)) return { ok: false };
      const viewable = /\.(?:html?|png|jpe?g|gif|webp|pdf|txt|md)$/i.test(abs);
      const open = statSync(abs).isDirectory() || viewable ? abs : path.dirname(abs);
      // The opener takes only what is inside its root; a project's own folder is opened from its parent.
      return { ok: openInBrowser(open, { root: path.relative(root, open) ? root : path.dirname(open) }) };
    },

    'POST /api/preview': async (b) => {
      if (!(await rootFor(b.target))) throw fail(403, 'ucode only shows files in your projects and chats');
      return { url: previewUrl(path.resolve(String(b.target))) };
    },


    'POST /api/command': async (b) => {
      const text = String(b.text ?? '').trim();
      if (!text.startsWith('/')) throw Object.assign(new Error('not a command'), { status: 400 });
      if (isUnc(b.folder)) throw fail(400, 'choose a folder on this computer');
      const entry = b.chat && chats.has(b.chat) ? chats.get(b.chat) : await helperFor(path.resolve(b.folder || defaultFolder()));
      return capture(entry, text);
    },

    'GET /api/memory': async (q) => {
      const folder = await allowedFolder(q.get('folder') || defaultFolder());
      return { text: await fs.readFile(path.join(folder, MEMORY_FILE), 'utf8').catch(() => ''), file: path.join(folder, MEMORY_FILE) };
    },

    'POST /api/memory': async (b) => {
      const folder = await allowedFolder(b.folder || defaultFolder());
      await fs.mkdir(folder, { recursive: true });
      await fs.writeFile(path.join(folder, MEMORY_FILE), String(b.text ?? ''));
      return { ok: true };
    },
  };

  // -- the server --------------------------------------------------------------

  const server = http.createServer(guard(async (req, res) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const url = new URL(req.url, origin);
    // Only this server's own name: never another site's name pointed here.
    if (![`127.0.0.1:${server.address().port}`, `localhost:${server.address().port}`].includes(req.headers.host)) {
      res.writeHead(403); res.end('forbidden'); return;
    }
    // The first visit: the token becomes a cookie, and leaves the address bar.
    if (url.searchParams.has('t')) {
      if (!same(url.searchParams.get('t'), token)) { res.writeHead(403); res.end('wrong link — open ucode again'); return; }
      res.writeHead(302, { 'Set-Cookie': `ucode_app=${token}; HttpOnly; SameSite=Strict; Path=/`, Location: '/' });
      res.end();
      return;
    }
    if (!same(cookieOf(req, 'ucode_app'), token)) {
      res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Open ucode from the app, or run: ucode app');
      return;
    }

    if (url.pathname === '/api/events') {
      if (clients.size >= MAX_WINDOWS) { res.writeHead(429); res.end('too many windows open'); return; }
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(': hello\n\n');
      clients.add(res);
      // A write to a closed window errors later, as an event: heard here, it only drops that window.
      res.on('error', () => clients.delete(res));
      const beat = setInterval(() => { if (!res.writableEnded && !res.destroyed) res.write(': beat\n\n'); }, 20_000);
      req.on('close', () => { clearInterval(beat); clients.delete(res); });
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.headers.origin !== origin) { json(res, 403, { error: 'not from the app' }); return; }
      const route = routes[`${req.method} ${url.pathname}`];
      if (!route) { json(res, 404, { error: 'no such thing' }); return; }
      try {
        let body = {};
        let raw = Buffer.alloc(0);
        if (req.method === 'POST') {
          raw = await readBody(req);
          if (String(req.headers['content-type'] ?? '').startsWith('application/json')) body = JSON.parse(raw.toString('utf8') || '{}');
        }
        json(res, 200, await route(req.method === 'GET' ? url.searchParams : body, req, raw));
      } catch (err) {
        say(err);
        // Bad JSON or a bad %-escape is the asker's mistake, not ucode's.
        const status = err.status ?? (err instanceof SyntaxError || err instanceof URIError ? 400 : 500);
        json(res, status, { error: err.failed ?? err.message ?? String(err), fix: err.fix });
      }
      return;
    }

    // The app's own page and its files.
    const file = within(uiDir, decodeURIComponent(url.pathname));
    if (file && (await sendFile(res, file, { cache: url.pathname.startsWith('/_next/') }))) return;
    if (await sendFile(res, path.join(uiDir, 'index.html'))) return;
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`The app's page is missing from ${uiDir}. Reinstall ucode desktop.`);
  }));

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  process.on('unhandledRejection', keepAlive);
  process.on('uncaughtException', keepAlive);

  const close = async () => {
    for (const res of clients) res.end();
    clients.clear();
    // Every agent stops at once, each given a moment: one stuck on the network must not hold the window open.
    await Promise.all([...chats.values(), ...helpers.values()].map((entry) => {
      entry.agent.abort?.abort();
      return soon(Promise.all([Promise.resolve().then(() => entry.agent.mcp?.close()), entry.agent.settled?.()]));
    }));
    stopServers();
    await soon(closeBrowser()); // at once when no browser was started
    // Keep-alive sockets (a window, a fetch) would otherwise hold the servers open.
    server.closeAllConnections?.();
    previewServer.closeAllConnections?.();
    await Promise.all([server, previewServer].map((s) => new Promise((resolve) => s.close(() => resolve()))));
    process.off('unhandledRejection', keepAlive);
    process.off('uncaughtException', keepAlive);
  };

  return { url: `http://127.0.0.1:${server.address().port}/?t=${token}`, port: server.address().port, close };
}

/** A window with no address bar: Edge or Chrome in app mode, else the default browser. */
export function openWindow(url) {
  const candidates = process.platform === 'win32'
    ? [
      path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  const browser = candidates.find((c) => c && existsSync(c));
  if (browser) {
    const profile = path.join(os.homedir(), '.ucode', 'app-window');
    spawn(browser, [`--app=${url}`, `--user-data-dir=${profile}`, '--window-size=1280,820', '--no-first-run', '--no-default-browser-check'], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
    return true;
  }
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true }).on('error', () => {}).unref();
  return false;
}
