"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Check, ChevronRight, CircleAlert, Copy, FileText, LoaderCircle, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { post } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import type { Item, Keys, Model, Provider, Step } from "./data";
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
        <button type="button" onClick={onClick} aria-label={label} className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Steps({ steps, count, live }: { steps: Step[]; count?: number; live: boolean }) {
  const [open, setOpen] = useState(false);
  const total = steps.length || count || 0;
  if (!total) return null;
  const failed = steps.filter((s) => s.ok === false).length;
  const expanded = open || live;
  return (
    <div className="text-[13px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        className="-ml-1 flex items-center gap-1 rounded-md px-1 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight className={cn("size-3.5 transition-transform duration-200", expanded && "rotate-90")} />
        {live ? <span className="shimmer font-medium">Working…</span> : <span>{total} step{total === 1 ? "" : "s"}</span>}
        {failed > 0 && <span className="text-destructive/90">· {failed} needed another go</span>}
      </button>
      {steps.length > 0 && expanded && (
        <ul className="mt-1.5 ml-[7px] space-y-1.5 border-l pl-3.5">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              {s.ok === false ? <X className="mt-[3px] size-3.5 shrink-0 text-destructive" strokeWidth={2.5} />
                : s.result !== undefined || !live || i < steps.length - 1 ? <Check className="mt-[3px] size-3.5 shrink-0 text-success" strokeWidth={2.5} />
                  : <LoaderCircle className="mt-[3px] size-3.5 shrink-0 animate-spin text-muted-foreground" />}
              <div className="min-w-0 leading-snug">
                <p className={cn("break-words", s.narration ? "text-muted-foreground" : "text-foreground/85")}>{s.text}</p>
                {s.result && <p className={cn("mt-0.5 break-words text-[12px]", s.ok === false ? "text-destructive" : "text-muted-foreground")}>{s.result}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** iOS alert: a white card, title, detail, then the buttons in a row. */
const alertCard = "rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.05),0_10px_30px_-12px_rgb(0_0_0/0.25)] ring-1 ring-border";
const alertButton = "flex h-9 min-w-[120px] flex-1 basis-0 items-center justify-center truncate rounded-xl px-3 text-[14px] font-medium transition-[filter,background-color] active:scale-[0.98]";

function Question({ item }: { item: Extract<Item, { kind: "question" }> }) {
  const answer = (value: unknown) => post("answer", { id: item.qid, value }).catch(() => toast.error("That question has gone. The turn was stopped."));
  if (item.ask === "pick") {
    return (
      <div className={cn(alertCard, item.answered && "opacity-60")}>
        <p className="mb-3 text-center text-[15px] font-semibold">{item.title ?? "Choose one"}</p>
        <div className="overflow-hidden rounded-xl bg-muted">
          {item.items?.map((label, i) => (
            <button
              key={i}
              type="button"
              disabled={item.answered}
              onClick={() => answer(i)}
              className={cn(
                "relative flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[14px] transition-colors hover:bg-accent disabled:pointer-events-none",
                i > 0 && "before:absolute before:inset-x-3.5 before:top-0 before:h-px before:bg-border",
              )}
            >
              <span className="min-w-0 flex-1">{label}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
            </button>
          ))}
        </div>
        <button type="button" disabled={item.answered} onClick={() => answer(null)} className="mt-2 w-full rounded-xl py-2 text-[14px] font-medium text-primary transition-colors hover:bg-accent disabled:pointer-events-none">
          Cancel
        </button>
      </div>
    );
  }
  return (
    <div className={cn(alertCard, item.answered && "opacity-60")}>
      <p className="text-center text-[15px] font-semibold leading-snug">{item.action}</p>
      {item.detail && <pre className="mt-2.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted px-3 py-2 font-mono text-[12px] text-muted-foreground">{item.detail}</pre>}
      {!item.answered ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={cn(alertButton, "bg-accent text-foreground hover:brightness-95 dark:hover:brightness-125")} onClick={() => answer(false)}>Don&apos;t allow</button>
          {item.always && (
            <button type="button" className={cn(alertButton, "bg-accent text-primary hover:brightness-95 dark:hover:brightness-125")} onClick={() => answer("always")} title={`Always allow ${item.always}`}>
              Always allow {item.always}
            </button>
          )}
          <button type="button" className={cn(alertButton, "bg-primary text-primary-foreground hover:brightness-110")} onClick={() => answer(true)}>Allow once</button>
        </div>
      ) : <p className="mt-3 text-center text-[12px] text-muted-foreground">Answered</p>}
    </div>
  );
}

/** A conversation: what you asked, how ucode is getting on, and what it says back. */
export function Chat({ items, spinner, busy, plan, models, model, onModel, mode, onMode, onKeys, provider, onProvider, keys, onSend, onStop, onUndo }: Props) {
  const end = useRef<HTMLDivElement>(null);
  const last = items.at(-1);
  // Braces matter: newer browsers return a promise from scrollIntoView, and React would call it on cleanup.
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [items.length, last, spinner]);
  const lastSteps = items.map((i) => i.kind).lastIndexOf("steps");

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[760px] space-y-5 px-6 pb-6 pt-8">
          {items.map((m, i) => {
            if (m.kind === "user") {
              return (
                <div key={m.id} className="flex flex-col items-end gap-1.5 pl-10">
                  {m.files && m.files.length > 0 && (
                    <div className="flex max-w-[75%] flex-wrap justify-end gap-1.5">
                      {m.files.map((f) => (
                        <span key={f} className="flex max-w-full items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[12px] text-foreground/80">
                          <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{f.replace(/^[0-9a-f]{8}-/, "")}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="max-w-[75%] whitespace-pre-wrap break-words rounded-[20px] rounded-br-[6px] bg-primary px-4 py-2 text-[15px] leading-[1.4] text-primary-foreground">{m.text}</div>
                </div>
              );
            }
            if (m.kind === "reply") {
              return (
                <div key={m.id} className="group">
                  <Markdown text={m.text} />
                  {!m.streaming && (
                    <div className="-ml-1.5 mt-1 flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <Action label="Copy" onClick={() => { navigator.clipboard?.writeText(m.text); toast.success("Copied"); }}>
                        <Copy className="size-3.5" />
                      </Action>
                      {i === items.length - 1 && !busy && (
                        <Action label="Undo this turn" onClick={onUndo}>
                          <RotateCcw className="size-3.5" />
                        </Action>
                      )}
                    </div>
                  )}
                </div>
              );
            }
            if (m.kind === "steps") return <Steps key={m.id} steps={m.steps} count={m.count} live={busy && i === lastSteps && i === items.length - 1} />;
            if (m.kind === "question") return <Question key={m.id} item={m} />;
            if (m.kind === "note") return <p key={m.id} className="whitespace-pre-wrap text-[13px] text-muted-foreground">{m.text}</p>;
            if (m.kind === "lines") {
              return (
                <div key={m.id} className="rounded-xl bg-muted px-3.5 py-3">
                  {m.title && <p className="mb-1.5 text-[13px] font-semibold">{m.title}</p>}
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-muted-foreground">{m.lines.join("\n").replace(/^\n+|\n+$/g, "")}</pre>
                </div>
              );
            }
            return (
              <div key={m.id} className="flex gap-2.5 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-[13px]">
                <CircleAlert className="mt-px size-4 shrink-0 text-destructive" />
                <div className="min-w-0 break-words"><p>{m.text}</p>{m.fix && <p className="mt-0.5 text-muted-foreground">{m.fix}</p>}</div>
              </div>
            );
          })}
          {busy && (
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <LoaderCircle className="size-3.5 animate-spin" />
              <span className="shimmer">{spinner ?? "Working…"}</span>
            </div>
          )}
          <div ref={end} />
        </div>
      </div>
      <div className="mx-auto w-full max-w-[760px] px-6 pb-3">
        {plan.length > 0 && busy && (
          <div className="mb-2 space-y-1 rounded-2xl bg-card px-3.5 py-2.5 text-[12.5px] ring-1 ring-border">
            {plan.map((p, i) => (
              <p key={i} className={cn("flex items-center gap-2", p.done && "text-muted-foreground line-through")}>
                {p.done
                  ? <span className="grid size-3.5 shrink-0 place-items-center rounded-full bg-success text-white"><Check className="size-2.5" strokeWidth={3.5} /></span>
                  : <span className="size-3.5 shrink-0 rounded-full border-[1.5px] border-muted-foreground/40" />}
                {p.text}
              </p>
            ))}
          </div>
        )}
        <Composer onSend={onSend} models={models} model={model} onModel={onModel} mode={mode} onMode={onMode} onKeys={onKeys} provider={provider} onProvider={onProvider} keys={keys} busy={busy} onStop={onStop} autoFocus />
        <p className="mt-2 text-center text-[11px] text-muted-foreground/80">ucode checks its own work, and Undo puts everything back.</p>
      </div>
    </div>
  );
}
