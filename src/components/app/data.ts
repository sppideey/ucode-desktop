// What the app gets from ucode: the models, the chats, and what happens in a turn.

export type Provider = "google" | "openrouter";
export type Model = { id: string; name: string; note: string; context: number; star: boolean; via: Provider; ready: boolean; spentUntil: number | null };
export type ChatMeta = { id: string; title: string; folder: string; updatedAt: string; createdAt: string; preview: string; turns: number };
export type Project = { path: string; name: string; exists: boolean };
export type Keys = { google: boolean; openrouter: boolean; vercel: boolean; tavily: boolean };

export type State = {
  version: string;
  appVersion?: string;
  ucodeVersion?: string;
  credit: string;
  model: string;
  provider?: Provider; // missing from an older ucode: then it is the current model's
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

export type Step = { text: string; result?: string; ok?: boolean; narration?: boolean };

/** One event from ucode, as the server sends it. */
export type Event = { chat: string; type: string; [key: string]: unknown };

export type View =
  | { kind: "home"; folder?: string | null }
  | { kind: "chat"; id: string }
  | { kind: "chats" }
  | { kind: "apps" }
  | { kind: "project"; path: string };

export const providerName: Record<Provider, string> = { google: "Google", openrouter: "OpenRouter" };

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
