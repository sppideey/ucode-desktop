"use client";

import { useEffect, useState } from "react";
import { AppWindow, ExternalLink, Globe, Monitor, RotateCw, Share, Smartphone, X } from "lucide-react";
import { post } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Segmented } from "./model-picker";

const tool = "grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

type Props = {
  chat: string;
  folder: string;
  preview: string | null;
  busy: boolean;
  version: number; // goes up when a turn ends, so the app reloads
  onClose: () => void;
  onSend: (text: string) => void;
};

/** Beside the conversation: the app as it is built. Undo and the changes live in the chat. */
export function PreviewPanel({ preview, busy, version, onClose, onSend }: Props) {
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [reload, setReload] = useState(0);
  useEffect(() => { if (preview) setReload((n) => n + 1); }, [version, preview]);

  return (
    <div className="flex h-full min-w-0 flex-col bg-panel">
      <div className="flex h-9 shrink-0 items-center gap-1 px-2">
        <button type="button" className={tool} aria-label="Reload" title="Reload" disabled={!preview} onClick={() => setReload((n) => n + 1)}>
          <RotateCw className="size-3.5" />
        </button>
        <div className="flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded-md border bg-background px-2 font-mono text-[11px] text-muted-foreground">
          <Globe className="size-3 shrink-0 opacity-60" />
          <span className="truncate" title={preview ?? undefined}>{preview ?? "No app open yet"}</span>
        </div>
        <Segmented label="Screen size" value={device} onChange={setDevice}
          options={[
            { value: "desktop", label: <Monitor className="size-3.5" />, title: "Computer size" },
            { value: "phone", label: <Smartphone className="size-3.5" />, title: "Phone size" },
          ]} />
        <button type="button" className={tool} aria-label="Open in your browser" title="Open in your browser" disabled={!preview} onClick={() => preview && post("open", { target: preview })}>
          <ExternalLink className="size-3.5" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSend("/deploy")}
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[12px] font-medium text-primary-foreground transition-[filter] hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
        >
          <Share className="size-3.5" /> Share online
        </button>
        <button type="button" className={tool} onClick={onClose} aria-label="Close the preview" title="Close">
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 px-2 pb-2">
        <div className={cn(
          "h-full overflow-hidden bg-white",
          device === "phone"
            ? "mx-auto w-[390px] max-w-full rounded-[28px] border-[6px] border-[#1c1c1e] shadow-[0_10px_30px_-10px_rgb(0_0_0/0.35)] dark:border-[#3a3a3c]"
            : "rounded-lg ring-1 ring-border",
        )}>
          {preview ? (
            <iframe
              key={`${preview}-${reload}`}
              src={preview}
              title="Your app"
              className="size-full"
              sandbox="allow-scripts allow-forms allow-same-origin allow-modals allow-popups allow-downloads"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-background px-8 text-center">
              <AppWindow className="size-7 text-muted-foreground/50" strokeWidth={1.5} />
              <p className="mt-2.5 text-[13px] font-semibold">Your app shows up here</p>
              <p className="mt-0.5 max-w-xs text-[12px] leading-snug text-muted-foreground">When ucode builds something, you see it here and can click around in it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
