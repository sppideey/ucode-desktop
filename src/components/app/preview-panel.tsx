"use client";

import { useCallback, useEffect, useState } from "react";
import { AppWindow, ExternalLink, FileCode2, FileText, FolderOpen, GitCompare, Globe, Monitor, RotateCcw, RotateCw, Share, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { get, post } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Segmented } from "./model-picker";

function Empty({ icon: Icon, title, text }: { icon: typeof AppWindow; title: string; text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <Icon className="size-9 text-muted-foreground/50" strokeWidth={1.4} />
      <p className="mt-3 text-[15px] font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-[13px] leading-snug text-muted-foreground">{text}</p>
    </div>
  );
}

/** A row in an iOS grouped list, with an inset hairline above every row but the first. */
const row = (first: boolean, on: boolean) => cn(
  "relative flex w-full items-center gap-2 px-3 py-[7px] text-left text-[12.5px] transition-colors hover:bg-accent",
  !first && "before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-border",
  on && "bg-primary/10 text-primary hover:bg-primary/15 before:opacity-0",
);

const tool = "grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40";
const segTrack = "h-7 rounded-[9px] bg-accent p-0.5";
const segItem = "h-6 flex-none rounded-[7px] border-0 px-3 text-[12.5px] font-medium text-muted-foreground hover:text-foreground data-active:bg-card data-active:text-foreground data-active:shadow-[0_1px_3px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.04)] dark:text-muted-foreground dark:data-active:border-transparent dark:data-active:bg-[#636366]";

type Props = {
  chat: string;
  folder: string;
  preview: string | null;
  busy: boolean;
  version: number; // goes up when a turn ends, so the lists refresh
  onClose: () => void;
  onSend: (text: string) => void;
};

