"use client";

import { useState } from "react";
import { BookOpen, ChevronRight, FolderOpen, MessageSquare, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { post } from "@/lib/api";
import { type ChatMeta, type Project, type View, dayOf, folderName, hueOf } from "./data";

const openTarget = (target: string) => post("open", { target }).catch((e) => toast.error(e.message));

/** A page in the iOS way: grouped grey background, a large title, inset lists. */
function Page({ title, wide, children, accessory }: { title: React.ReactNode; wide?: boolean; children: React.ReactNode; accessory?: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto [scrollbar-width:thin]">
      <div className={wide ? "mx-auto max-w-[820px] px-6 pb-10 pt-4" : "mx-auto max-w-[680px] px-6 pb-10 pt-4"}>
        <div className="flex items-center gap-3">
          <h1 className="min-w-0 truncate text-[18px] font-semibold">{title}</h1>
          <div className="ml-auto shrink-0">{accessory}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

const Group = ({ children, label }: { children: React.ReactNode; label?: string }) => (
  <section className="mt-5">
    {label && <h2 className="px-3 pb-1 text-[11px] font-medium text-muted-foreground">{label}</h2>}
    <div className="divide-y divide-border overflow-hidden rounded-xl border bg-card">{children}</div>
  </section>
);

const TextButton = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button onClick={onClick} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] text-primary [&_svg]:size-3.5 transition-opacity hover:opacity-70">{children}</button>
);

function Empty({ icon: Icon, title, text, action, onAction }: { icon: typeof MessageSquare; title: string; text: string; action: string; onAction: () => void }) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <Icon className="size-8 text-muted-foreground/60" strokeWidth={1.5} />
      <h3 className="mt-3 text-[14px] font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-[12.5px] text-muted-foreground">{text}</p>
      <button type="button" className="mt-3 text-[13px] text-primary hover:opacity-70" onClick={onAction}>{action}</button>
    </div>
  );
}

function ChatList({ chats, onView }: { chats: ChatMeta[]; onView: (v: View) => void }) {
  return (
    <>
      {chats.map((c) => (
        <button type="button" key={c.id} onClick={() => onView({ kind: "chat", id: c.id })} className="flex w-full items-center gap-3 px-3 py-1.5 text-left transition-colors hover:bg-accent/60 active:bg-accent">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px]">{c.title}</p>
            <p className="truncate text-[11.5px] text-muted-foreground">{folderName(c.folder)} · {c.turns} message{c.turns === 1 ? "" : "s"}</p>
          </div>
          <span className="shrink-0 text-[11.5px] text-muted-foreground">{dayOf(c.updatedAt)}</span>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
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
    <Page title="Chats" accessory={<TextButton onClick={() => onView({ kind: "home" })}><Plus /> New chat</TextButton>}>
      {chats.length === 0 ? (
        <Empty icon={MessageSquare} title="No chats yet" text="Everything you ask ucode is kept here, so you can pick up any conversation later." action="Start a chat" onAction={() => onView({ kind: "home" })} />
      ) : (
        <>
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              aria-label="Search your chats"
              autoFocus
              className="h-8 w-full rounded-lg bg-accent pl-8 pr-3 text-[13px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
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



/** One project: its folder, its chats, and a new one inside it. */
export function ProjectPage({ project, chats, onView, onNotes }: { project: Project; chats: ChatMeta[]; onView: (v: View) => void; onNotes: () => void }) {
  const row = "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors hover:bg-accent/60 active:bg-accent";
  return (
    <Page title={<span className="flex items-center gap-2"><span className="size-4 shrink-0 rounded-[5px]" style={{ background: `oklch(0.7 0.14 ${hueOf(project.path)})` }} />{project.name}</span>}>
      <p className="mt-0.5 truncate font-mono text-[11.5px] text-muted-foreground" title={project.path}>{project.path}</p>
      <Group>
        <button className={`${row} text-primary`} onClick={() => onView({ kind: "home", folder: project.path })}>
          <Plus className="size-3.5" /> New chat in this project
        </button>
        <button className={row} onClick={() => openTarget(project.path)}>
          <FolderOpen className="size-3.5 text-muted-foreground" /> <span className="flex-1">Open folder</span> <ChevronRight className="size-3.5 text-muted-foreground/60" />
        </button>
        <button className={row} onClick={onNotes}>
          <BookOpen className="size-3.5 text-muted-foreground" /> <span className="flex-1">Project notes</span> <ChevronRight className="size-3.5 text-muted-foreground/60" />
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
