"use client";

import { useEffect, useState } from "react";
import {
  BookOpen, Check, GitBranch, KeyRound, LoaderCircle, Monitor, Moon, Package, Palette, Plug, ShieldCheck, Sparkles, Star, Stethoscope, Sun, User, Wand2, X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { get, post } from "@/lib/api";
import { cn } from "@/lib/utils";
import { type Keys, type Model, type Project, type Provider, folderName, providerName } from "./data";
import { Logo } from "./logo";

const ACCENTS = [
  { name: "Blue", hue: 259 }, { name: "Violet", hue: 295 }, { name: "Green", hue: 155 },
  { name: "Orange", hue: 50 }, { name: "Rose", hue: 10 }, { name: "Teal", hue: 195 },
];

const SECTIONS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "models", label: "Models", icon: Sparkles },
  { id: "keys", label: "Keys", icon: KeyRound },
  { id: "permissions", label: "Permissions", icon: ShieldCheck },
  { id: "notes", label: "Project notes", icon: BookOpen },
  { id: "skills", label: "Skills", icon: Wand2 },
  { id: "addons", label: "Add-ons", icon: Plug },
  { id: "doctor", label: "Check everything", icon: Stethoscope },
  { id: "about", label: "About", icon: User },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

type KeyInfo = { name: string; key: keyof Keys; title: string; text: string; link: string; hint: string; steps?: string[] };

const KEYS: KeyInfo[] = [
  { name: "GEMINI_API_KEY", key: "google", title: "Google key", text: "For the Gemini models. Free, no card.", link: "https://aistudio.google.com/apikey", hint: "AIza…" },
  { name: "OPENROUTER_API_KEY", key: "openrouter", title: "OpenRouter key", text: "For the free NVIDIA and Gemma models on OpenRouter.", link: "https://openrouter.ai/keys", hint: "sk-or-…" },
  {
    name: "VERCEL_TOKEN", key: "vercel", title: "Vercel token — to share your apps online",
    text: "Lets “Share online” put your apps on the internet and give you a link. Free.",
    link: "https://vercel.com/account/tokens", hint: "Vercel token",
    steps: [
      "Click “Get one free” below. It opens vercel.com.",
      "Sign up free (the quickest is “Continue with GitHub” or Google).",
      "On the Tokens page, click “Create Token”.",
      "Name it ucode, choose No Expiration, and click Create.",
      "Copy the token, click Add here, paste it, and press Check & save.",
    ],
  },
  { name: "TAVILY_API_KEY", key: "tavily", title: "Web search key (optional)", text: "Better web search. 1000 free searches a month.", link: "https://tavily.com", hint: "tvly-…" },
];

const PROVIDERS = [
  { id: "google", title: "Google Gemini", text: "Free key from Google, no card. The most reliable." },
  { id: "openrouter", title: "OpenRouter", text: "Free NVIDIA and Gemma models, with a free OpenRouter key." },
] as const;

const openLink = (url: string) => post("open", { target: url });

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  section?: string;
  models: Model[];
  model: string;
  onModel: (id: string) => void;
  provider: Provider;
  onProvider: (p: Provider) => void;
  keys: Keys;
  folder: string;
  projects: Project[];
  defaultFolder: string;
  name: string;
  onName: (n: string) => void;
  version: string;
  credit: string;
  onChanged: () => void;
  onLearn: (folder: string) => void;
};

/** Output of one of ucode's commands, as a page. */
function CommandPage({ text, folder, intro }: { text: string; folder: string; intro: string }) {
  const [out, setOut] = useState<{ lines: string[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setOut(null);
    setError("");
    post("command", { text, folder }).then(setOut).catch((e) => setError(e.message));
  }, [text, folder]);
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted-foreground">{intro}</p>
      {error && <p className="text-[13px] text-destructive">{error}</p>}
      {!out && !error && <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Asking ucode…</p>}
      {out && <pre className="whitespace-pre-wrap rounded-xl border bg-muted/40 p-3 font-mono text-[12px] leading-relaxed">{out.lines.join("\n").replace(/^\n+|\n+$/g, "") || "Nothing here yet."}</pre>}
    </div>
  );
}