/** Beside the conversation: the app as it is built, its code, and what changed. */
export function PreviewPanel({ chat, folder, preview, busy, version, onClose, onSend }: Props) {
  const [tab, setTab] = useState("preview");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [reload, setReload] = useState(0);
  const [files, setFiles] = useState<string[]>([]);
  const [file, setFile] = useState<{ path: string; text: string | null; note?: string } | null>(null);
  const [changes, setChanges] = useState<{ status: string; file: string }[]>([]);
  const [turns, setTurns] = useState(0);
  const [diff, setDiff] = useState<{ file: string; text: string } | null>(null);

  const refresh = useCallback(() => {
    get("files", { folder }).then((r) => setFiles(r.files)).catch(() => {});
    post("changes", { chat }).then((r) => { setChanges(r.files); setTurns(r.turns); }).catch(() => {});
  }, [chat, folder]);
  useEffect(refresh, [refresh, version]);
  useEffect(() => { if (preview) setReload((n) => n + 1); }, [version, preview]);

  const openFile = (path: string) =>
    get("file", { folder, path }).then((r) => setFile({ path, ...r })).catch((e) => toast.error(e.message));
  const openDiff = (f: string) => post("diff", { chat, file: f }).then((r) => setDiff({ file: f, text: r.diff })).catch(() => {});
  const undo = async (n: number) => {
    const r = await post("undo", { chat, turns: n }).catch((e) => ({ lines: [e.message] }));
    toast(r.lines?.join(" ") || "Done");
    setDiff(null);
    refresh();
    setReload((x) => x + 1);
  };
  const word: Record<string, string> = { A: "added", M: "changed", D: "deleted" };

  return (
    <Tabs value={tab} onValueChange={setTab} className="flex h-full min-w-0 flex-col gap-0 bg-panel">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b px-3">
        <TabsList className={segTrack}>
          <TabsTrigger value="preview" className={segItem}>Preview</TabsTrigger>
          <TabsTrigger value="code" className={segItem}>Code</TabsTrigger>
          <TabsTrigger value="changes" className={segItem}>Changes{changes.length ? ` · ${changes.length}` : ""}</TabsTrigger>
        </TabsList>
        <button type="button" className={cn(tool, "ml-auto")} onClick={() => post("open", { target: folder })} aria-label="Open the folder" title="Open the folder">
          <FolderOpen className="size-4" />
        </button>
        <button type="button" className={tool} onClick={onClose} aria-label="Close" title="Close">
          <X className="size-4" />
        </button>
      </div>

      <TabsContent value="preview" className="m-0 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5 px-3 py-2">
          <button type="button" className={tool} aria-label="Reload" title="Reload" disabled={!preview} onClick={() => setReload((n) => n + 1)}><RotateCw className="size-[15px]" /></button>
          <div className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-full bg-accent px-3 text-[12px] text-muted-foreground">
            <Globe className="size-3 shrink-0 opacity-70" />
            <span className="truncate">{preview ?? "No app open yet"}</span>
          </div>
          <Segmented label="Screen size" value={device} onChange={setDevice}
            options={[
              { value: "desktop", label: <Monitor className="size-3.5" />, title: "Computer size" },
              { value: "phone", label: <Smartphone className="size-3.5" />, title: "Phone size" },
            ]} />
          <button type="button" className={tool} aria-label="Open in your browser" title="Open in your browser" disabled={!preview} onClick={() => preview && post("open", { target: preview })}><ExternalLink className="size-[15px]" /></button>
          <button type="button" disabled={busy} onClick={() => onSend("/deploy")} className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-primary/12 px-3 text-[12.5px] font-medium text-primary transition-colors hover:bg-primary/18 disabled:pointer-events-none disabled:opacity-50">
            <Share className="size-3.5" /> Share online
          </button>
        </div>
        <div className="min-h-0 flex-1 px-3 pb-3">
          <div className={device === "phone"
            ? "mx-auto h-full w-[390px] max-w-full overflow-hidden rounded-[34px] border-[7px] border-[#1c1c1e] bg-white shadow-[0_10px_30px_-10px_rgb(0_0_0/0.35)] dark:border-[#3a3a3c]"
            : "h-full overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-border"}>
            {preview ? (
              <iframe
                key={`${preview}-${reload}`}
                src={preview}
                title="Your app"
                className="size-full"
                sandbox="allow-scripts allow-forms allow-same-origin allow-modals allow-popups allow-downloads"
              />
            ) : (
              <div className="h-full bg-background"><Empty icon={AppWindow} title="Your app shows up here" text="When ucode builds something, you see it here and can click around in it." /></div>
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="code" className="m-0 flex min-h-0 flex-1">
        {files.length === 0 ? (
          <Empty icon={FileCode2} title="No code yet" text="The files in this chat's folder appear here. Click one to read it." />
        ) : (
          <>
            <div className="w-56 shrink-0 overflow-y-auto border-r p-2">
              <div className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
                {files.map((f, i) => (
                  <button key={f} onClick={() => openFile(f)} className={row(i === 0, file?.path === f)} title={f}>
                    <FileText className="size-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{f}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="min-w-0 flex-1 overflow-auto bg-background">
              {file ? (
                file.text === null ? <p className="p-4 text-[13px] text-muted-foreground">{file.note}</p>
                  : <pre className="p-4 font-mono text-[12px] leading-relaxed">{file.text}</pre>
              ) : <Empty icon={FileCode2} title="Pick a file" text="Its code shows here." />}
            </div>
          </>
        )}
      </TabsContent>

      <TabsContent value="changes" className="m-0 flex min-h-0 flex-1 flex-col">
        {changes.length === 0 ? (
          <Empty icon={GitCompare} title="No changes yet" text="Every file ucode changes in this chat is listed here, with Undo." />
        ) : (
          <>
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <p className="text-[12px] text-muted-foreground">{changes.length} file{changes.length === 1 ? "" : "s"} · {turns} turn{turns === 1 ? "" : "s"}</p>
              <button type="button" disabled={busy} onClick={() => undo(1)} className="ml-auto flex h-7 items-center gap-1.5 rounded-full bg-primary/12 px-3 text-[12.5px] font-medium text-primary transition-colors hover:bg-primary/18 disabled:pointer-events-none disabled:opacity-50">
                <RotateCcw className="size-3.5" /> Undo last turn
              </button>
              {turns > 1 && (
                <button type="button" disabled={busy} onClick={() => undo(turns)} className="h-7 rounded-full px-3 text-[12.5px] font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50">
                  Undo all
                </button>
              )}
            </div>
            <div className="flex min-h-0 flex-1">
              <div className="w-56 shrink-0 overflow-y-auto border-r p-2">
                <div className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
                  {changes.map((c, i) => (
                    <button key={c.file} onClick={() => openDiff(c.file)} className={row(i === 0, diff?.file === c.file)} title={c.file}>
                      <span className={cn("size-1.5 shrink-0 rounded-full", c.status === "A" ? "bg-success" : c.status === "D" ? "bg-destructive" : "bg-warning")} />
                      <span className="min-w-0 flex-1 truncate">{c.file}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{word[c.status] ?? c.status}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-w-0 flex-1 overflow-auto bg-background">
                {diff ? (
                  <pre className="p-3 font-mono text-[12px] leading-relaxed">
                    {diff.text.split("\n").filter((l) => !/^(diff --git|index |--- |\+\+\+ )/.test(l)).map((l, i) => (
                      <div key={i} className={cn("rounded-[3px] px-1.5", l.startsWith("+") ? "bg-success/12 text-success" : l.startsWith("-") ? "bg-destructive/10 text-destructive" : l.startsWith("@@") ? "text-primary" : "")}>{l || " "}</div>
                    ))}
                  </pre>
                ) : <Empty icon={GitCompare} title="Pick a file" text="What changed in it shows here, in green and red." />}
              </div>
            </div>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
