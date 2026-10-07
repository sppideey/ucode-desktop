"use client";

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppWindow, Check, ChevronRight, CircleAlert, Copy, Dot, FilePen, FileText, Globe, LoaderCircle, RotateCcw, Search, ShieldQuestion, Terminal, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { post } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import type { Item, Keys, Model, Provider } from "./data";
import { Markdown } from "./markdown";

type Props = {
  items: Item[];
  spinner: string | null;
  busy: boolean;
  plan: { text: string; done?: boolean }[];
  models: Model[];
  model: string;
  onModel: (id: string) => void;
  mode: "build" | "plan";
  onMode: (m: "build" | "plan") => void;
  onKeys: () => void;
  provider: Provider;
  onProvider: (p: Provider) => void;
  keys: Keys;
  onSend: (text: string, files: string[]) => void;
  onStop: () => void;
  onUndo: () => void;
};

/** A tiny icon button under a reply, shown on hover. */
function Action({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={onClick} aria-label={label} className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Each of ucode's steps in plain words ("Reading index.html" is "Reading your project"). */
const plainSteps: [RegExp, string, LucideIcon][] = [
  [/^Creating (.+?) from the .*starter/i, "Building $1", AppWindow],
  [/^Creating\b/i, "Building your app", AppWindow],
  [/^(Writing|Editing|Renaming|Adding|Fixing|Updating|Changing)\b/i, "Writing the code", FilePen],
  [/^(Reading|Listing|Mapping|Looking up|Asking what|Finding|Loading|Outlining)\b/i, "Reading your project", FileText],
  [/^(Running|Starting)\b.*\b(install|add)\b/i, "Getting what it needs", Terminal],
  [/^(Running|Starting)\b.*\b(test|check|lint|tsc|build)\b/i, "Testing it", Terminal],
  [/^Deploying\b/i, "Putting it online", Globe],
  [/^(Running|Starting)\b/i, "Running it", Terminal],
  [/^(Looking at|Opening|Checking)\b/i, "Checking it works", Globe],
  [/^(Searching)\b/i, "Looking things up", Search],
];
const plainStep = (text: string): [string, LucideIcon] => {
  for (const [re, said, icon] of plainSteps) if (re.test(text)) return [text.replace(re, said).replace(/^(Building .{1,40}?) with.*$/, "$1"), icon];
  return ["Working on it", Dot];
};

const took = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

/** What ucode is doing, in plain words: one line per kind of work, open while it works, one line after. */
function Steps({ item, live }: { item: Extract<Item, { kind: "steps" }>; live: boolean }) {
  const [open, setOpen] = useState<boolean | null>(null); // null: follow live
  const { steps, count } = item;
  const work = steps.filter((s) => !s.narration);
  const total = work.length || count || 0;
  if (!total) return null;
  // The same kind of work twice in a row is one line: "Writing the code", not five file names.
  const rows: { said: string; Icon: LucideIcon; ok: boolean; at: number }[] = [];
  work.forEach((s, i) => {
    const [said, Icon] = plainStep(s.text);
    const last = rows.at(-1);
    if (last && last.said === said) { last.ok = last.ok && s.ok !== false; last.at = i; }
    else rows.push({ said, Icon, ok: s.ok !== false, at: i });
  });
  const ms = item.start && item.end ? item.end - item.start : 0;
  const expanded = rows.length > 0 && (open ?? live);
  const summary = ms >= 1000 ? `Done in ${took(ms)}` : "Done";

  return (
    <div className="text-[12.5px]">
      <button
        type="button"
        onClick={() => setOpen(!expanded)}
        disabled={!rows.length}
        aria-expanded={expanded}
        className="-ml-1 flex h-6 items-center gap-1 rounded-md px-1 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none"
      >
        {rows.length > 0 && <ChevronRight className={cn("size-3.5 transition-transform duration-150", expanded && "rotate-90")} />}
        {live ? <span className="shimmer font-medium">Working</span> : <span>{summary}</span>}
      </button>
      {expanded && (
        <ul className="mt-1 overflow-hidden rounded-lg border bg-muted/40">
          {rows.map((r, i) => {
            const running = live && i === rows.length - 1 && work[r.at]?.result === undefined;
            return (
              <li key={i} className="flex min-h-7 items-center gap-2 border-t px-2.5 py-[5px] first:border-t-0">
                {running ? <LoaderCircle className="size-3.5 shrink-0 animate-spin text-primary" />
                  : r.ok ? <Check className="size-3.5 shrink-0 text-success" strokeWidth={2.5} />
                    : <r.Icon className="size-3.5 shrink-0 text-muted-foreground" />}
                <span className={cn("min-w-0 flex-1 leading-[18px]", running ? "text-foreground" : "text-foreground/80")}>{r.said}</span>
                {!r.ok && !running && <span className="shrink-0 text-[11.5px] text-muted-foreground">needed another try</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * An answer without the workings: no design header ("App: X | Tone: Y"), no file:// links
 * (the app is in the preview beside the chat), no "or open delta/index.html in your browser".
 */
const tidy = (text: string) => text
  .split("\n")
  .filter((l) => !/^App: .*\| Tone:/.test(l) && !/^\(?\s*or open\b.*\bin your browser\s*\)?\.?$/i.test(l.trim()))
  .map((l) => l.replace(/\.?\s*Open it here:\s*file:\/\/\S+/i, ". It is open in the preview on the right.").replace(/file:\/\/\/?\S+/g, "the preview"))
  .join("\n")
  .replace(/\.\. /g, ". ")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

/** ucode's own notes that are about its workings, not about your app: not shown. */
const technical = /fold|output limit|token|context|mcp|\.md\b|\.(?:m?js|ts|tsx|html|css|json)\b|[A-Z]:\\|\/[\w.-]+\/|rate limit|retry|per-minute|stalled|backup model|turn cancelled|skill/i;

const CLAMP = 168; // about 8 lines at 13.5px

/** An answer: compact, with long ones folded to about 8 lines until you ask for the rest. */
function Reply({ item, last, busy, onUndo }: { item: Extract<Item, { kind: "reply" }>; last: boolean; busy: boolean; onUndo: () => void }) {
  const text = tidy(item.text);
  const body = useRef<HTMLDivElement>(null);
  const [long, setLong] = useState(false);
  const [more, setMore] = useState(false);
  useLayoutEffect(() => { setLong(!item.streaming && (body.current?.scrollHeight ?? 0) > CLAMP + 40); }, [text, item.streaming]);
  const folded = long && !more;
  if (!text.trim()) return null;

  return (
    <div className="group">
      <div
        ref={body}
        style={folded ? { maxHeight: CLAMP } : undefined}
        className={cn(folded && "overflow-hidden [mask-image:linear-gradient(to_bottom,black_65%,transparent)]")}
      >
        <Markdown text={text} />
      </div>
      {!item.streaming && (
        <div className="-ml-1 mt-0.5 flex items-center gap-0.5">
          {long && (
            <button type="button" onClick={() => setMore((v) => !v)} className="mr-1 h-6 rounded-md px-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary/10">
              {more ? "Show less" : "Show more"}
            </button>
          )}
          <div className="flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <Action label="Copy" onClick={() => { navigator.clipboard?.writeText(text); toast.success("Copied"); }}>
              <Copy className="size-3.5" />
            </Action>
            {last && !busy && (
              <Action label="Undo this turn" onClick={onUndo}>
                <RotateCcw className="size-3.5" />
              </Action>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const small = "inline-flex h-7 max-w-full items-center justify-center truncate rounded-md px-2.5 text-[12px] font-medium transition-[filter,background-color] active:scale-[0.98]";

/** A question from ucode: a compact inline card with small buttons. */
function Question({ item }: { item: Extract<Item, { kind: "question" }> }) {
  const answer = (value: unknown) => post("answer", { id: item.qid, value }).catch(() => toast.error("That question has gone. The turn was stopped."));
  const card = cn("rounded-lg border bg-card px-3 py-2.5 shadow-[0_1px_2px_rgb(0_0_0/0.04)]", item.answered ? "opacity-60" : "border-primary/35");

  if (item.ask === "pick") {
    return (
      <div className={card}>
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold"><ShieldQuestion className="size-3.5 text-primary" />{item.title ?? "Choose one"}</p>
        <div className="mt-2 overflow-hidden rounded-md border">
          {item.items?.map((label, i) => (
            <button
              key={i}
              type="button"
              disabled={item.answered}
              onClick={() => answer(i)}
              className="flex w-full items-center gap-2 border-t px-2.5 py-1.5 text-left text-[12.5px] transition-colors first:border-t-0 hover:bg-accent disabled:pointer-events-none"
            >
              <span className="min-w-0 flex-1">{label}</span>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
            </button>
          ))}
        </div>
        {!item.answered
          ? <div className="mt-2 flex justify-end"><button type="button" onClick={() => answer(null)} className={cn(small, "text-muted-foreground hover:bg-accent hover:text-foreground")}>Cancel</button></div>
          : <p className="mt-2 text-[11.5px] text-muted-foreground">Answered</p>}
      </div>
    );
  }

  return (
    <div className={card}>
      <p className="flex items-start gap-1.5 text-[12.5px] font-semibold leading-snug">
        <ShieldQuestion className="mt-px size-3.5 shrink-0 text-primary" />
        <span className="min-w-0 break-words">{item.action}</span>
      </p>
      {item.detail && (
        <details className="mt-1.5 text-[12px] text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">Details</summary>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted px-2.5 py-1.5 font-mono text-[11.5px]">{item.detail}</pre>
        </details>
      )}
      {!item.answered ? (
        <div className="mt-2.5 flex flex-wrap justify-end gap-1.5">
          <button type="button" className={cn(small, "text-muted-foreground hover:bg-accent hover:text-foreground")} onClick={() => answer(false)}>Don&apos;t allow</button>
          {item.always && (
            <button type="button" className={cn(small, "bg-accent text-foreground hover:brightness-95 dark:hover:brightness-125")} onClick={() => answer("always")} title={`Always allow ${item.always}`}>
              Always allow {item.always}
            </button>
          )}
          <button type="button" className={cn(small, "bg-primary text-primary-foreground hover:brightness-110")} onClick={() => answer(true)}>Allow once</button>
        </div>
      ) : <p className="mt-2 text-[11.5px] text-muted-foreground">Answered</p>}
    </div>
  );
}

/** A conversation: what you asked, the tool log of what ucode did, and what it says back. */
export function Chat({ items, spinner, busy, plan, models, model, onModel, mode, onMode, onKeys, provider, onProvider, keys, onSend, onStop, onUndo }: Props) {
  const end = useRef<HTMLDivElement>(null);
  const last = items.at(-1);
  // Braces matter: newer browsers return a promise from scrollIntoView, and React would call it on cleanup.
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [items.length, last, spinner]);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[720px] space-y-3.5 px-5 pb-5 pt-1 text-[13px]">
          {items.map((m, i) => {
            if (m.kind === "user") {
              return (
                <div key={m.id} className="relative rounded-lg bg-muted py-2 pl-3.5 pr-3 before:absolute before:inset-y-2 before:left-0 before:w-[2.5px] before:rounded-full before:bg-primary/70">
                  {m.files && m.files.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {m.files.map((f) => (
                        <span key={f} className="flex h-5 max-w-full items-center gap-1 rounded-[5px] bg-accent px-1.5 font-mono text-[11px] text-foreground/80">
                          <FileText className="size-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">{f.replace(/^[0-9a-f]{8}-/, "")}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.5]">{m.text}</p>
                </div>
              );
            }
            if (m.kind === "reply") return <Reply key={m.id} item={m} last={i === items.length - 1} busy={busy} onUndo={onUndo} />;
            if (m.kind === "steps") return <Steps key={m.id} item={m} live={busy && i === items.length - 1} />;
            if (m.kind === "question") return <Question key={m.id} item={m} />;
            if (m.kind === "note" && technical.test(m.text)) return null;
            if (m.kind === "note") return <p key={m.id} className="whitespace-pre-wrap text-[12px] leading-snug text-muted-foreground">{m.text}</p>;
            if (m.kind === "lines") {
              return (
                <div key={m.id} className="rounded-lg border bg-muted/40 px-3 py-2">
                  {m.title && <p className="mb-1 text-[12.5px] font-semibold">{m.title}</p>}
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-muted-foreground">{m.lines.join("\n").replace(/^\n+|\n+$/g, "")}</pre>
                </div>
              );
            }
            return (
              <div key={m.id} className="flex gap-2 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-[12.5px]">
                <CircleAlert className="mt-px size-3.5 shrink-0 text-destructive" />
                <div className="min-w-0 break-words"><p>{m.text}</p>{m.fix && <p className="mt-0.5 text-muted-foreground">{m.fix}</p>}</div>
              </div>
            );
          })}
          {busy && (
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <LoaderCircle className="size-3 animate-spin" />
              <span className="shimmer truncate">{spinner ?? "Working…"}</span>
            </div>
          )}
          <div ref={end} />
        </div>
      </div>
      <div className="mx-auto w-full max-w-[720px] px-5 pb-4">
        {plan.length > 0 && busy && (
          <div className="mb-1.5 space-y-0.5 rounded-lg border bg-card px-3 py-2 text-[12px]">
            {plan.map((p, i) => (
              <p key={i} className={cn("flex items-center gap-2", p.done && "text-muted-foreground line-through")}>
                {p.done
                  ? <span className="grid size-3 shrink-0 place-items-center rounded-full bg-success text-white"><Check className="size-2" strokeWidth={4} /></span>
                  : <span className="size-3 shrink-0 rounded-full border-[1.5px] border-muted-foreground/40" />}
                {p.text}
              </p>
            ))}
          </div>
        )}
        <Composer onSend={onSend} models={models} model={model} onModel={onModel} mode={mode} onMode={onMode} onKeys={onKeys} provider={provider} onProvider={onProvider} keys={keys} busy={busy} onStop={onStop} autoFocus />
      </div>
    </div>
  );
}
