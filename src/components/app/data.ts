// What the app gets from ucode: the models, the chats, and what happens in a turn.

export type Provider = string; // "google", "openrouter", "nvidia"
export type Model = { id: string; name: string; note: string; context: number | null; star: boolean; ready: boolean; spentUntil: number | null };
/** A provider: its key, its default model, and (once its key is added) every one of its free models. */
/** paid: billed to your own account. local: runs on this computer (Ollama), no key; hasKey means it is running. */
export type ProviderInfo = { id: Provider; name: string; note: string; env: string | null; hint: string; link: string; steps: string[]; paid: boolean; local: boolean; hasKey: boolean; default: string | null; models: Model[] };

/** What a provider needs before its models work, in a few words. */
export const needs = (p: ProviderInfo) => (p.local ? `Start Ollama on this computer` : `Add your ${p.paid ? "" : "free "}${p.name} key`);
export type ChatMeta = { id: string; title: string; folder: string; updatedAt: string; createdAt: string; preview: string; turns: number };
export type Project = { path: string; name: string; exists: boolean };
export type Keys = { vercel: boolean; tavily: boolean };

export type State = {
  version: string;
  appVersion?: string;
  ucodeVersion?: string;
  credit: string;
  model: string;
  provider: Provider;
  providers: ProviderInfo[];
  mode: "build" | "plan";
  running: string | null;
  models: Model[];
  keys: Keys;
  defaultFolder: string;
  projects: Project[];
  chats: ChatMeta[];
};

/** Something on screen in a chat. Built from ucode's events as they arrive. */
export type Item =
  | { kind: "user"; id: string; text: string; files?: string[] }
  | { kind: "reply"; id: string; text: string; streaming?: boolean }
  | { kind: "steps"; id: string; steps: Step[]; count?: number; open?: boolean; start?: number; end?: number }
  | { kind: "question"; id: string; qid: string; ask: "confirm" | "pick"; action?: string; detail?: string; risk?: string | null; always?: string | null; title?: string | null; items?: string[]; answered?: boolean }
  | { kind: "note"; id: string; text: string }
  | { kind: "lines"; id: string; title?: string; lines: string[] }
  | { kind: "error"; id: string; text: string; fix?: string };

export type Step = { text: string; result?: string; ok?: boolean; narration?: boolean; detail?: boolean };

/** One event from ucode, as the server sends it. */
export type Event = { chat: string; type: string; [key: string]: unknown };

export type View =
  | { kind: "home"; folder?: string | null }
  | { kind: "chat"; id: string }
  | { kind: "chats" }
  | { kind: "project"; path: string };

export const newId = () => Math.random().toString(36).slice(2, 10);

/** Today, Yesterday, or the date - for grouping chats. */
export function dayOf(time: number | string) {
  const t = new Date(time);
  if (t.toDateString() === new Date().toDateString()) return "Today";
  if (t.toDateString() === new Date(Date.now() - 86_400_000).toDateString()) return "Yesterday";
  return t.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export const sameFolder = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.replace(/[\\/]+$/, "").toLowerCase() === b.replace(/[\\/]+$/, "").toLowerCase();

export const folderName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p;

/** A steady colour for a folder, from its name. */
export const hueOf = (p: string) => [...p].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
