"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, FileText, LoaderCircle, Mic, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { post, upload } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Model, ProviderInfo } from "./data";
import { record, type Recording } from "./mic";
import { ModelPicker, Segmented } from "./model-picker";

/** Every command, as ucode's terminal has them. The ones the window does itself are marked. */
export const COMMANDS: { name: string; what: string; arg?: string }[] = [
  { name: "/undo", what: "put the project back as it was before the last turn", arg: "[n]" },
  { name: "/diff", what: "what has changed in this chat" },
  { name: "/commit", what: "save the changes to git, with a message written for you", arg: "[message]" },
  { name: "/review", what: "check the uncommitted changes for bugs, changing nothing" },
  { name: "/init", what: "read the project and write its notes (UCODE.md)" },
  { name: "/look", what: "open the running app and report what is on the page", arg: "[url]" },
  { name: "/deploy", what: "put the app online and get its link", arg: "[folder]" },
  { name: "/search", what: "look something up on the web", arg: "<query>" },
  { name: "/remember", what: "add a standing note for this project", arg: "<note>" },
  { name: "/model", what: "show the models and switch between them", arg: "[id]" },
  { name: "/mic", what: "say what you want instead of typing it" },
  { name: "/new", what: "start a fresh chat" },
  { name: "/resume", what: "pick up an earlier chat" },
  { name: "/skills", what: "what ucode knows how to do" },
  { name: "/mcp", what: "connected add-ons (MCP servers) and their tools" },
  { name: "/permissions", what: "ask before commands, or run them", arg: "[ask|auto]" },
  { name: "/stats", what: "time, steps and tokens in this chat" },
  { name: "/doctor", what: "check that everything ucode needs is working" },
  { name: "/copy", what: "copy the last reply" },
  { name: "/help", what: "every command" },
];

type Props = {
  placeholder?: string;
  onSend: (text: string, files: string[]) => void;
  models: Model[];
  model: string;
  onModel: (id: string) => void;
  mode: "build" | "plan";
  onMode: (m: "build" | "plan") => void;
  onProviders: () => void;
  provider: ProviderInfo | undefined;
  big?: boolean;
  busy?: boolean;
  onStop?: () => void;
  autoFocus?: boolean;
};

type Attached = { name: string; path: string };

/** A plain muted 28px icon button. */
const plain = "grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

