"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, FolderClosed, FolderOpen, KeyRound, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Composer } from "./composer";
import { type Keys, type Model, type Project, type Provider, folderName, providerName, sameFolder } from "./data";
import { Logo } from "./logo";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type Props = {
  folder: string;
  defaultFolder: string;
  projects: Project[];
  onFolder: (path: string) => void;
  onOpenFolder: () => void;
  onStart: (text: string, files: string[]) => void;
  name: string;
  models: Model[];
  model: string;
  onModel: (id: string) => void;
  mode: "build" | "plan";
  onMode: (m: "build" | "plan") => void;
  onKeys: () => void;
  provider: Provider;
  onProvider: (p: Provider) => void;
  keys: Keys;
};

/** The start: a greeting, where the work goes, and one place to type. */
export function Home({ folder, defaultFolder, projects, onFolder, onOpenFolder, onStart, name, onKeys, ...composer }: Props) {
  const { provider, keys } = composer;
  const other: Provider = provider === "google" ? "openrouter" : "google";
  const [hello, setHello] = useState("Hello");
  useEffect(() => { setHello(greeting(new Date().getHours())); }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-6 pb-[10vh] pt-8">
      <div className="w-full max-w-[680px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo className="size-9 drop-shadow-[0_4px_10px_rgb(0_122_255/0.25)]" />
          <h1 className="mt-3 text-[22px] font-semibold leading-tight tracking-tight text-foreground">
            {hello}{name && `, ${name}`}
          </h1>
        </div>
        {!keys[provider] && (
          <button onClick={onKeys} className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left text-[13px] ring-1 ring-border transition-colors hover:bg-accent/60">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-warning/15 text-warning"><KeyRound className="size-4" /></span>
            <span className="min-w-0 flex-1 leading-snug">
              <span className="block font-semibold">Add your free {providerName[provider]} key to start</span>
              <span className="block text-muted-foreground">
                ucode is set to use {providerName[provider]}&apos;s models, and they need its key. Click here to add it
                {keys[other] ? `, or switch to ${providerName[other]} in the model menu below.` : "."}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" />
          </button>
        )}
        <Composer big autoFocus placeholder="What should we build today?" onSend={onStart} onKeys={onKeys} {...composer} />
        <div className="mt-3.5 flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex h-7 max-w-full items-center gap-1.5 rounded-full bg-accent px-3 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground aria-expanded:text-foreground">
                <FolderClosed className="size-3.5 shrink-0" />
                <span className="shrink-0">Working in</span>
                <span className="truncate font-medium text-foreground">{sameFolder(folder, defaultFolder) ? "ucode (your apps)" : folderName(folder)}</span>
                <ChevronDown className="size-3.5 shrink-0 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-72">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">Where ucode keeps this chat&apos;s files</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onFolder(defaultFolder)}>
                <FolderClosed /> ucode (your apps)
                {sameFolder(folder, defaultFolder) && <Check className="ml-auto text-primary" />}
              </DropdownMenuItem>
              {projects.map((p) => (
                <DropdownMenuItem key={p.path} onSelect={() => onFolder(p.path)}>
                  <FolderClosed /> <span className="truncate">{p.name}</span>
                  {sameFolder(folder, p.path) && <Check className="ml-auto text-primary" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onOpenFolder}><FolderOpen /> Open a folder…</DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenFolder}><Plus /> New project…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
