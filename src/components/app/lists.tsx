"use client";

import { useEffect, useState } from "react";
import { AppWindow, BookOpen, ChevronRight, FolderOpen, Globe, LayoutGrid, MessageSquare, Ellipsis, Package, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { get, post } from "@/lib/api";
import { type ChatMeta, type Project, type View, dayOf, folderName, hueOf } from "./data";

const openTarget = (target: string) => post("open", { target }).catch((e) => toast.error(e.message));

/** A page in the iOS way: grouped grey background, a large title, inset lists. */
function Page({ title, wide, children, accessory }: { title: React.ReactNode; wide?: boolean; children: React.ReactNode; accessory?: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto bg-panel">
      <div className={wide ? "mx-auto max-w-[860px] px-6 pb-12 pt-8" : "mx-auto max-w-[720px] px-6 pb-12 pt-8"}>
        <div className="flex items-center gap-3">
          <h1 className="min-w-0 truncate text-[28px] font-bold tracking-tight">{title}</h1>
          <div className="ml-auto shrink-0">{accessory}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

const Group = ({ children, label }: { children: React.ReactNode; label?: string }) => (
  <section className="mt-6">
    {label && <h2 className="px-4 pb-1.5 text-[12px] font-normal uppercase tracking-wide text-muted-foreground">{label}</h2>}
    <div className="divide-y divide-border overflow-hidden rounded-xl bg-card">{children}</div>
  </section>
);

const TextButton = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button onClick={onClick} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[15px] text-primary transition-opacity hover:opacity-70">{children}</button>
);

function Empty({ icon: Icon, title, text, action, onAction }: { icon: typeof MessageSquare; title: string; text: string; action: string; onAction: () => void }) {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <Icon className="size-10 text-muted-foreground/60" strokeWidth={1.5} />
      <h3 className="mt-4 text-[17px] font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{text}</p>
      <button className="mt-4 text-[15px] text-primary hover:opacity-70" onClick={onAction}>{action}</button>
    </div>
  );
}

function ChatList({ chats, onView }: { chats: ChatMeta[]; onView: (v: View) => void }) {
  return (
    <>
      {chats.map((c) => (
        <button key={c.id} onClick={() => onView({ kind: "chat", id: c.id })} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/60 active:bg-accent">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px]">{c.title}</p>
            <p className="truncate text-[12px] text-muted-foreground">{folderName(c.folder)} · {c.turns} message{c.turns === 1 ? "" : "s"}</p>
          </div>
          <span className="shrink-0 text-[13px] text-muted-foreground">{dayOf(c.updatedAt)}</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
        </button>
      ))}
    </>
  );
}

/** Every chat, searchable. */
export function ChatsPage({ chats, onView }: { chats: ChatMeta[]; onView: (v: View) => void }) {
  const [q, setQ] = useState("");
  const shown = chats.filter((c) => `${c.title} ${c.preview} ${c.folder}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Page title="Chats" accessory={<TextButton onClick={() => onView({ kind: "home" })}><Plus className="size-4" /> New chat</TextButton>}>
      {chats.length === 0 ? (
        <Empty icon={MessageSquare} title="No chats yet" text="Everything you ask ucode is kept here, so you can pick up any conversation later." action="Start a chat" onAction={() => onView({ kind: "home" })} />
      ) : (
        <>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              aria-label="Search your chats"
              autoFocus
              className="h-9 w-full rounded-[10px] bg-accent pl-8 pr-3 text-[15px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {shown.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-muted-foreground">No chats match &ldquo;{q}&rdquo;.</p>
          ) : (
            <Group label={`${shown.length} chat${shown.length === 1 ? "" : "s"}`}><ChatList chats={shown} onView={onView} /></Group>
          )}
        </>
      )}
    </Page>
  );
}

type App = { name: string; path: string; folder: string; at: number; page: boolean };

/** The apps ucode has made: open one, share it, or keep working on it. */
export function AppsPage({ onView, onPreview, onShare }: { onView: (v: View) => void; onPreview: (path: string) => void; onShare: (app: App) => void }) {
  const [apps, setApps] = useState<App[] | null>(null);
  useEffect(() => { get("apps").then((r) => setApps(r.apps)).catch(() => setApps([])); }, []);
  const pill = "h-7 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/15";
  return (
    <Page title="Apps you built" wide>
      {apps && apps.length === 0 && (
        <Empty icon={LayoutGrid} title="No apps yet" text="When ucode builds something, it lands here. Open it, share it online, or keep working on it." action="Build your first app" onAction={() => onView({ kind: "home" })} />
      )}
      {apps && apps.length > 0 && (
        <Group>
          {apps.map((a) => (
            <div key={a.path} className="flex items-center gap-3 px-4 py-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-[10px] text-white" style={{ background: `oklch(0.65 0.14 ${hueOf(a.path)})` }}>
                {a.page ? <AppWindow className="size-5" /> : <Package className="size-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{a.name}</p>
                <p className="truncate text-[12px] text-muted-foreground">{dayOf(a.at)} · {folderName(a.folder)}</p>
              </div>
              {a.page && <button className={pill} onClick={() => onPreview(a.path)}>Open</button>}
              <button className={pill} onClick={() => onShare(a)}>Share</button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-primary transition-colors hover:bg-primary/15" aria-label={`More for ${a.name}`}>
                    <Ellipsis className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-xl p-1 backdrop-blur-xl">
                  <DropdownMenuItem className="py-1.5 text-[13px]" onSelect={() => onShare(a)}><Globe /> Share online</DropdownMenuItem>
                  <DropdownMenuItem className="py-1.5 text-[13px]" onSelect={() => onView({ kind: "home", folder: a.path })}><MessageSquare /> Keep working on it</DropdownMenuItem>
                  <DropdownMenuItem className="py-1.5 text-[13px]" onSelect={() => openTarget(a.path)}><FolderOpen /> Open folder</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </Group>
      )}
    </Page>
  );
}

/** One project: its folder, its chats, and a new one inside it. */
export function ProjectPage({ project, chats, onView, onNotes }: { project: Project; chats: ChatMeta[]; onView: (v: View) => void; onNotes: () => void }) {
  const row = "flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] transition-colors hover:bg-accent/60 active:bg-accent";
  return (
    <Page title={<span className="flex items-center gap-3"><span className="size-6 shrink-0 rounded-[7px]" style={{ background: `oklch(0.7 0.14 ${hueOf(project.path)})` }} />{project.name}</span>}>
      <p className="mt-1 truncate font-mono text-[12px] text-muted-foreground" title={project.path}>{project.path}</p>
      <Group>
        <button className={`${row} text-primary`} onClick={() => onView({ kind: "home", folder: project.path })}>
          <Plus className="size-[18px]" /> New chat in this project
        </button>
        <button className={row} onClick={() => openTarget(project.path)}>
          <FolderOpen className="size-[18px] text-muted-foreground" /> <span className="flex-1">Open folder</span> <ChevronRight className="size-4 text-muted-foreground/60" />
        </button>
        <button className={row} onClick={onNotes}>
          <BookOpen className="size-[18px] text-muted-foreground" /> <span className="flex-1">Project notes</span> <ChevronRight className="size-4 text-muted-foreground/60" />
        </button>
      </Group>
      {chats.length === 0 ? (
        <Empty icon={MessageSquare} title="Nothing here yet" text="Chats in this project work on its folder and share its notes." action="New chat in this project" onAction={() => onView({ kind: "home", folder: project.path })} />
      ) : (
        <Group label="Chats"><ChatList chats={chats} onView={onView} /></Group>
      )}
    </Page>
  );
}
