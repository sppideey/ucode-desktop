"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { type ApiError, get, post } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Chat } from "./chat";
import { CommandPalette } from "./command-palette";
import { type ChatMeta, type Event, type Item, type Provider, type State, type View, folderName, sameFolder } from "./data";
import { Home } from "./home";
import { apply, fromTranscript } from "./items";
import { AppsPage, ChatsPage, ProjectPage } from "./lists";
import { Logo } from "./logo";
import { NameDialog } from "./name-dialog";
import { PreviewPanel } from "./preview-panel";
import { ProjectDialog } from "./project-dialog";
import { SettingsDialog } from "./settings-dialog";
import { Sidebar } from "./sidebar";
import { TitleBar } from "./title-bar";

type Plan = { text: string; done?: boolean }[];
type Saved = { role: string; text?: string; count?: number };
type Opened = { title: string; folder: string; items: Saved[]; live: Event[]; busy: boolean };
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
  const [shown, setShown] = useState<{ url: string; name: string } | null>(null);
  const loaded = useRef(new Set<string>()); // chats whose saved conversation is in `items`
  const arriving = useRef(new Map<string, Event[]>()); // events for a chat while it is being fetched
  const viewRef = useRef(view);
  const busyRef = useRef(busyChat);
  const { setTheme } = useTheme();

  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { busyRef.current = busyChat; }, [busyChat]);

  const refresh = useCallback(() => get<State>("state").then(setState).catch(() => {}), []);

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

  const openFolder = (path: string) => post("open", { target: path }).catch((e) => oops(e, "Could not open the folder"));

  const showApp = async (path: string) => {
    try {
      const { url } = await post<{ url: string }>("preview", { target: path });
      setShown({ url, name: folderName(path) });
    } catch (e) {
      oops(e, "Could not open the app");
    }
  };

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
  const chatTitle = chatId ? known[chatId]?.title || saved?.title || firstAsk(chatId) || "New chat" : "";

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

  const place = chatId ? (chatFolder ? folderName(chatFolder) : null) : view.kind === "home" ? folderName(folder) : null;
  const title =
    chatId ? chatTitle
      : view.kind === "chats" ? "Chats"
        : view.kind === "apps" ? "Apps you built"
          : view.kind === "project" ? project?.name ?? folderName(view.path)
            : "New chat";

  const current: ChatMeta | null = chatId
    ? chats.find((c) => c.id === chatId) ?? { id: chatId, title: chatTitle, folder: chatFolder ?? folder, updatedAt: "", createdAt: "", preview: "", turns: 0 }
    : null;

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

  return (
    <div className="flex h-dvh flex-col bg-sidebar">
      <TitleBar
        place={place}
        title={title}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        panelOpen={panelOpen}
        onTogglePanel={chatId ? () => setPanelOpen((v) => !v) : null}
        chatMenu={current && {
          onRename: () => setRenaming({ ...current, title: chatTitle }),
          onDelete: () => setDeleting(current),
          onOpenFolder: chatFolder ? () => openFolder(chatFolder) : null,
        }}
      />
      <div className="flex min-h-0 flex-1">
        {sidebarOpen && (
          <Sidebar
            view={view}
            chats={chats}
            projects={state.projects}
            running={running}
            name={name}
            keys={state.keys}
            onView={go}
            onNewProject={() => setProjectDialog(true)}
            onRemoveProject={removeProject}
            onRenameChat={setRenaming}
            onDeleteChat={setDeleting}
            onOpenFolder={openFolder}
            onSearch={() => setPalette(true)}
            onSettings={() => openSettings()}
          />
        )}
        <main className={cn("flex min-w-0 flex-1 overflow-hidden border-t bg-background", sidebarOpen && "rounded-tl-xl border-l")}>
          <div className="min-w-0 flex-1">
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
                <LoaderCircle className="size-4 animate-spin" /> Opening the chat…
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
            {view.kind === "apps" && (
              <AppsPage
                onView={go}
                onPreview={showApp}
                onShare={(app) => send(`/deploy ${app.name}`, [], { folder: app.folder })}
              />
            )}
            {view.kind === "project" && (
              <ProjectPage
                project={project ?? { path: view.path, name: folderName(view.path), exists: true }}
                chats={chats.filter((c) => sameFolder(c.folder, view.path))}
                onView={go}
                onNotes={() => openSettings("notes", view.path)}
              />
            )}
          </div>
          {chatId && panelOpen && chatFolder && (
            <div className="w-[42%] min-w-[400px] max-w-[680px] border-l">
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
          )}
        </main>
      </div>

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
        version={state.version}
        credit={state.credit}
        onChanged={refresh}
        onLearn={(f) => send("/init", [], { folder: f })}
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
      <AlertDialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent size="sm" className="w-[300px] gap-0 overflow-hidden rounded-2xl bg-popover p-0 shadow-2xl backdrop-blur-xl data-[size=sm]:max-w-[300px]">
          <AlertDialogHeader className="place-items-center gap-1 px-5 pb-4 pt-5 text-center">
            <AlertDialogTitle className="text-[15px] font-semibold">Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-snug text-foreground/80">
              This can&apos;t be undone. The files ucode made stay in their folder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="m-0 grid grid-cols-2 gap-0 divide-x border-t bg-transparent p-0">
            <AlertDialogCancel variant="ghost" className="h-11 rounded-none border-0 text-[15px] font-normal text-primary hover:bg-accent">Cancel</AlertDialogCancel>
            <AlertDialogAction variant="ghost" className="h-11 rounded-none text-[15px] font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { if (deleting) deleteChat(deleting); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={shown !== null} onOpenChange={(v) => !v && setShown(null)}>
        <DialogContent className="flex h-[85vh] max-w-[1100px] flex-col gap-3 p-3 sm:max-w-[1100px]">
          <div className="flex items-center gap-2 pr-9">
            <DialogTitle className="truncate text-[14px]">{shown?.name}</DialogTitle>
            <DialogDescription className="sr-only">Your app, running here so you can click around in it.</DialogDescription>
            <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={() => shown && post("open", { target: shown.url }).catch((e) => oops(e))}>
              <ExternalLink className="size-3.5" /> Open in browser
            </Button>
          </div>
          {shown && (
            <iframe
              src={shown.url}
              title={shown.name}
              className="min-h-0 w-full flex-1 rounded-lg border bg-white"
              sandbox="allow-scripts allow-forms allow-same-origin allow-modals allow-popups"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
