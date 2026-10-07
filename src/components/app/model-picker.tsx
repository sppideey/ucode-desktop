"use client";

import { type ReactNode, useState } from "react";
import { Check, ChevronDown, ChevronRight, KeyRound, Search, Star } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Model, ProviderInfo } from "./data";

/** iOS segmented control: a grey track with the chosen option on a raised white pill. */
export function Segmented<T extends string>({ value, options, onChange, label, className }: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-grid auto-cols-fr grid-flow-col gap-px rounded-lg bg-accent p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-label={o.title}
          title={o.title}
          onClick={() => value !== o.value && onChange(o.value)}
          className="flex h-[22px] items-center justify-center gap-1 rounded-md px-2 text-[11.5px] font-medium whitespace-nowrap text-muted-foreground transition-all hover:text-foreground aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-[0_1px_2px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.05)] dark:aria-checked:bg-[#5a5a5e]"
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
  /** Settings, at the providers: to add the key, or to use another provider. */
  onProviders: () => void;
  provider: ProviderInfo | undefined;
};

const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const tag = "shrink-0 rounded-[5px] bg-warning/15 px-1.5 py-px text-[9.5px] font-semibold tracking-wide text-warning";

/** Which model answers: the models of the one provider chosen in Settings, every one free. */
export function ModelPicker({ models, value, onChange, onProviders, provider }: Props) {
  const [query, setQuery] = useState("");
  const current = models.find((m) => m.id === value);
  const name = provider?.name ?? "this provider";
  const q = query.trim().toLowerCase();
  const shown = q ? models.filter((m) => `${m.name} ${m.id} ${m.note}`.toLowerCase().includes(q)) : models;

  return (
    <Popover onOpenChange={(open) => !open && setQuery("")}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-7 min-w-0 max-w-[180px] items-center gap-1 rounded-md px-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground"
        >
          <span className="truncate">{current?.name ?? value}</span>
          <ChevronDown className="size-3 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        avoidCollisions
        className="w-[min(340px,calc(100vw-24px))] max-h-[min(520px,var(--radix-popover-content-available-height))] gap-0 overflow-hidden rounded-xl bg-popover p-0 shadow-[0_12px_40px_-8px_rgb(0_0_0/0.3)] ring-1 ring-border backdrop-blur-xl"
      >
        <div className="flex shrink-0 items-center gap-2 px-3 pb-1 pt-2">
          <span className="text-[11px] font-medium text-muted-foreground">{name} models</span>
          <button type="button" onClick={onProviders} className="ml-auto text-[11px] font-medium text-primary hover:underline">Change provider</button>
        </div>
        {models.length > 6 && (
          <div className="shrink-0 px-1.5 pb-1">
            <label className="flex h-7 items-center gap-1.5 rounded-md bg-accent px-2">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${models.length} models`}
                aria-label="Search models"
                className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground/70"
              />
            </label>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-1">
          {provider && !provider.hasKey && (
            <button onClick={onProviders} className="mb-1 flex w-full items-center gap-2.5 rounded-lg bg-warning/10 px-2.5 py-2 text-left text-[12px] transition-colors hover:bg-warning/15">
              <KeyRound className="size-4 shrink-0 text-warning" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Add your {name} key</span>
                <span className="block text-muted-foreground">It is free, and these models need it.</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" />
            </button>
          )}
          {shown.map((m, i) => (
            <button
              key={m.id}
              onClick={() => (m.ready ? onChange(m.id) : onProviders())}
              className={cn(
                "relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-accent",
                i > 0 && "before:absolute before:inset-x-2.5 before:top-0 before:h-px before:bg-border hover:before:opacity-0",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[12.5px] font-medium">{m.name}</span>
                  {m.star && <Star className="size-3 shrink-0 fill-primary text-primary" aria-label="Recommended" />}
                  {!m.ready && <span className={tag}>ADD KEY</span>}
                  {m.spentUntil && <span className={tag}>USED UP TILL {time(m.spentUntil)}</span>}
                </div>
                <p className="truncate text-[11.5px] text-muted-foreground" title={m.note}>{m.note}</p>
              </div>
              <Check className={cn("size-3.5 shrink-0 text-primary", m.id === value ? "opacity-100" : "opacity-0")} strokeWidth={2.5} />
            </button>
          ))}
          {shown.length === 0 && (
            <p className="px-3 py-4 text-center text-[12px] text-muted-foreground">{q ? "No model matches that." : `No ${name} models yet. Check the internet is on.`}</p>
          )}
        </div>

        <p className="shrink-0 border-t px-3 py-1.5 text-[10.5px] leading-snug text-muted-foreground">
          Every model here is free. {provider?.note ?? ""}
        </p>
      </PopoverContent>
    </Popover>
  );
}
