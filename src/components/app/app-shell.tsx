"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, PanelLeft, PanelRight } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { type ApiError, get, post } from "@/lib/api";
import { type Update, canUpdate, checkForUpdate, installUpdate } from "@/lib/updates";
import { cn } from "@/lib/utils";
import { Chat } from "./chat";
import { CommandPalette } from "./command-palette";
import { type ChatMeta, type Event, type Item, type Provider, type State, type View, folderName, sameFolder } from "./data";
import { Home } from "./home";
import { apply, fromTranscript } from "./items";
import { ChatsPage, ProjectPage } from "./lists";
import { Logo } from "./logo";
import { ConfirmDialog, NameDialog } from "./name-dialog";
import { PreviewPanel } from "./preview-panel";
import { ProjectDialog } from "./project-dialog";
import { SettingsDialog } from "./settings-dialog";
import { Sidebar } from "./sidebar";
import { CLEAR_OF_CONTROLS, DragStrip, IconButton, WindowControls, useInTauri } from "./title-bar";

type Plan = { text: string; done?: boolean }[];
type Saved = { role: string; text?: string; count?: number };
type Opened = { title: string; folder: string; items: Saved[]; live: Event[]; busy: boolean; preview?: string | null };
/** What the window knows about a chat before the saved list does: its folder, its name, when it began here. */
type Known = { title?: string; folder?: string; startedAt?: string };

// A private window can refuse storage; the app works the same without it.
const readLocal = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const writeLocal = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* private window */ } };

const oops = (e: unknown, title?: string) => {
  const err = e as ApiError;
  toast.error(title ?? err.message, { description: title ? err.message : err.fix });
};

/** Asked once, at the first message: a turn can take minutes, and the window may be behind another. */
function askToNotify() {
  try {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
  } catch { /* not offered here */ }
}

function notifyDone(title?: string) {
  try {
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      new Notification("ucode is done", { body: title || "Your request is finished." });
    }
  } catch { /* not offered here */ }
}

/**
 * The events in `arrived` the server had not counted in `live` yet. They overlap where the end
 * of `live` is the start of `arrived`: those came in both ways, so they are left out.
 */
function unseen(live: Event[], arrived: Event[]) {
  const a = arrived.map((e) => JSON.stringify(e));
  const l = live.map((e) => JSON.stringify(e));
  for (let k = Math.min(a.length, l.length); k > 0; k--) {
    if (a.slice(0, k).every((x, i) => x === l[l.length - k + i])) return arrived.slice(k);
  }
  return arrived;
}

