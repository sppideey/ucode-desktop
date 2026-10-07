"use client";

import { FolderClosed, FolderPlus, KeyRound, LayoutGrid, MessageSquare, Moon, Plus, Settings, Sparkles, Stethoscope } from "lucide-react";
import { useTheme } from "next-themes";
import {
  Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { type ChatMeta, type Project, type View, folderName } from "./data";

// Roomy rows, small grey section labels and a soft highlight, like Spotlight.
const ROWS = cn(
  "rounded-2xl! bg-transparent p-1.5",
  "[&_[data-slot=command-input-wrapper]]:p-0.5 [&_[data-slot=input-group]]:h-10! [&_[data-slot=input-group]]:rounded-[10px]! [&_[data-slot=input-group]]:border-0 [&_[data-slot=input-group]]:bg-accent! [&_[cmdk-input]]:text-[14px]",
  "[&_[data-slot=command-item]]:rounded-[8px]! [&_[data-slot=command-item]]:py-2 [&_[data-slot=command-item]]:text-[13px]",
  "[&_[cmdk-group-heading]]:text-[11px]! [&_[cmdk-group-heading]]:font-semibold! [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide",
  "[&_[data-slot=command-separator]]:mx-2 [&_[data-slot=command-separator]]:my-1",
);

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  chats: ChatMeta[];
  projects: Project[];
  onView: (v: View) => void;
  onNewProject: () => void;
  onSettings: (section?: string) => void;
};

/** Ctrl+K: every action and every chat, one search away. */
export function CommandPalette({ open, onOpenChange, chats, projects, onView, onNewProject, onSettings }: Props) {
  const { resolvedTheme, setTheme } = useTheme();
  const run = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search chats, projects and actions"
      className="rounded-2xl! bg-popover/85 shadow-2xl backdrop-blur-2xl sm:max-w-[580px]"
    >
      {/* cmdk needs its own root inside the dialog, or it has nothing to search in. */}
      <Command className={ROWS}>
        <CommandInput placeholder="Search chats, projects and actions" />
        <CommandList className="max-h-[360px] pb-1">
          <CommandEmpty>Nothing found.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={run(() => onView({ kind: "home" }))}><Plus /> New chat <CommandShortcut>Ctrl N</CommandShortcut></CommandItem>
            <CommandItem onSelect={run(onNewProject)}><FolderPlus /> Open a folder or start a project</CommandItem>
            <CommandItem onSelect={run(() => onSettings("models"))}><Sparkles /> Switch model</CommandItem>
            <CommandItem onSelect={run(() => onSettings("keys"))}><KeyRound /> Keys</CommandItem>
            <CommandItem onSelect={run(() => onView({ kind: "apps" }))}><LayoutGrid /> Apps you built</CommandItem>
            <CommandItem onSelect={run(() => setTheme(resolvedTheme === "light" ? "dark" : "light"))}><Moon /> Switch light and dark</CommandItem>
            <CommandItem onSelect={run(() => onSettings("doctor"))}><Stethoscope /> Check that everything works</CommandItem>
            <CommandItem onSelect={run(() => onSettings())}><Settings /> Settings <CommandShortcut>Ctrl ,</CommandShortcut></CommandItem>
          </CommandGroup>
          {projects.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Projects">
                {projects.map((p) => (
                  <CommandItem key={p.path} value={`project ${p.name} ${p.path}`} onSelect={run(() => onView({ kind: "project", path: p.path }))}>
                    <FolderClosed /> <span className="truncate">{p.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
          {chats.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Chats">
                {/* Enough to find any recent chat without making every keystroke slow. */}
                {chats.slice(0, 200).map((c) => (
                  <CommandItem key={c.id} value={`chat ${c.title} ${c.id}`} onSelect={run(() => onView({ kind: "chat", id: c.id }))}>
                    <MessageSquare /> <span className="truncate">{c.title}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{folderName(c.folder)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
