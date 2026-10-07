"use client";

import { useState } from "react";
import {
  ChevronRight, Ellipsis, FolderOpen, LayoutGrid, LoaderCircle, MessageSquare, Moon, Pencil, Plus, Search, Settings, Sun, Trash2, X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { type ChatMeta, type Keys, type Project, type View, dayOf, hueOf, sameFolder } from "./data";

type Props = {
  view: View;
  chats: ChatMeta[];
  projects: Project[];
  running: string | null;
  name: string;
  keys: Keys;
  onView: (v: View) => void;
  onNewProject: () => void;
  onRemoveProject: (path: string) => void;
  onRenameChat: (chat: ChatMeta) => void;
  onDeleteChat: (chat: ChatMeta) => void;
  onOpenFolder: (path: string) => void;
  onSearch: () => void;
  onSettings: () => void;
};

const rowClass = (selected: boolean) =>
  cn(
    "group/row flex h-8 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13px] text-sidebar-foreground/90 transition-colors hover:bg-sidebar-accent/60",
    selected && "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent",
  );

const Heading = ({ children }: { children: React.ReactNode }) => (
  <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>
);

const menuItem = "py-1.5 text-[13px]";

/** Projects and chats down the left. */
export function Sidebar({ view, chats, projects, running, name, keys, onView, onNewProject, onRemoveProject, onRenameChat, onDeleteChat, onOpenFolder, onSearch, onSettings }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { resolvedTheme, setTheme } = useTheme();
  const inProject = (c: ChatMeta) => projects.some((p) => sameFolder(p.path, c.folder));
  const loose = chats.filter((c) => !inProject(c));
  const days = [...new Set(loose.map((c) => dayOf(c.updatedAt)))];
  const activeChat = view.kind === "chat" ? view.id : null;
  const keyText = [keys.google && "Google", keys.openrouter && "OpenRouter"].filter(Boolean).join(" + ") || "No key yet";

  // Every chat has its options in three places: the "..." on the row, a right-click, and the top bar.
  const chatRow = (c: ChatMeta) => {
    const active = activeChat === c.id;
    return (
      <ContextMenu key={c.id}>
        <ContextMenuTrigger asChild>
          <div className={cn(rowClass(active), "pr-1")}>
            <button className="flex h-full min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => onView({ kind: "chat", id: c.id })} title={c.title}>
              {running === c.id && <LoaderCircle className="size-3 shrink-0 animate-spin text-primary" />}
              <span className="truncate">{c.title}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-sidebar-border hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100",
                    active && "opacity-100",
                  )}
                  aria-label={`Options for ${c.title}`}
                  title="Rename or delete"
                >
                  <Ellipsis className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 rounded-xl p-1 backdrop-blur-xl">
                <DropdownMenuItem className={menuItem} onSelect={() => onRenameChat(c)}><Pencil /> Rename</DropdownMenuItem>
                <DropdownMenuItem className={menuItem} onSelect={() => onOpenFolder(c.folder)}><FolderOpen /> Open folder</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className={menuItem} variant="destructive" onSelect={() => onDeleteChat(c)}><Trash2 /> Delete chat</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => onRenameChat(c)}><Pencil /> Rename</ContextMenuItem>
          <ContextMenuItem onSelect={() => onOpenFolder(c.folder)}><FolderOpen /> Open folder</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={() => onDeleteChat(c)}><Trash2 /> Delete chat</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col pb-2">
      <div className="space-y-0.5 px-2.5 pt-1">
        <button onClick={onSearch} className="mb-2 flex h-8 w-full items-center gap-1.5 rounded-[10px] bg-sidebar-accent px-2.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-sidebar-accent/80">
          <Search className="size-4" strokeWidth={2} /> Search
          <kbd className="ml-auto font-sans text-[11px] text-muted-foreground/80">Ctrl K</kbd>
        </button>
        <button className={rowClass(view.kind === "home")} onClick={() => onView({ kind: "home" })}>
          <Plus className="size-[18px] text-primary" strokeWidth={2.25} /> New chat
          <span className="ml-auto text-[11px] font-normal text-muted-foreground/80">Ctrl N</span>
        </button>
        <button className={rowClass(view.kind === "chats")} onClick={() => onView({ kind: "chats" })}>
          <MessageSquare className="size-4 text-primary" strokeWidth={1.9} /> Chats
        </button>
        <button className={rowClass(view.kind === "apps")} onClick={() => onView({ kind: "apps" })}>
          <LayoutGrid className="size-4 text-primary" strokeWidth={1.9} /> Apps you built
        </button>
      </div>

      <ScrollArea className="mt-5 min-h-0 flex-1 px-2.5">
        <div className="flex items-center pr-1">
          <Heading>Projects</Heading>
          <button onClick={onNewProject} className="mb-1 ml-auto grid size-6 place-items-center rounded-md text-primary hover:bg-sidebar-accent" aria-label="New project" title="Open a folder or start a project">
            <Plus className="size-4" />
          </button>
        </div>
        {projects.length === 0 && (
          <button onClick={onNewProject} className={cn(rowClass(false), "text-muted-foreground")}>
            <FolderOpen className="size-4" /> Open a folder to work on
          </button>
        )}
        {projects.map((p) => {
          const inside = chats.filter((c) => sameFolder(p.path, c.folder));
          const isOpen = open[p.path] ?? true;
          return (
            <Collapsible key={p.path} open={isOpen} onOpenChange={(v) => setOpen((s) => ({ ...s, [p.path]: v }))}>
              <div className={cn(rowClass(view.kind === "project" && sameFolder(view.path, p.path)), "gap-1.5 pl-1 pr-1")}>
                <CollapsibleTrigger asChild>
                  <button className="grid size-5 shrink-0 place-items-center rounded" aria-label={isOpen ? "Hide its chats" : "Show its chats"}>
                    <ChevronRight className={cn("size-3.5 opacity-50 transition-transform", isOpen && "rotate-90")} />
                  </button>
                </CollapsibleTrigger>
                <button className="flex h-full min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onView({ kind: "project", path: p.path })} title={p.path}>
                  <span className="size-3.5 shrink-0 rounded-[4px]" style={{ background: `oklch(0.7 0.14 ${hueOf(p.path)})` }} />
                  <span className={cn("truncate", !p.exists && "line-through opacity-60")}>{p.name}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground group-hover/row:hidden">{inside.length || ""}</span>
                </button>
                <button onClick={() => onRemoveProject(p.path)} className="hidden size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-border hover:text-foreground group-hover/row:grid" aria-label="Take off the list" title="Take off the list (the folder stays)">
                  <X className="size-3.5" />
                </button>
              </div>
              <CollapsibleContent>
                <div className="ml-[18px] border-l border-sidebar-border pl-1.5">
                  {inside.length === 0 && <p className="px-2.5 py-1.5 text-[12px] text-muted-foreground">No chats yet</p>}
                  {inside.slice(0, 12).map(chatRow)}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        {days.map((d) => (
          <div key={d} className="mt-5">
            <Heading>{d}</Heading>
            {loose.filter((c) => dayOf(c.updatedAt) === d).map(chatRow)}
          </div>
        ))}
        {chats.length === 0 && <p className="mt-5 px-2.5 text-[12px] leading-relaxed text-muted-foreground">Your chats will show up here.</p>}
      </ScrollArea>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="mx-2.5 mt-2 flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent/60 data-[state=open]:bg-sidebar-accent">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#a1a1a6] to-[#8e8e93] text-[11px] font-semibold text-white">
              {(name || "You").slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-medium">{name || "You"}</span>
              <span className="block truncate text-[11px] text-muted-foreground">Free · {keyText}</span>
            </span>
            <Settings className="ml-auto size-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56 rounded-xl p-1 backdrop-blur-xl">
          <DropdownMenuItem className={menuItem} onSelect={onSettings}><Settings /> Settings <span className="ml-auto text-[11px] text-muted-foreground">Ctrl ,</span></DropdownMenuItem>
          <DropdownMenuItem className={menuItem} onSelect={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}>
            {resolvedTheme === "light" ? <Moon /> : <Sun />} {resolvedTheme === "light" ? "Dark" : "Light"} mode
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  );
}