/** The whole window: sidebar, conversation, and the app being built beside it - wired to ucode. */
export function AppShell() {
  const [state, setState] = useState<State | null>(null);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState<View>({ kind: "home" });
  const [homeFolder, setHomeFolder] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, Item[]>>({});
  const [spinners, setSpinners] = useState<Record<string, string | null>>({});
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [known, setKnown] = useState<Record<string, Known>>({});
  const [busyChat, setBusyChat] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [mode, setMode] = useState<"build" | "plan">("build");
  const [name, setName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [settings, setSettings] = useState<{ open: boolean; section?: string; folder?: string }>({ open: false });
  const [projectDialog, setProjectDialog] = useState(false);
  const [renaming, setRenaming] = useState<ChatMeta | null>(null);
  const [deleting, setDeleting] = useState<ChatMeta | null>(null);
  const [clearing, setClearing] = useState(false);
  const loaded = useRef(new Set<string>()); // chats whose saved conversation is in `items`
  const arriving = useRef(new Map<string, Event[]>()); // events for a chat while it is being fetched
  const viewRef = useRef(view);
  const busyRef = useRef(busyChat);
  const { setTheme } = useTheme();
  const tauri = useInTauri();

  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { busyRef.current = busyChat; }, [busyChat]);

  const refresh = useCallback(() => get<State>("state").then(setState).catch(() => {}), []);

  // Updates: looked for every ten minutes (the app itself looks the moment it opens), and put on
  // as soon as ucode is not in the middle of a job. The app closes and opens again on the new version.
  const waiting = useRef<Update | null>(null);
  const [updateNote, setUpdateNote] = useState("");
  const putOn = useCallback(async (update: Update) => {
    waiting.current = null;
    setUpdateNote(`Updating to ${update.version}…`);
    toast.loading(`Updating ucode to ${update.version}`, { description: "It opens again by itself in a moment." });
    try {
      await installUpdate(update);
    } catch (e) {
      setUpdateNote(`The update to ${update.version} did not install: ${(e as Error).message}`);
      toast.dismiss();
    }
  }, []);
  const lookForUpdate = useCallback(async (asked = false) => {
    if (!canUpdate()) { if (asked) setUpdateNote("Updates come through the desktop app."); return; }
    if (asked) setUpdateNote("Checking…");
    try {
      const update = await checkForUpdate();
      if (!update) { if (asked) setUpdateNote("You have the newest version."); return; }
      if (busyRef.current) {
        waiting.current = update;
        setUpdateNote(`Version ${update.version} is ready. It goes on when ucode finishes this job.`);
      } else await putOn(update);
    } catch (e) {
      if (asked) setUpdateNote(`Could not check for updates: ${(e as Error).message}`);
    }
  }, [putOn]);
  useEffect(() => {
    const first = setTimeout(() => lookForUpdate(), 90_000);
    const every = setInterval(() => lookForUpdate(), 10 * 60_000);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [lookForUpdate]);
  useEffect(() => {
    if (!busyChat && waiting.current) putOn(waiting.current);
  }, [busyChat, putOn]);

  // Everything the window shows starts here.
  useEffect(() => {
    get<State>("state")
      .then((s) => {
        setState(s);
        setMode(s.mode);
        setBusyChat(s.running);
        setHomeFolder((f) => f ?? s.defaultFolder);
      })
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  // Your name and colour live in this window, not in ucode. ?theme= is for screenshots.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read after the first render, to match the page built ahead of time
    setName(readLocal("ucode-name") ?? "");
    // An iOS system colour, as "#rrggbb". An older number (a hue) is ignored.
    const accent = readLocal("ucode-accent");
    if (accent && /^#[0-9a-f]{6}$/i.test(accent)) document.documentElement.style.setProperty("--brand", accent);
    const theme = new URLSearchParams(window.location.search).get("theme");
    if (theme === "light" || theme === "dark") setTheme(theme);
  }, [setTheme]);

  /** One event from ucode. Stored even for a chat not on screen, or not yet known. */
  const onEvent = useCallback((e: Event) => {
    const chat = e.chat;
    if (typeof chat !== "string" || chat.startsWith("settings:")) return; // a settings page's helper, not a chat
    setItems((all) => ({ ...all, [chat]: apply(all[chat] ?? [], e) }));
    arriving.current.get(chat)?.push(e);
    switch (e.type) {
      case "user":
        // The server sends this first in every turn, before anything else happens.
        setBusyChat(chat);
        setPlans((all) => ({ ...all, [chat]: [] }));
        break;
      case "turnStart":
        setBusyChat(chat);
        break;
      case "spinner":
        setSpinners((all) => ({ ...all, [chat]: typeof e.text === "string" ? e.text : null }));
        break;
      case "plan":
        setPlans((all) => ({ ...all, [chat]: Array.isArray(e.items) ? (e.items as Plan) : [] }));
        break;
      case "preview":
        if (typeof e.url === "string") {
          setPreviews((all) => ({ ...all, [chat]: e.url as string }));
          const v = viewRef.current;
          if (v.kind === "chat" && v.id === chat) setPanelOpen(true);
        }
        break;
      case "idle":
        setBusyChat((b) => (b === chat ? null : b));
        setSpinners((all) => ({ ...all, [chat]: null }));
        // Stopped mid-sentence: what was written stays, as a finished reply.
        setItems((all) => ({ ...all, [chat]: (all[chat] ?? []).map((i) => (i.kind === "reply" && i.streaming ? { ...i, streaming: false } : i)) }));
        if (typeof e.title === "string" && e.title) setKnown((all) => ({ ...all, [chat]: { ...all[chat], title: e.title as string } }));
        setVersion((n) => n + 1);
        refresh();
        notifyDone(typeof e.title === "string" ? e.title : undefined);
        break;
    }
  }, [refresh]);

  // One stream of events for every chat.
  useEffect(() => {
    const es = new EventSource("/api/events");
    let opened = false;
    es.onopen = () => {
      // Back after a drop: a turn may have ended unseen, so ask what is running now.
      if (opened) get<State>("state").then((s) => { setState(s); setBusyChat(s.running); }).catch(() => {});
      opened = true;
    };
    es.onmessage = (m) => {
      let e: Event;
      try { e = JSON.parse(m.data); } catch { return; }
      onEvent(e);
    };
    return () => es.close();
  }, [onEvent, refresh]);

  const go = useCallback((v: View) => {
    if (v.kind === "home" && v.folder) setHomeFolder(v.folder);
    setView(v);
  }, []);

  // A chat opened for the first time: what was said, plus the turn still running in it.
  useEffect(() => {
    if (view.kind !== "chat" || loaded.current.has(view.id)) return;
    const id = view.id;
    loaded.current.add(id);
    setOpening(id);
    const arrived: Event[] = [];
    arriving.current.set(id, arrived);
    get<Opened>("chat", { id })
      .then((r) => {
        arriving.current.delete(id);
        const live = r.live ?? [];
        let saved = r.items ?? [];
        // A running turn's request is in both the saved chat and its events: show it once.
        const asked = live.find((e) => e.type === "user");
        if (asked) {
          const at = saved.map((m) => m.role === "user" && m.text === asked.text).lastIndexOf(true);
          if (at >= 0) saved = saved.slice(0, at);
        }
        // Events that came while this was asked for, and the server's answer did not count yet.
        const late = r.busy ? unseen(live, arrived) : arrived.slice(arrived.map((e) => e.type).lastIndexOf("idle") + 1);
        const events = [...live, ...late];
        let list = fromTranscript(saved);
        for (const e of events) list = apply(list, e);
        setItems((all) => ({ ...all, [id]: list }));
        setKnown((all) => ({ ...all, [id]: { ...all[id], title: r.title, folder: r.folder } }));
        const last = (type: string) => events.filter((e) => e.type === type).at(-1);
        const spin = last("spinner");
        const plan = last("plan");
        const shownUrl = last("preview");
        // Still running, unless its end came in while this was being fetched.
        if (r.busy && !late.some((e) => e.type === "idle")) {
          setBusyChat(id);
          if (spin) setSpinners((all) => ({ ...all, [id]: typeof spin.text === "string" ? spin.text : null }));
          if (plan && Array.isArray(plan.items)) setPlans((all) => ({ ...all, [id]: plan.items as Plan }));
        }
        if (shownUrl && typeof shownUrl.url === "string") setPreviews((all) => ({ ...all, [id]: shownUrl.url as string }));
        // An earlier chat's app, from its folder, unless this window already shows one.
        else if (r.preview) setPreviews((all) => (all[id] ? all : { ...all, [id]: r.preview as string }));
      })
      .catch((e) => {
        arriving.current.delete(id);
        loaded.current.delete(id);
        oops(e, "Could not open that chat");
        setView({ kind: "home" });
      })
      .finally(() => setOpening((o) => (o === id ? null : o)));
  }, [view]);

  const openSettings = useCallback((section?: string, folder?: string) => setSettings({ open: true, section, folder }), []);

  /** A message to ucode: into a chat, or a new chat in a folder. A few commands are the window's own. */
  const send = async (text: string, files: string[], to: { chat?: string; folder?: string }) => {
    const said = text.trim();
    const [cmd, ...rest] = said.split(/\s+/);
    switch (cmd.toLowerCase()) {
      case "/new": go({ kind: "home" }); return;
      case "/resume": go({ kind: "chats" }); return;
      case "/clear": return; // the window has no screen to clear
      case "/model": if (!rest.length) { openSettings("models"); return; } break;
    }
    askToNotify();
    try {
      const r = await post<{ chat: string }>("send", { chat: to.chat, folder: to.chat ? undefined : to.folder, text: said, files });
      if (!to.chat) {
        // A new chat has nothing saved yet: its events are all there is.
        loaded.current.add(r.chat);
        setKnown((all) => ({ ...all, [r.chat]: { ...all[r.chat], folder: to.folder ?? state?.defaultFolder, startedAt: new Date().toISOString() } }));
        setView({ kind: "chat", id: r.chat });
      }
    } catch (e) {
      oops(e);
    }
  };

  const stop = (chat: string) => post("stop", { chat }).catch((e) => oops(e));

  const undo = async (chat: string) => {
    try {
      const r = await post<{ lines?: string[] }>("undo", { chat, turns: 1 });
      toast(r.lines?.join(" ").trim() || "Done");
    } catch (e) {
      oops(e);
    }
    setVersion((n) => n + 1);
  };

  const changeModel = async (id: string) => {
    setState((s) => s && { ...s, model: id });
    try {
      const r = await post<{ model: string; ready: boolean }>("model", { id });
      if (!r.ready) toast("This model needs its key", { description: "Add it in Settings, under Keys." });
    } catch (e) {
      oops(e);
    }
    refresh();
  };

  const changeProvider = async (provider: Provider) => {
    setState((s) => s && { ...s, provider });
    try {
      await post("provider", { provider });
    } catch (e) {
      oops(e, "Could not switch");
    }
    refresh();
  };

  const saveName = (n: string) => {
    setName(n);
    writeLocal("ucode-name", n);
  };

  const removeProject = async (path: string) => {
    try {
      await post("projects", { remove: path });
      toast("Taken off the list", { description: "The folder and its files are still there." });
      if (sameFolder(homeFolder, path)) setHomeFolder(state?.defaultFolder ?? null);
      if (view.kind === "project" && sameFolder(view.path, path)) go({ kind: "home" });
    } catch (e) {
      oops(e);
    }
    refresh();
  };

  const deleteChat = async (chat: ChatMeta) => {
    try {
      await post("chat/delete", { chat: chat.id });
      loaded.current.delete(chat.id);
      setItems(({ [chat.id]: _gone, ...rest }) => rest);
      setKnown(({ [chat.id]: _gone, ...rest }) => rest);
      if (view.kind === "chat" && view.id === chat.id) go({ kind: "home" });
      toast("Chat deleted");
    } catch (e) {
      oops(e, "Could not delete it");
    }
    refresh();
  };

  const renameChat = async (chat: ChatMeta, title: string) => {
    try {
      await post("chat/rename", { chat: chat.id, title });
      setKnown((all) => ({ ...all, [chat.id]: { ...all[chat.id], title } }));
    } catch (e) {
      oops(e, "Could not rename it");
    }
    refresh();
  };

  /** Every chat gone: the server's, and what this window kept of them. Projects and files stay. */
  const clearChats = async () => {
    try {
      await post("chats/clear");
      loaded.current.clear();
      setItems({});
      setKnown({});
      setPlans({});
      setSpinners({});
      setPreviews({});
      setSettings((s) => ({ ...s, open: false }));
      go({ kind: "home" });
      toast("All chats cleared");
    } catch (e) {
      oops(e, "Could not clear them");
    }
    refresh();
  };

  const openFolder = (path: string) => post("open", { target: path }).catch((e) => oops(e, "Could not open the folder"));


  // Keys for the whole window. Esc stops the turn on screen, unless it is closing a menu or a box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const v = viewRef.current;
        if (e.defaultPrevented || !busyRef.current || v.kind !== "chat" || v.id !== busyRef.current) return;
        if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [data-radix-popper-content-wrapper]')) return;
        e.preventDefault();
        post("stop", { chat: busyRef.current }).catch(() => {});
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "k") { e.preventDefault(); setPalette((v) => !v); }
      else if (key === "b") { e.preventDefault(); setSidebarOpen((v) => !v); }
      else if (key === ",") { e.preventDefault(); setSettings({ open: true }); }
      else if (key === "n") { e.preventDefault(); go({ kind: "home" }); }
      else if (key === "p" && viewRef.current.kind === "chat") { e.preventDefault(); setPanelOpen((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (!state) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <Logo className="size-10 rounded-xl text-xl" />
        {loadError ? (
          <>
            <p className="text-[15px] font-medium">ucode is not answering</p>
            <p className="max-w-sm text-[13px] text-muted-foreground">{loadError}. Close this window and open ucode again (in a terminal: ucode app).</p>
          </>
        ) : (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Starting ucode…</p>
        )}
      </div>
    );
  }

  const provider: Provider = state.provider ?? state.models.find((m) => m.id === state.model)?.via ?? "google";
  const folder = homeFolder ?? state.defaultFolder;
  const chatId = view.kind === "chat" ? view.id : null;
  const saved = chatId ? state.chats.find((c) => c.id === chatId) : undefined;
  const chatFolder = chatId ? known[chatId]?.folder ?? saved?.folder : undefined;
  const firstAsk = (id: string) => {
    const asked = (items[id] ?? []).find((i) => i.kind === "user");
    return asked?.kind === "user" ? asked.text.slice(0, 60) : undefined;
  };

  // A chat started here is listed at once, before ucode has saved it.
  const fresh: ChatMeta[] = Object.entries(known)
    .filter(([id, k]) => k.startedAt && !state.chats.some((c) => c.id === id))
    .map(([id, k]) => ({
      id, title: k.title || firstAsk(id) || "New chat",
      folder: k.folder ?? state.defaultFolder, updatedAt: k.startedAt!, createdAt: k.startedAt!, preview: "", turns: 1,
    }));
  const chats = [...fresh, ...state.chats];
  const running = busyChat ?? state.running;
  const project = view.kind === "project" ? state.projects.find((p) => sameFolder(p.path, view.path)) : undefined;

  const panelShown = !!(chatId && panelOpen && chatFolder);
  const previewToggle = chatId && (
    <IconButton label={panelOpen ? "Hide preview" : "Show preview"} shortcut="Ctrl+P" active={panelOpen} onClick={() => setPanelOpen((v) => !v)} className="ml-auto">
      <PanelRight />
    </IconButton>
  );

  const picker = {
    models: state.models,
    model: state.model,
    onModel: changeModel,
    mode,
    onMode: setMode,
    onKeys: () => openSettings("keys"),
    provider,
    onProvider: changeProvider,
    keys: state.keys,
  };

  // No header: the sidebar and the work area both run to the top. Their top 32px move the window,
  // and the window buttons float in the top-right corner.
  return (
    <div className="flex h-dvh bg-sidebar text-[13px]">
      {sidebarOpen && (
        <Sidebar
          view={view}
          chats={chats}
          projects={state.projects}
          running={running}
          onView={go}
          onNewProject={() => setProjectDialog(true)}
          onRemoveProject={removeProject}
          onRenameChat={setRenaming}
          onDeleteChat={setDeleting}
          onOpenFolder={openFolder}
          onSearch={() => setPalette(true)}
          onSettings={() => openSettings()}
          onToggleSidebar={() => setSidebarOpen(false)}
        />
      )}
      <main className={cn("flex min-w-0 flex-1 overflow-hidden bg-background", sidebarOpen && "border-l border-sidebar-border")}>
        {/* The chat and the preview split the area right of the sidebar exactly in half. */}
        <section className="flex min-w-0 flex-1 basis-0 flex-col">
          <DragStrip className={cn("px-2", tauri && !panelShown && CLEAR_OF_CONTROLS)}>
            {!sidebarOpen && (
              <IconButton label="Show sidebar" shortcut="Ctrl+B" onClick={() => setSidebarOpen(true)}><PanelLeft /></IconButton>
            )}
            {!panelShown && previewToggle}
          </DragStrip>
          <div className="min-h-0 min-w-0 flex-1">
            {view.kind === "home" && (
              <Home
                folder={folder}
                defaultFolder={state.defaultFolder}
                projects={state.projects}
                onFolder={setHomeFolder}
                onOpenFolder={() => setProjectDialog(true)}
                onStart={(text, files) => send(text, files, { folder })}
                name={name}
                {...picker}
              />
            )}
            {chatId && (opening === chatId ? (
              <div className="flex h-full items-center justify-center gap-2 text-[13px] text-muted-foreground">
                <LoaderCircle className="size-3.5 animate-spin" /> Opening the chat…
              </div>
            ) : (
              <Chat
                key={chatId}
                items={items[chatId] ?? []}
                spinner={spinners[chatId] ?? null}
                busy={busyChat === chatId}
                plan={plans[chatId] ?? []}
                onSend={(text, files) => send(text, files, { chat: chatId })}
                onStop={() => stop(chatId)}
                onUndo={() => undo(chatId)}
                {...picker}
              />
            ))}
            {view.kind === "chats" && <ChatsPage chats={chats} onView={go} />}
            {view.kind === "project" && (
              <ProjectPage
                project={project ?? { path: view.path, name: folderName(view.path), exists: true }}
                chats={chats.filter((c) => sameFolder(c.folder, view.path))}
                onView={go}
                onNotes={() => openSettings("notes", view.path)}
              />
            )}
          </div>
        </section>
        {panelShown && chatId && chatFolder && (
          <section className="flex min-w-0 flex-1 basis-0 flex-col border-l bg-panel">
            <DragStrip className={cn("px-2", tauri && CLEAR_OF_CONTROLS)}>{previewToggle}</DragStrip>
            <div className="min-h-0 flex-1">
              <PreviewPanel
                key={chatId}
                chat={chatId}
                folder={chatFolder}
                preview={previews[chatId] ?? null}
                busy={busyChat === chatId}
                version={version}
                onClose={() => setPanelOpen(false)}
                onSend={(text) => send(text, [], { chat: chatId })}
              />
            </div>
          </section>
        )}
      </main>
      <WindowControls />

      <CommandPalette
        open={palette}
        onOpenChange={setPalette}
        chats={chats}
        projects={state.projects}
        onView={go}
        onNewProject={() => setProjectDialog(true)}
        onSettings={(section) => openSettings(section)}
      />
      <SettingsDialog
        open={settings.open}
        section={settings.section}
        onOpenChange={(open) => setSettings((s) => ({ ...s, open }))}
        models={state.models}
        model={state.model}
        onModel={changeModel}
        provider={provider}
        onProvider={changeProvider}
        keys={state.keys}
        folder={settings.folder ?? chatFolder ?? folder}
        projects={state.projects}
        defaultFolder={state.defaultFolder}
        name={name}
        onName={saveName}
        version={state.appVersion ?? state.version}
        ucodeVersion={state.ucodeVersion}
        updateNote={updateNote}
        onCheckUpdate={() => lookForUpdate(true)}
        credit={state.credit}
        onChanged={refresh}
        onLearn={(f) => send("/init", [], { folder: f })}
        onClearChats={() => setClearing(true)}
      />
      <ProjectDialog
        open={projectDialog}
        onOpenChange={setProjectDialog}
        onDone={(path) => {
          refresh();
          go({ kind: "home", folder: path });
          toast.success(`${folderName(path)} is ready`, { description: "New chats here work on its files." });
        }}
      />
      <NameDialog
        open={renaming !== null}
        onOpenChange={(v) => !v && setRenaming(null)}
        title="Rename chat"
        description="Give this chat a name you will recognise."
        initial={renaming?.title ?? ""}
        action="Rename"
        onSave={(title) => { if (renaming) renameChat(renaming, title); }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Delete this chat?"
        description="This can't be undone. The files ucode made stay in their folder."
        action="Delete"
        onConfirm={() => { if (deleting) deleteChat(deleting); }}
      />
      <ConfirmDialog
        open={clearing}
        onOpenChange={setClearing}
        title="Delete every chat?"
        description="This can't be undone. Your projects and the files ucode made stay."
        action="Delete all"
        onConfirm={clearChats}
      />
    </div>
  );
}