/** Where you type: the message, files or the mic, build or plan, and which model. */
export function Composer({ placeholder = "Ask ucode to build or change something…", onSend, models, model, onModel, mode, onMode, onProviders, provider, big, busy, onStop, autoFocus }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Attached[]>([]);
  const [adding, setAdding] = useState(0);
  const [mic, setMic] = useState<"off" | "on" | "writing">("off");
  const [pick, setPick] = useState(0);
  const recording = useRef<Recording | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const slash = text.startsWith("/") && !text.includes(" ") ? COMMANDS.filter((c) => c.name.startsWith(text.toLowerCase())) : [];
  // Keep the highlighted command in view as the arrow keys move through the list.
  useEffect(() => { list.current?.children[pick]?.scrollIntoView({ block: "nearest" }); }, [pick]);

  const send = (said = text) => {
    if (busy) { onStop?.(); return; }
    if (!said.trim() || adding) return;
    onSend(said.trim(), files.map((f) => f.path));
    setText("");
    setFiles([]);
  };

  const addFiles = async (list: FileList | File[]) => {
    for (const f of [...list]) {
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name} is over 10 MB`); continue; }
      setAdding((n) => n + 1);
      try {
        const saved = await upload<Attached>("upload", f, f.name);
        setFiles((all) => [...all, saved]);
      } catch (err) {
        toast.error(`Could not add ${f.name}`, { description: String((err as Error).message) });
      } finally {
        setAdding((n) => n - 1);
      }
    }
  };

  const toggleMic = async (thenSend = false) => {
    if (mic === "writing") return;
    if (mic === "off") {
      try {
        recording.current = await record();
        setMic("on");
      } catch {
        toast.error("The microphone is not available", { description: "Allow the microphone for ucode, or check one is plugged in." });
      }
      return;
    }
    const rec = recording.current;
    recording.current = null;
    if (!rec) return;
    setMic("writing");
    try {
      const { text: heard, note } = await upload<{ text: string; note?: string }>("transcribe", await rec.stop(), "speech.wav");
      if (note) toast(note);
      if (heard) {
        const next = text ? `${text} ${heard}` : heard;
        if (thenSend) send(next);
        else setText(next);
      }
    } catch (err) {
      toast.error("Could not hear that", { description: String((err as Error).message) });
    } finally {
      setMic("off");
      box.current?.focus();
    }
  };

  // Exposed for /mic typed in the box.
  const runLocal = (cmd: string) => {
    if (cmd === "/mic") { setText(""); toggleMic(); return true; }
    return false;
  };

  return (
    <div className="relative">
      {slash.length > 0 && (
        <div
          ref={list}
          role="listbox"
          aria-label="Commands"
          className="absolute bottom-full left-0 right-0 z-20 mb-1.5 max-h-64 overflow-y-auto overscroll-contain rounded-lg bg-popover p-1 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.28)] ring-1 ring-border backdrop-blur-xl"
        >
          {slash.map((c, i) => (
            <button
              key={c.name}
              role="option"
              aria-selected={i === pick}
              onMouseEnter={() => setPick(i)}
              onClick={() => { setText(c.arg ? `${c.name} ` : c.name); box.current?.focus(); }}
              className={cn(
                "flex w-full items-baseline gap-2 rounded-md px-2.5 py-1.5 text-left",
                i === pick && "bg-accent",
              )}
            >
              <span className="font-mono text-[12px] font-medium">{c.name}</span>
              {c.arg && <span className="font-mono text-[11px] text-muted-foreground">{c.arg}</span>}
              <span className="ml-auto truncate pl-3 text-[11.5px] text-muted-foreground">{c.what}</span>
            </button>
          ))}
        </div>
      )}
      <div
        className="rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04),0_6px_18px_-12px_rgb(0_0_0/0.2)] transition-[border-color,box-shadow] focus-within:border-primary/45 focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_12%,transparent),0_6px_18px_-12px_rgb(0_0_0/0.2)]"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
      >
        {(files.length > 0 || adding > 0) && (
          <div className="flex flex-wrap gap-1 px-2 pt-2">
            {files.map((f) => (
              <span key={f.path} className="flex h-6 max-w-full items-center gap-1.5 rounded-md bg-accent pl-2 pr-1 font-mono text-[11.5px]">
                <FileText className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{f.name}</span>
                <button onClick={() => setFiles((all) => all.filter((x) => x.path !== f.path))} className="grid size-4 shrink-0 place-items-center rounded-full bg-muted-foreground/25 text-background transition-colors hover:bg-muted-foreground/45" aria-label={`Remove ${f.name}`}>
                  <X className="size-2.5" strokeWidth={3} />
                </button>
              </span>
            ))}
            {adding > 0 && <span className="flex h-6 items-center gap-1.5 rounded-md bg-accent px-2 text-[11.5px] text-muted-foreground"><LoaderCircle className="size-3 animate-spin" /> Adding…</span>}
          </div>
        )}
        <textarea
          ref={box}
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => { setText(e.target.value); setPick(0); }}
          onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); addFiles(e.clipboardData.files); } }}
          onKeyDown={(e) => {
            if (slash.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              setPick((p) => (p + (e.key === "ArrowDown" ? 1 : slash.length - 1)) % slash.length);
              return;
            }
            if (slash.length && e.key === "Tab") { e.preventDefault(); const c = slash[pick]; setText(c.arg ? `${c.name} ` : c.name); return; }
            if (e.key === "Escape" && busy) { e.preventDefault(); onStop?.(); return; }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (busy) return; // the stop button stops; Enter never does
              if (mic === "on") { toggleMic(true); return; }
              const chosen = slash.length && slash[pick].name !== text.trim() ? slash[pick] : null;
              if (chosen?.arg) { setText(`${chosen.name} `); return; }
              const said = chosen ? chosen.name : text.trim();
              if (runLocal(said)) return;
              send(said);
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "t") { e.preventDefault(); toggleMic(); }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") { e.preventDefault(); picker.current?.click(); }
          }}
          rows={big ? 3 : 1}
          placeholder={mic === "on" ? "Listening… speak, then press the mic again (or Enter to send)" : mic === "writing" ? "Writing down what you said…" : placeholder}
          className={cn(
            "block max-h-[40vh] w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-[13.5px] leading-[1.5] outline-none [field-sizing:content] placeholder:text-muted-foreground/70",
            big ? "min-h-[64px]" : "min-h-[44px]",
          )}
        />
        <input ref={picker} type="file" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className={plain} aria-label="Add a picture or file" onClick={() => picker.current?.click()}>
                <Plus className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Add a picture or file · Ctrl+O</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => toggleMic()}
                className={cn(plain, mic === "on" && "bg-destructive/12 text-destructive hover:bg-destructive/18 hover:text-destructive")}
                aria-label="Speak instead of typing"
              >
                {mic === "writing" ? <LoaderCircle className="size-[15px] animate-spin" /> : <Mic className={cn("size-[15px]", mic === "on" && "animate-pulse")} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{mic === "on" ? "Stop and write it down" : "Speak instead of typing · Ctrl+T"}</TooltipContent>
          </Tooltip>

          <Segmented
            label="Build or plan"
            className="ml-1"
            value={mode}
            onChange={(v) => {
              onMode(v);
              post("mode", { mode: v }).catch(() => {});
              toast(v === "plan" ? "Plan: ucode looks and plans, and changes nothing" : "Build: ucode makes the changes");
            }}
            options={[
              { value: "build", label: "Build", title: "Build: ucode makes the changes" },
              { value: "plan", label: "Plan", title: "Plan: ucode looks and plans, and changes nothing" },
            ]}
          />

          <div className="ml-auto flex min-w-0 items-center gap-1">
            <ModelPicker models={models} value={model} onChange={onModel} onProviders={onProviders} provider={provider} />
            <button
              type="button"
              onClick={() => (mic === "on" ? toggleMic(true) : runLocal(text.trim()) || send())}
              disabled={(!text.trim() && !busy && mic !== "on") || adding > 0}
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-lg transition-all active:scale-95 disabled:pointer-events-none",
                busy ? "bg-foreground text-background hover:opacity-85" : "bg-primary text-primary-foreground hover:brightness-110 disabled:bg-accent disabled:text-muted-foreground/70",
              )}
              aria-label={busy ? "Stop" : "Send"}
            >
              {busy ? <span className="size-2 rounded-[2px] bg-current" /> : <ArrowUp className="size-4" strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
