"use client";

import { useEffect, useState } from "react";
import {
  BookOpen, Check, ChevronRight, GitBranch, HardDrive, KeyRound, LoaderCircle, Package, Palette, Plug, ShieldCheck, Sparkles, Star, Stethoscope, Wand2, X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { get, post } from "@/lib/api";
import { cn } from "@/lib/utils";
import { type Keys, type Model, type Project, type Provider, folderName, providerName } from "./data";
import { Logo } from "./logo";

// iOS system colours. Blue is the theme's own, so picking it clears the override.
const ACCENTS = [
  { name: "Blue", hex: null, swatch: "#007aff" },
  { name: "Indigo", hex: "#5856d6", swatch: "#5856d6" },
  { name: "Purple", hex: "#af52de", swatch: "#af52de" },
  { name: "Pink", hex: "#ff2d55", swatch: "#ff2d55" },
  { name: "Orange", hex: "#ff9500", swatch: "#ff9500" },
  { name: "Green", hex: "#34c759", swatch: "#34c759" },
  { name: "Teal", hex: "#30b0c7", swatch: "#30b0c7" },
];

const SECTIONS = [
  { id: "appearance", label: "Appearance", icon: Palette, tile: "#007aff" },
  { id: "models", label: "Models", icon: Sparkles, tile: "#af52de" },
  { id: "keys", label: "Keys", icon: KeyRound, tile: "#8e8e93" },
  { id: "permissions", label: "Permissions", icon: ShieldCheck, tile: "#34c759" },
  { id: "notes", label: "Project notes", icon: BookOpen, tile: "#ff9500" },
  { id: "skills", label: "Skills", icon: Wand2, tile: "#5856d6" },
  { id: "addons", label: "Add-ons", icon: Plug, tile: "#30b0c7" },
  { id: "doctor", label: "Check everything", icon: Stethoscope, tile: "#ff2d55" },
  { id: "data", label: "Data", icon: HardDrive, tile: "#636366" },
  { id: "about", label: "About", icon: null, tile: "" },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

type KeyInfo = { name: string; key: keyof Keys; title: string; text: string; link: string; hint: string; steps?: string[] };

const KEYS: KeyInfo[] = [
  { name: "GEMINI_API_KEY", key: "google", title: "Google key", text: "For the Gemini models. Free, no card.", link: "https://aistudio.google.com/apikey", hint: "AIza…" },
  { name: "OPENROUTER_API_KEY", key: "openrouter", title: "OpenRouter key", text: "For the free NVIDIA and Gemma models on OpenRouter.", link: "https://openrouter.ai/keys", hint: "sk-or-…" },
  {
    name: "VERCEL_TOKEN", key: "vercel", title: "Vercel token",
    text: "Lets “Share online” put your apps on the internet and give you a link. Free.",
    link: "https://vercel.com/account/tokens", hint: "Vercel token",
    steps: [
      "Click “Get one free”. It opens vercel.com.",
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

const openLink = (url: string) => post("open", { target: url }).catch((e) => toast.error(e.message));

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
  ucodeVersion?: string;
  updateNote: string;
  onCheckUpdate: () => void;
  credit: string;
  onChanged: () => void;
  onLearn: (folder: string) => void;
  onClearChats: () => void;
};

/** An iOS grouped list: a small grey label, a rounded card of rows split by hairlines, a footnote. */
function Group({ label, footer, children }: { label?: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      {label && <h3 className="px-3 pb-1 text-[11px] font-medium text-muted-foreground">{label}</h3>}
      <div className="divide-y divide-border overflow-hidden rounded-xl bg-card">{children}</div>
      {footer && <p className="px-3 pt-1.5 text-[11.5px] leading-snug text-muted-foreground">{footer}</p>}
    </section>
  );
}

const row = "flex min-h-9 w-full items-center gap-3 px-3 py-1.5 text-left text-[13px]";
const tapRow = cn(row, "transition-colors hover:bg-accent/60 active:bg-accent");
const smallButton = "h-6 rounded-md px-2 text-[12px] font-medium transition-colors disabled:opacity-40";

/** Output of one of ucode's commands, as a page. */
function CommandPage({ text, folder, intro, page }: { text: string; folder: string; intro: string; page?: string }) {
  const [out, setOut] = useState<{ lines: string[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setOut(null);
    setError("");
    (page ? get(page, { folder }) : post("command", { text, folder })).then(setOut).catch((e) => setError(e.message));
  }, [text, folder, page]);
  return (
    <Group footer={intro}>
      <div className="px-3 py-2.5">
        {error && <p className="text-[12.5px] text-destructive">{error}</p>}
        {!out && !error && <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" /> Asking ucode…</p>}
        {out && <pre className="whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed">{out.lines.join("\n").replace(/^\n+|\n+$/g, "") || "Nothing here yet."}</pre>}
      </div>
    </Group>
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
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">{k.title}</p>
          <p className="text-[11.5px] text-muted-foreground">{k.text}</p>
        </div>
        {set ? <span className="flex shrink-0 items-center gap-1 text-[11.5px] text-success"><Check className="size-3" /> Saved</span>
          : <span className="shrink-0 text-[11.5px] text-muted-foreground">Not added</span>}
      </div>
      {k.steps && !set && (
        <ol className="mt-2 list-decimal space-y-0.5 rounded-lg bg-muted/70 py-2 pl-7 pr-3 text-[12px] leading-snug">
          {k.steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
      )}
      {editing ? (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            autoFocus
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && value.trim() && save(value.trim())}
            placeholder={`Paste it here — ${k.hint}`}
            aria-label={k.title}
            className="h-7 min-w-0 flex-1 rounded-md border bg-background px-2 font-mono text-[12px] outline-none focus:border-primary"
          />
          <button type="button" className={cn(smallButton, "h-7 bg-primary text-primary-foreground hover:opacity-90")} disabled={!value.trim() || busy} onClick={() => save(value.trim())}>
            {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : "Check & save"}
          </button>
          <button type="button" className={cn(smallButton, "h-7 text-muted-foreground hover:bg-accent")} onClick={() => setEditing(false)}>Cancel</button>
        </div>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1">
          <button type="button" className={cn(smallButton, set ? "bg-accent hover:bg-accent/70" : "bg-primary text-primary-foreground hover:opacity-90")} onClick={() => setEditing(true)}>{set ? "Change" : "Add"}</button>
          {set && <button type="button" className={cn(smallButton, "text-destructive hover:bg-destructive/10")} disabled={busy} onClick={() => save(null)}>Remove</button>}
          <button type="button" className={cn(smallButton, "text-primary hover:bg-primary/10")} onClick={() => openLink(k.link)}>Get one free</button>
        </div>
      )}
    </div>
  );
}

const Selected = () => <Check className="size-3.5 shrink-0 text-primary" strokeWidth={2.5} />;

/** Settings, in plain words. Every choice takes effect at once. */
export function SettingsDialog(p: Props) {
  const [section, setSection] = useState<Section>("appearance");
  const [accent, setAccent] = useState<string | null>(null);
  const [notesFolder, setNotesFolder] = useState(p.folder);
  const [notes, setNotes] = useState<string | null>(null);
  const [perm, setPerm] = useState(0);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (p.open) setSection((SECTIONS.find((s) => s.id === p.section)?.id ?? "appearance") as Section);
    if (p.open) setNotesFolder(p.folder);
  }, [p.open, p.section, p.folder]);
  useEffect(() => {
    try { const a = localStorage.getItem("ucode-accent"); if (a && /^#[0-9a-f]{6}$/i.test(a)) setAccent(a.toLowerCase()); } catch { /* private window */ }
  }, []);
  useEffect(() => {
    if (section !== "notes") return;
    setNotes(null);
    get("memory", { folder: notesFolder }).then((r) => setNotes(r.text)).catch(() => setNotes(""));
  }, [section, notesFolder]);

  const pickAccent = (hex: string | null) => {
    setAccent(hex);
    const root = document.documentElement.style;
    try {
      if (hex) { root.setProperty("--brand", hex); localStorage.setItem("ucode-accent", hex); }
      else { root.removeProperty("--brand"); localStorage.removeItem("ucode-accent"); }
    } catch { /* private window */ }
  };

  const setPermissions = (mode: "ask" | "auto", said: string) =>
    post("command", { text: `/permissions ${mode}`, folder: notesFolder })
      .then(() => { toast.success(said); setPerm((n) => n + 1); })
      .catch((e) => toast.error(e.message));

  const folders = [{ path: p.defaultFolder, name: "ucode (your apps)" }, ...p.projects.map((x) => ({ path: x.path, name: x.name }))];
  const folderRow = (
    <div className={row}>
      <span className="flex-1">Folder</span>
      <select value={notesFolder} onChange={(e) => setNotesFolder(e.target.value)} aria-label="Folder" className="h-6 max-w-[220px] rounded-md bg-accent px-1.5 text-[12.5px] outline-none">
        {folders.map((f) => <option key={f.path} value={f.path}>{f.name}</option>)}
        {!folders.some((f) => f.path === notesFolder) && <option value={notesFolder}>{folderName(notesFolder)}</option>}
      </select>
    </div>
  );
  const current = SECTIONS.find((s) => s.id === section)!;

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="flex h-[min(560px,85vh)] max-w-[760px] gap-0 overflow-hidden p-0 text-[13px] sm:max-w-[760px]" showCloseButton={false}>
        <nav className="w-48 shrink-0 overflow-y-auto border-r bg-sidebar p-2 [scrollbar-width:thin]">
          <DialogTitle className="px-1.5 pb-2 pt-1 text-[13px] font-semibold">Settings</DialogTitle>
          <DialogDescription className="sr-only">How ucode looks, which model it uses, your keys and what it may do.</DialogDescription>
          {SECTIONS.map(({ id, label, icon: Icon, tile }) => (
            <button
              type="button"
              key={id}
              onClick={() => setSection(id)}
              className={cn("flex h-7 w-full items-center gap-2 rounded-md px-1.5 text-[12.5px] transition-colors hover:bg-sidebar-accent/70", section === id && "bg-sidebar-accent font-medium hover:bg-sidebar-accent")}
            >
              {Icon ? (
                <span className="grid size-[18px] shrink-0 place-items-center rounded-[5px] text-white" style={{ background: tile }}>
                  <Icon className="size-3" strokeWidth={2.25} />
                </span>
              ) : <Logo className="size-[18px]" />}
              {label}
            </button>
          ))}
        </nav>

        <div className="relative min-w-0 flex-1 overflow-y-auto bg-panel px-6 pb-6 pt-4 [scrollbar-width:thin]">
          <div className="mb-3 flex h-6 items-center">
            <h2 className="text-[15px] font-semibold">{current.label}</h2>
            <button type="button" onClick={() => p.onOpenChange(false)} className="ml-auto grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close">
              <X className="size-3.5" />
            </button>
          </div>

          {section === "appearance" && (
            <Group>
              <div className={row}>
                <span className="flex-1">Theme</span>
                <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg bg-accent p-0.5">
                  {[{ id: "light", label: "Light" }, { id: "dark", label: "Dark" }, { id: "system", label: "Auto" }].map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      role="radio"
                      aria-checked={theme === t.id}
                      onClick={() => setTheme(t.id)}
                      className={cn("h-6 rounded-md px-2.5 text-[12px] text-muted-foreground transition-colors", theme === t.id && "bg-card font-medium text-foreground shadow-sm dark:bg-white/15")}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={row}>
                <span className="flex-1">Accent colour</span>
                <div className="flex gap-1.5">
                  {ACCENTS.map((a) => (
                    <button
                      type="button"
                      key={a.name}
                      onClick={() => pickAccent(a.hex)}
                      aria-label={a.name}
                      title={a.name}
                      className="grid size-[18px] place-items-center rounded-full transition-transform hover:scale-110"
                      style={{ background: a.swatch, boxShadow: accent === a.hex ? `0 0 0 2px var(--card), 0 0 0 3.5px ${a.swatch}` : undefined }}
                    >
                      {accent === a.hex && <Check className="size-2.5 text-white" strokeWidth={3} />}
                    </button>
                  ))}
                </div>
              </div>
              <label className={row}>
                <span className="flex-1">Your name</span>
                <input
                  value={p.name}
                  onChange={(e) => p.onName(e.target.value.slice(0, 30))}
                  placeholder="What ucode calls you"
                  className="h-6 w-44 bg-transparent text-right text-[13px] outline-none placeholder:text-muted-foreground/70"
                />
              </label>
            </Group>
          )}

          {section === "models" && (
            <>
              <Group label="Who runs the model" footer="Both are free. Each needs its own key, added under Keys.">
                {PROVIDERS.map((x) => (
                  <button type="button" key={x.id} role="radio" aria-checked={p.provider === x.id} onClick={() => p.provider !== x.id && p.onProvider(x.id)} className={tapRow}>
                    <span className="min-w-0 flex-1">
                      <span className="block">{x.title}</span>
                      <span className="block text-[11.5px] text-muted-foreground">{x.text}</span>
                    </span>
                    {!p.keys[x.id] && <span className="shrink-0 text-[11.5px] text-warning">needs a key</span>}
                    {p.provider === x.id && <Selected />}
                  </button>
                ))}
              </Group>
              {!p.keys[p.provider] && (
                <Group>
                  <button type="button" onClick={() => setSection("keys")} className={cn(tapRow, "text-primary")}>
                    <span className="flex-1">Add your {providerName[p.provider]} key</span>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </button>
                </Group>
              )}
              <Group label={`${providerName[p.provider]} models`}>
                {p.models.filter((m) => m.via === p.provider).map((m) => (
                  <button type="button" key={m.id} onClick={() => (m.ready ? p.onModel(m.id) : setSection("keys"))} className={tapRow}>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1">{m.name} {m.star && <Star className="size-3 fill-primary text-primary" />}</span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">{m.note}</span>
                    </span>
                    {!m.ready && <span className="shrink-0 text-[11.5px] text-warning">add key</span>}
                    {p.model === m.id && <Selected />}
                  </button>
                ))}
              </Group>
            </>
          )}

          {section === "keys" && (
            <Group footer="Kept on this computer only (in your .ucode folder). Each is checked before it is saved.">
              {KEYS.map((k) => <KeyRow key={k.name} k={k} set={p.keys[k.key]} onChanged={p.onChanged} />)}
            </Group>
          )}

          {section === "permissions" && (
            <>
              <Group>{folderRow}</Group>
              <Group label="Running commands">
                <button type="button" className={cn(tapRow, "text-primary")} onClick={() => setPermissions("ask", "ucode will ask before running commands here")}>Ask before running commands</button>
                <button type="button" className={cn(tapRow, "text-primary")} onClick={() => setPermissions("auto", "ucode runs commands here without asking")}>Run them without asking</button>
              </Group>
              <CommandPage key={perm} text="/permissions" folder={notesFolder} intro="Changing files outside the folder always asks first. “Always allow” at a question adds to the allowed list." />
            </>
          )}

          {section === "notes" && (
            <>
              <Group>{folderRow}</Group>
              <Group footer="ucode reads these at the start of every request in this folder (its UCODE.md): how you like things, what the project is.">
                {notes === null ? (
                  <div className="px-3 py-2.5"><LoaderCircle className="size-3.5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    aria-label="Project notes"
                    placeholder="e.g. Use plain CSS. Keep every page working on a phone."
                    className="block h-56 w-full resize-none bg-transparent px-3 py-2.5 font-mono text-[12px] outline-none"
                  />
                )}
              </Group>
              <Group>
                <button type="button" className={cn(tapRow, "text-primary")} onClick={() => post("memory", { folder: notesFolder, text: notes ?? "" }).then(() => toast.success("Notes saved")).catch((e) => toast.error(e.message))}>Save notes</button>
                <button type="button" className={cn(tapRow, "text-primary")} onClick={() => { p.onLearn(notesFolder); p.onOpenChange(false); }}>Let ucode learn this project</button>
              </Group>
            </>
          )}

          {section === "skills" && <CommandPage page="skills" text="/skills" folder={p.folder} intro="What ucode knows how to do. It pulls one in by itself when a request matches. Add your own as a folder with a SKILL.md under .ucode/skills." />}
          {section === "addons" && <CommandPage page="addons" text="/mcp" folder={p.folder} intro="Add-ons (MCP servers) give ucode extra tools. Add one from a terminal: ucode mcp add <name> <command>." />}
          {section === "doctor" && <CommandPage page="doctor" text="/doctor" folder={p.folder} intro="Your keys, the internet, and the browser ucode checks apps in." />}

          {section === "data" && (
            <Group label="History" footer="Deletes every chat in ucode. Your projects and the files ucode made stay.">
              <button type="button" className={cn(tapRow, "text-destructive")} onClick={p.onClearChats}>Clear all chats</button>
            </Group>
          )}

          {section === "about" && (
            <>
              <div className="flex flex-col items-center pb-5 pt-3 text-center">
                <Logo className="size-12" />
                <p className="mt-3 text-[15px] font-semibold">ucode desktop</p>
                <p className="text-[12px] text-muted-foreground">Version {p.version}{p.ucodeVersion ? ` · ucode ${p.ucodeVersion} inside` : ""}</p>
                <p className="mt-2 text-[13px]">{p.credit}</p>
              </div>
              <Group footer={p.updateNote || "New versions install by themselves: when the app opens, and every ten minutes while it is open."}>
                <button type="button" className={tapRow} onClick={p.onCheckUpdate}>
                  <span className="flex-1">Check for updates</span> <ChevronRight className="size-3.5 text-muted-foreground" />
                </button>
              </Group>
              <Group footer="Free software under the AGPL-3.0, with no warranty.">
                <button type="button" className={tapRow} onClick={() => openLink("https://github.com/sppideey/ucode-agent")}>
                  <GitBranch className="size-3.5 text-muted-foreground" /> <span className="flex-1">GitHub</span> <ChevronRight className="size-3.5 text-muted-foreground" />
                </button>
                <button type="button" className={tapRow} onClick={() => openLink("https://www.npmjs.com/package/ucode-agent")}>
                  <Package className="size-3.5 text-muted-foreground" /> <span className="flex-1">npm</span> <ChevronRight className="size-3.5 text-muted-foreground" />
                </button>
              </Group>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
