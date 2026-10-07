"use client";

import { FolderOpen, LoaderCircle, PanelLeft, Pencil, Search, Settings, SquarePen, Trash2 } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { type ChatMeta, type Project, type View, dayOf } from "./data";
import { DragStrip, IconButton } from "./title-bar";

type Props = {
  view: View;
  chats: ChatMeta[];
  projects: Project[];
  running: string | null;
  onView: (v: View) => void;
  onNewProject: () => void;
  onRemoveProject: (path: string) => void;
  onRenameChat: (chat: ChatMeta) => void;
  onDeleteChat: (chat: ChatMeta) => void;
  onOpenFolder: (path: string) => void;
  onSearch: () => void;
  onSettings: () => void;
  onToggleSidebar: () => void;
};

const rowClass = (selected: boolean) =>
  cn(
    "group/row flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[12.5px] text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/70",
    selected && "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent",
  );

// Actions on a row: shown on hover or keyboard focus, and always on the selected row.
const actions = (shown: boolean) => cn("hidden shrink-0 items-center group-focus-within/row:flex group-hover/row:flex", shown && "flex");

const Heading = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex h-7 items-center px-2 pt-2">
    <p className="text-[11px] font-medium text-muted-foreground">{children}</p>
    <span className="ml-auto">{action}</span>
  </div>
);

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="ml-auto font-sans text-[11px] font-normal text-muted-foreground/70">{children}</kbd>
);

/** Down the left, from the very top: new chat, search, projects with their chats, then recent chats by day. */
export function Sidebar({ view, chats, running, onView, onRenameChat, onDeleteChat, onOpenFolder, onSearch, onSettings, onToggleSidebar }: Props) {
  // Every chat, newest day first; which folder a chat works in is not the sidebar's business.
  const days = [...new Set(chats.map((c) => dayOf(c.updatedAt)))];
  const activeChat = view.kind === "chat" ? view.id : null;

  // Every chat has its pencil and bin on the row, and the same in a right-click menu.
  const chatRow = (c: ChatMeta, nested = false) => {
    const active = activeChat === c.id;
    return (
      <ContextMenu key={c.id}>
        <ContextMenuTrigger asChild>
          <div className={cn(rowClass(active), "pr-1", nested && "pl-7")}>
            <button type="button" className="flex h-full min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => onView({ kind: "chat", id: c.id })} title={c.title}>
              {running === c.id && <LoaderCircle className="size-3 shrink-0 animate-spin text-primary" aria-label="Working" />}
              <span className="truncate">{c.title}</span>
            </button>
            <span className={actions(active)}>
              <IconButton label="Rename" onClick={() => onRenameChat(c)} className="size-[22px]"><Pencil /></IconButton>
              <IconButton label="Delete" onClick={() => onDeleteChat(c)} className="size-[22px] hover:text-destructive"><Trash2 /></IconButton>
            </span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-40">
          <ContextMenuItem onSelect={() => onRenameChat(c)}><Pencil className="size-3.5" /> Rename</ContextMenuItem>
          <ContextMenuItem onSelect={() => onOpenFolder(c.folder)}><FolderOpen className="size-3.5" /> Open folder</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={() => onDeleteChat(c)}><Trash2 className="size-3.5" /> Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <aside className="m-1.5 mr-0 flex w-60 shrink-0 flex-col overflow-hidden rounded-xl border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[0_1px_3px_rgb(0_0_0/0.08)]">
      <DragStrip className="px-2">
        <IconButton label="Hide sidebar" shortcut="Ctrl+B" onClick={onToggleSidebar}><PanelLeft /></IconButton>
      </DragStrip>

      <nav className="space-y-px px-2 pb-1">
        <button type="button" className={rowClass(view.kind === "home")} onClick={() => onView({ kind: "home" })}>
          <SquarePen className="size-3.5 shrink-0" /> New chat <Kbd>Ctrl N</Kbd>
        </button>
        <button type="button" className={rowClass(false)} onClick={onSearch}>
          <Search className="size-3.5 shrink-0" /> Search <Kbd>Ctrl K</Kbd>
        </button>
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 [scrollbar-width:thin]">
        {days.map((d) => (
          <div key={d} className="space-y-px">
            <Heading>{d}</Heading>
            {chats.filter((c) => dayOf(c.updatedAt) === d).map((c) => chatRow(c))}
          </div>
        ))}
        {chats.length === 0 && <p className="mt-3 px-2 text-[12px] text-muted-foreground">Your chats will show up here.</p>}
      </div>

      <div className="flex h-9 shrink-0 items-center px-2">
        <IconButton label="Settings" shortcut="Ctrl+," onClick={onSettings}><Settings /></IconButton>
      </div>
    </aside>
  );
}
