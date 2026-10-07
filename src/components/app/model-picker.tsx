"use client";

import type { ReactNode } from "react";
import { Check, ChevronDown, ChevronRight, KeyRound, Star } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { type Keys, type Model, type Provider, providerName } from "./data";

/** iOS segmented control: a grey track with the chosen option on a raised white pill. */
export function Segmented<T extends string>({ value, options, onChange, label, className }: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-grid auto-cols-fr grid-flow-col gap-0.5 rounded-[9px] bg-accent p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-label={o.title}
          title={o.title}
          onClick={() => value !== o.value && onChange(o.value)}
          className="flex h-6 items-center justify-center gap-1 rounded-[7px] px-2.5 text-[12px] font-medium whitespace-nowrap text-muted-foreground transition-all hover:text-foreground aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-[0_1px_3px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.04)] dark:aria-checked:bg-[#636366]"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type Props = {
  models: Model[];
  value: string;
  onChange: (id: string) => void;
  onKeys: () => void;
  provider: Provider;
  onProvider: (p: Provider) => void;
  keys: Keys;
};

const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const tag = "shrink-0 rounded-[5px] bg-warning/15 px-1.5 py-px text-[9.5px] font-semibold tracking-wide text-warning";

/** Which model answers: first Google or OpenRouter, then one of its models - every one free. */
export function ModelPicker({ models, value, onChange, onKeys, provider, onProvider, keys }: Props) {
  const current = models.find((m) => m.id === value);
  const shown = models.filter((m) => m.via === provider);
  const hasKey = keys[provider];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 min-w-0 max-w-[200px] items-center gap-1 rounded-full px-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground"
        >
          <span className="truncate">{current?.name ?? value}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        avoidCollisions
        className="w-[min(380px,calc(100vw-24px))] max-h-[min(560px,var(--radix-popover-content-available-height))] gap-0 overflow-hidden rounded-2xl bg-popover p-0 shadow-[0_12px_40px_-8px_rgb(0_0_0/0.3)] ring-1 ring-border backdrop-blur-xl"
      >
        <div className="shrink-0 p-2 pb-1.5">
          <Segmented label="Who runs the model" className="w-full" value={provider} onChange={onProvider}
            options={(["google", "openrouter"] as const).map((p) => ({ value: p, label: providerName[p] }))} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5">
          {!hasKey && (
            <button onClick={onKeys} className="mb-1 flex w-full items-center gap-2.5 rounded-xl bg-warning/10 px-3 py-2.5 text-left text-[12.5px] transition-colors hover:bg-warning/15">
              <KeyRound className="size-4 shrink-0 text-warning" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Add your {providerName[provider]} key</span>
                <span className="block text-muted-foreground">It is free, and these models need it.</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" />
            </button>
          )}
          {shown.map((m, i) => (
            <button
              key={m.id}
              onClick={() => (m.ready ? onChange(m.id) : onKeys())}
              className={cn(
                "relative flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left transition-colors hover:bg-accent",
                i > 0 && "before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-border hover:before:opacity-0",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[13.5px] font-medium">{m.name}</span>
                  {m.star && <Star className="size-3 shrink-0 fill-primary text-primary" aria-label="Recommended" />}
                  {!m.ready && <span className={tag}>ADD KEY</span>}
                  {m.spentUntil && <span className={tag}>USED UP TILL {time(m.spentUntil)}</span>}
                </div>
                <p className="truncate text-[12px] text-muted-foreground" title={m.note}>{m.note}</p>
              </div>
              <Check className={cn("size-4 shrink-0 text-primary", m.id === value ? "opacity-100" : "opacity-0")} strokeWidth={2.5} />
            </button>
          ))}
          {shown.length === 0 && <p className="px-3 py-4 text-center text-[12.5px] text-muted-foreground">No {providerName[provider]} models found yet{hasKey ? ". Check the internet is on." : "."}</p>}
        </div>

        <p className="shrink-0 border-t px-3.5 py-2 text-[11px] leading-snug text-muted-foreground">
          {provider === "google"
            ? "Every model here is free. Google's limits start again at 12:30 PM; new free models appear on their own."
            : "Every model here is free. OpenRouter allows a set number of free requests a day; new free models appear on their own."}
        </p>
      </PopoverContent>
    </Popover>
  );
}