function KeyRow({ k, set, onChanged }: { k: KeyInfo; set: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (v: string | null) => {
    setBusy(true);
    try {
      const r = await post("key", { name: k.name, value: v });
      if (r.ok) { toast.success(r.message); setEditing(false); setValue(""); onChanged(); }
      else toast.error(r.message);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border p-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">{k.title}</p>
          <p className="text-[12px] text-muted-foreground">{k.text}</p>
        </div>
        {set ? <span className="flex items-center gap-1 text-[12px] text-success"><Check className="size-3.5" /> Saved</span> : <span className="text-[12px] text-muted-foreground">Not added</span>}
      </div>
      {k.steps && !set && (
        <ol className="mt-2.5 list-decimal space-y-1 rounded-lg bg-muted/60 py-2.5 pl-8 pr-3 text-[12.5px] leading-snug">
          {k.steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
      )}
      {editing ? (
        <div className="mt-3 flex gap-2">
          <Input autoFocus type="password" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && value.trim() && save(value.trim())} placeholder={`Paste it here — ${k.hint}`} className="font-mono" />
          <Button disabled={!value.trim() || busy} onClick={() => save(value.trim())}>{busy ? <LoaderCircle className="animate-spin" /> : "Check & save"}</Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant={set ? "outline" : "default"} onClick={() => setEditing(true)}>{set ? "Change" : "Add"}</Button>
          {set && <Button size="sm" variant="ghost" disabled={busy} onClick={() => save(null)}>Remove</Button>}
          <Button size="sm" variant="link" className="px-1" onClick={() => openLink(k.link)}>Get one free</Button>
        </div>
      )}
    </div>
  );
}

/** Settings, in plain words. Every choice takes effect at once. */
export function SettingsDialog(p: Props) {
  const [section, setSection] = useState<Section>("appearance");
  const [accent, setAccent] = useState(259);
  const [notesFolder, setNotesFolder] = useState(p.folder);
  const [notes, setNotes] = useState<string | null>(null);
  const [perm, setPerm] = useState(0);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (p.open) setSection((SECTIONS.find((s) => s.id === p.section)?.id ?? "appearance") as Section);
    if (p.open) setNotesFolder(p.folder);
  }, [p.open, p.section, p.folder]);
  useEffect(() => {
    try { const h = Number(localStorage.getItem("ucode-accent")); if (h) setAccent(h); } catch { /* private window */ }
  }, []);
  useEffect(() => {
    if (section !== "notes") return;
    setNotes(null);
    get("memory", { folder: notesFolder }).then((r) => setNotes(r.text)).catch(() => setNotes(""));
  }, [section, notesFolder]);

  const pickAccent = (hue: number) => {
    setAccent(hue);
    document.documentElement.style.setProperty("--brand", `oklch(0.6 0.19 ${hue})`);
    try { localStorage.setItem("ucode-accent", String(hue)); } catch { /* private window */ }
  };

  const folders = [{ path: p.defaultFolder, name: "ucode (your apps)" }, ...p.projects.map((x) => ({ path: x.path, name: x.name }))];
  const FolderChooser = () => (
    <select value={notesFolder} onChange={(e) => setNotesFolder(e.target.value)} className="h-8 rounded-lg border bg-background px-2 text-[13px]">
      {folders.map((f) => <option key={f.path} value={f.path}>{f.name}</option>)}
      {!folders.some((f) => f.path === notesFolder) && <option value={notesFolder}>{folderName(notesFolder)}</option>}
    </select>
  );

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="flex h-[600px] max-w-[860px] gap-0 overflow-hidden p-0 sm:max-w-[860px]" showCloseButton={false}>
        <nav className="w-52 shrink-0 overflow-y-auto border-r bg-sidebar p-2">
          <DialogTitle className="px-2 pb-3 pt-2 text-[15px]">Settings</DialogTitle>
          <DialogDescription className="sr-only">How ucode looks, which model it uses, your keys and what it may do.</DialogDescription>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setSection(id)} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-sidebar-accent", section === id && "bg-sidebar-accent font-medium")}>
              <Icon className="size-4 opacity-70" /> {label}
            </button>
          ))}
        </nav>

        <div className="relative min-w-0 flex-1 overflow-y-auto p-6">
          <button onClick={() => p.onOpenChange(false)} className="absolute right-3 top-3 grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent" aria-label="Close"><X className="size-4" /></button>

          {section === "appearance" && (
            <div className="space-y-7">
              <div>
                <h3 className="text-[14px] font-medium">Theme</h3>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[{ id: "light", label: "Light", icon: Sun }, { id: "dark", label: "Dark", icon: Moon }, { id: "system", label: "Same as computer", icon: Monitor }].map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setTheme(id)} className={cn("flex flex-col items-center gap-2 rounded-xl border p-3 text-[12px] transition-colors hover:bg-accent", theme === id && "border-primary ring-2 ring-primary/20")}>
                      <Icon className="size-4" /> {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-[14px] font-medium">Accent colour</h3>
                <div className="mt-3 flex gap-2.5">
                  {ACCENTS.map((a) => (
                    <button key={a.name} onClick={() => pickAccent(a.hue)} aria-label={a.name} className="grid size-8 place-items-center rounded-full transition-transform hover:scale-110"
                      style={{ background: `oklch(0.6 0.19 ${a.hue})`, boxShadow: accent === a.hue ? `0 0 0 2px var(--background), 0 0 0 4px oklch(0.6 0.19 ${a.hue})` : undefined }}>
                      {accent === a.hue && <Check className="size-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-[14px] font-medium">What should ucode call you?</h3>
                <Input className="mt-3 max-w-xs" value={p.name} onChange={(e) => p.onName(e.target.value.slice(0, 30))} placeholder="Your first name" />
              </div>
            </div>
          )}

          {section === "models" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-[14px] font-medium">Who runs the model</h3>
                <p className="text-[12px] text-muted-foreground">Both are free. Each needs its own key — add them under Keys.</p>
              </div>
              <div role="radiogroup" aria-label="Who runs the model" className="grid grid-cols-2 gap-2">
                {PROVIDERS.map((x) => (
                  <button key={x.id} role="radio" aria-checked={p.provider === x.id} onClick={() => p.provider !== x.id && p.onProvider(x.id)}
                    className={cn("rounded-xl border p-3 text-left transition-colors hover:bg-accent", p.provider === x.id && "border-primary ring-2 ring-primary/20")}>
                    <span className="flex items-center gap-2 text-[13px] font-medium">
                      {x.title}
                      {p.keys[x.id] ? <span className="ml-auto flex items-center gap-1 text-[11px] font-normal text-success"><Check className="size-3" /> key saved</span>
                        : <span className="ml-auto text-[11px] font-normal text-warning">needs a key</span>}
                    </span>
                    <span className="mt-1 block text-[12px] text-muted-foreground">{x.text}</span>
                  </button>
                ))}
              </div>
              {!p.keys[p.provider] && (
                <button onClick={() => setSection("keys")} className="w-full rounded-xl border border-warning/50 bg-warning/5 p-3 text-left text-[13px]">
                  <span className="font-medium">Add your {providerName[p.provider]} key</span> <span className="text-muted-foreground">— free, and these models need it.</span>
                </button>
              )}
              {[p.provider].map((via) => (
                <div key={via} className="space-y-1">
                  <p className="px-1 text-[11px] font-medium text-muted-foreground">{providerName[via]} models</p>
                  {p.models.filter((m) => m.via === via).map((m) => (
                    <button key={m.id} onClick={() => (m.ready ? p.onModel(m.id) : setSection("keys"))}
                      className={cn("flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent", p.model === m.id ? "border-primary/50 bg-primary/5" : "border-transparent")}>
                      <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border", p.model === m.id && "border-primary bg-primary")}>{p.model === m.id && <span className="size-1.5 rounded-full bg-white" />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium">{m.name} {m.star && <Star className="mb-0.5 inline size-3 fill-primary text-primary" />}</span>
                        <span className="block text-[12px] text-muted-foreground">{m.note}</span>
                      </span>
                      {!m.ready && <span className="shrink-0 text-[11px] text-warning">add key</span>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {section === "keys" && (
            <div className="space-y-3">
              <div>
                <h3 className="text-[14px] font-medium">Your keys</h3>
                <p className="text-[12px] text-muted-foreground">Kept on this computer only (in your .ucode folder). Each is checked before it is saved.</p>
              </div>
              {KEYS.map((k) => <KeyRow key={k.name} k={k} set={p.keys[k.key]} onChanged={p.onChanged} />)}
            </div>
          )}

          {section === "permissions" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-medium">What ucode may do in</h3>
                <FolderChooser />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => post("command", { text: "/permissions ask", folder: notesFolder }).then(() => { toast.success("ucode will ask before running commands here"); setPerm((n) => n + 1); })}>Ask before running commands</Button>
                <Button size="sm" variant="outline" onClick={() => post("command", { text: "/permissions auto", folder: notesFolder }).then(() => { toast.success("ucode runs commands here without asking"); setPerm((n) => n + 1); })}>Run them without asking</Button>
              </div>
              <CommandPage key={perm} text="/permissions" folder={notesFolder} intro="Changing files outside the folder always asks first. “Always allow” at a question adds to the allowed list." />
            </div>
          )}

          {section === "notes" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-medium">Notes for</h3>
                <FolderChooser />
              </div>
              <p className="text-[12px] text-muted-foreground">ucode reads these at the start of every request in this folder (its UCODE.md): how you like things, what the project is.</p>
              {notes === null ? <LoaderCircle className="size-4 animate-spin text-muted-foreground" /> : (
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Use plain CSS. Keep every page working on a phone." className="h-64 w-full rounded-xl border bg-background p-3 font-mono text-[12.5px] outline-none focus:border-primary/50" />
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => post("memory", { folder: notesFolder, text: notes ?? "" }).then(() => toast.success("Notes saved"))}>Save notes</Button>
                <Button size="sm" variant="outline" onClick={() => { p.onLearn(notesFolder); p.onOpenChange(false); }}>Let ucode learn this project</Button>
              </div>
            </div>
          )}

          {section === "skills" && <CommandPage text="/skills" folder={p.folder} intro="What ucode knows how to do. It pulls one in by itself when a request matches. Add your own as a folder with a SKILL.md under .ucode/skills." />}
          {section === "addons" && <CommandPage text="/mcp" folder={p.folder} intro="Add-ons (MCP servers) give ucode extra tools. Add one from a terminal: ucode mcp add <name> <command>." />}
          {section === "doctor" && <CommandPage text="/doctor" folder={p.folder} intro="Your keys, the internet, the browser ucode checks apps in, and updates. It can take a minute." />}

          {section === "about" && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Logo className="size-14 rounded-2xl text-3xl" />
              <h3 className="mt-4 text-xl font-semibold">ucode</h3>
              <p className="text-[13px] text-muted-foreground">Version {p.version}</p>
              <p className="mt-3 font-serif text-[17px] italic">{p.credit}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Free software under the AGPL-3.0, with no warranty</p>
              <div className="mt-5 flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openLink("https://github.com/sppideey/ucode-agent")}><GitBranch className="size-3.5" /> GitHub</Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openLink("https://www.npmjs.com/package/ucode-agent")}><Package className="size-3.5" /> npm</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
