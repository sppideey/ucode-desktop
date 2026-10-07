"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronRight, Copy, FolderClosed, FolderOpen, Minus, Moon, PanelLeft, PanelRight, Pencil, Square, Sun, Trash2, X } from "lucide-react";
import { useTheme } from "next-themes";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

/** The bits of Tauri's window API this bar uses (window.__TAURI__, with withGlobalTauri on). */
type TauriWindow = {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  startDragging(): Promise<void>;
  onResized(handler: () => void): Promise<() => void>;
};

const tauriWindow = (): TauriWindow | null => {
  try {
    return (window as unknown as { __TAURI__?: { window?: { getCurrentWindow?: () => TauriWindow } } }).__TAURI__?.window?.getCurrentWindow?.() ?? null;
  } catch {
    return null;
  }
};

/** Runs one window call; the API may be missing or refuse, and the bar just carries on. */
const withWindow = (fn: (w: TauriWindow) => Promise<unknown>) => {
  try {
    const w = tauriWindow();
    if (w) fn(w).catch(() => {});
  } catch { /* not in the desktop app */ }
};

const noSubscribe = () => () => {};
/** True inside the desktop app (a frameless Tauri window), false in a browser window. */
const useInTauri = () => useSyncExternalStore(noSubscribe, () => "__TAURI__" in window, () => false);

export type ChatMenu = { onRename: () => void; onDelete: () => void; onOpenFolder: (() => void) | null };

type Props = {
  place: string | null;
  title: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  panelOpen: boolean;
  onTogglePanel: (() => void) | null;
  chatMenu: ChatMenu | null;
};

const iconButton = "grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-[17px]";

/**
 * The one bar at the top. In the desktop app it is the window's title bar too: drag it to move the
 * window, double-click it to maximise, and the window buttons sit on the right. In a browser window
 * the browser's own bar shows the name, so this one stays slim.
 */
export function TitleBar({ place, title, sidebarOpen, onToggleSidebar, panelOpen, onTogglePanel, chatMenu }: Props) {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  const tauri = useInTauri();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!tauri) return;
    const w = tauriWindow();
    if (!w) return;
    let gone = false;
    let off: (() => void) | undefined;
    const check = () => { w.isMaximized().then((m) => { if (!gone) setMaximized(m); }).catch(() => {}); };
    check();
    try {
      w.onResized(check).then((u) => { if (gone) u(); else off = u; }).catch(() => {});
    } catch { /* no events here */ }
    return () => { gone = true; off?.(); };
  }, [tauri]);

  // Tauri's own script moves the window for elements marked data-tauri-drag-region. Anything else
  // that is not a control (an icon, a gap) is handled here, the same way: one press drags, two maximise.
  const onMouseDown = (e: React.MouseEvent) => {
    if (!tauri || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.hasAttribute("data-tauri-drag-region") || target.closest("button, a, input, [role=button], [role=menuitem]")) return;
    withWindow((w) => (e.detail === 2 ? w.toggleMaximize() : w.startDragging()));
  };

  const drag = tauri ? { "data-tauri-drag-region": true } : {};

  const sidebarToggle = (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className={iconButton} onClick={onToggleSidebar} aria-label={sidebarOpen ? "Hide the sidebar" : "Show the sidebar"}>
          <PanelLeft strokeWidth={1.75} />
        </button>
      </TooltipTrigger>
      <TooltipContent>{sidebarOpen ? "Hide" : "Show"} sidebar · Ctrl+B</TooltipContent>
    </Tooltip>
  );

  return (
    <header
      {...drag}
      onMouseDown={onMouseDown}
      className={cn(
        "relative z-20 flex shrink-0 select-none items-center bg-sidebar/80 text-sidebar-foreground backdrop-blur-xl",
        tauri ? "h-11" : "h-10",
      )}
    >
      {/* Over the sidebar when it is open, so its toggle sits in the sidebar's top corner. */}
      <div {...drag} className={cn("flex h-full shrink-0 items-center gap-2 pl-3 pr-2", sidebarOpen && "w-64")}>
        {tauri && (
          <>
            <Logo className="size-[18px]" />
            <span {...drag} className="text-[13px] font-semibold tracking-tight">ucode</span>
          </>
        )}
        <div {...drag} className={cn("h-full", sidebarOpen ? "flex-1" : "w-1")} />
        {sidebarToggle}
      </div>

      <div {...drag} className="grid h-full min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2 pr-2">
        <div {...drag} className="h-full" />

        <div {...drag} className="flex min-w-0 max-w-[min(56vw,560px)] items-center gap-1.5 text-[13px] text-muted-foreground">
          {place && (
            <>
              <FolderClosed className="size-3.5 shrink-0" strokeWidth={1.75} />
              <span {...drag} className="truncate">{place}</span>
              <ChevronRight className="size-3.5 shrink-0 opacity-50" />
            </>
          )}
          {chatMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-foreground transition-colors hover:bg-accent data-[state=open]:bg-accent" title="Rename, delete or open the folder">
                  <span className="truncate">{title}</span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-48 rounded-xl p-1 backdrop-blur-xl">
                <DropdownMenuItem className="py-1.5 text-[13px]" onSelect={chatMenu.onRename}><Pencil /> Rename</DropdownMenuItem>
                {chatMenu.onOpenFolder && <DropdownMenuItem className="py-1.5 text-[13px]" onSelect={chatMenu.onOpenFolder}><FolderOpen /> Open folder</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="py-1.5 text-[13px]" variant="destructive" onSelect={chatMenu.onDelete}><Trash2 /> Delete chat</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span {...drag} className="truncate font-semibold text-foreground">{title}</span>
          )}
        </div>

        <div {...drag} className="flex h-full items-center justify-end gap-0.5">
          {onTogglePanel && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button className={cn(iconButton, panelOpen && "text-primary")} onClick={onTogglePanel} aria-label={panelOpen ? "Hide the preview" : "Show the preview"}>
                  <PanelRight strokeWidth={1.75} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{panelOpen ? "Hide" : "Show"} preview · Ctrl+P</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button className={iconButton} onClick={() => setTheme(dark ? "light" : "dark")} aria-label="Switch light and dark">
                {dark ? <Sun strokeWidth={1.75} /> : <Moon strokeWidth={1.75} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{dark ? "Light" : "Dark"} mode</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {tauri && (
        <div className="flex h-full shrink-0 self-start">
          <button className="grid h-full w-[46px] place-items-center text-foreground/80 transition-colors hover:bg-accent" onClick={() => withWindow((w) => w.minimize())} aria-label="Minimise">
            <Minus className="size-4" strokeWidth={1.25} />
          </button>
          <button className="grid h-full w-[46px] place-items-center text-foreground/80 transition-colors hover:bg-accent" onClick={() => withWindow((w) => w.toggleMaximize())} aria-label={maximized ? "Restore" : "Maximise"}>
            {maximized ? <Copy className="size-3.5 -scale-x-100" strokeWidth={1.25} /> : <Square className="size-3.5" strokeWidth={1.25} />}
          </button>
          <button className="grid h-full w-[46px] place-items-center text-foreground/80 transition-colors hover:bg-[#e81123] hover:text-white" onClick={() => withWindow((w) => w.close())} aria-label="Close">
            <X className="size-4" strokeWidth={1.25} />
          </button>
        </div>
      )}
    </header>
  );
}
