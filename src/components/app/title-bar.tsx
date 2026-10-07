"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** The bits of Tauri's window API the frame uses (window.__TAURI__, with withGlobalTauri on). */
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

/** Runs one window call; the API may be missing or refuse, and the frame just carries on. */
const withWindow = (fn: (w: TauriWindow) => Promise<unknown>) => {
  try {
    const w = tauriWindow();
    if (w) fn(w).catch(() => {});
  } catch { /* not in the desktop app */ }
};

const noSubscribe = () => () => {};
/** True inside the desktop app (a frameless Tauri window), false in a browser window. */
export const useInTauri = () => useSyncExternalStore(noSubscribe, () => "__TAURI__" in window, () => false);

/** Room the work area leaves at its top-right for the window buttons (3 x 44px, plus a gap). */
export const CLEAR_OF_CONTROLS = "pr-[136px]";

/**
 * A 32px strip along the top. In the desktop app it moves the window: drag it, or double-click to
 * maximise. Its buttons stay buttons. In a browser window it is just a row.
 */
export function DragStrip({ className, children }: { className?: string; children?: React.ReactNode }) {
  const tauri = useInTauri();
  // Tauri's own script moves the window for the element marked data-tauri-drag-region. Anything else
  // in the strip that is not a control (an icon, a gap) is handled here, the same way.
  const onMouseDown = (e: React.MouseEvent) => {
    if (!tauri || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.hasAttribute("data-tauri-drag-region") || target.closest("button, a, input, [role=button], [role=menuitem]")) return;
    withWindow((w) => (e.detail === 2 ? w.toggleMaximize() : w.startDragging()));
  };
  return (
    <div
      {...(tauri ? { "data-tauri-drag-region": true } : {})}
      onMouseDown={onMouseDown}
      className={cn("flex h-8 shrink-0 select-none items-center", className)}
    >
      {children}
    </div>
  );
}

/** A small icon button with a tooltip: the frame's toggles, a chat row's actions. */
export function IconButton({ label, shortcut, onClick, active, className, children }: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-3.5",
            active && "text-foreground",
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent className="px-2 py-1 text-[11.5px]">
        {label}
        {shortcut && <span className="opacity-60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

/** Minimise, maximise and close, floating in the window's top-right corner. Only in the desktop app. */
export function WindowControls() {
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

  if (!tauri) return null;
  const button = "grid h-8 w-11 place-items-center text-foreground/70 transition-colors hover:bg-accent hover:text-foreground";
  return (
    <div className="fixed right-0 top-0 z-50 flex">
      <button type="button" className={button} onClick={() => withWindow((w) => w.minimize())} aria-label="Minimise">
        <Minus className="size-4" strokeWidth={1} />
      </button>
      <button type="button" className={button} onClick={() => withWindow((w) => w.toggleMaximize())} aria-label={maximized ? "Restore" : "Maximise"}>
        {maximized ? <Copy className="size-3 -scale-x-100" strokeWidth={1.25} /> : <Square className="size-3" strokeWidth={1.25} />}
      </button>
      <button type="button" className={cn(button, "hover:bg-[#e81123] hover:text-white")} onClick={() => withWindow((w) => w.close())} aria-label="Close">
        <X className="size-4" strokeWidth={1} />
      </button>
    </div>
  );
}
