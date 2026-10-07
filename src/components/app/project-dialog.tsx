"use client";

import { useEffect, useState } from "react";
import { FolderOpen, FolderPlus, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { post } from "@/lib/api";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: (path: string) => void;
};

/** A project is a folder: one already on this computer, or a new one ucode makes. */
export function ProjectDialog({ open, onOpenChange, onDone }: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<"pick" | "create" | null>(null);
  useEffect(() => { if (open) { setName(""); setBusy(null); } }, [open]);

  const finish = (path: string) => {
    onDone(path);
    onOpenChange(false);
  };

  const pick = async () => {
    setBusy("pick");
    try {
      // The computer's own folder dialog opens; this waits until it is closed.
      const { path } = await post<{ path: string | null }>("pick-folder");
      if (!path) return;
      await post("projects", { add: path });
      finish(path);
    } catch (e) {
      toast.error("Could not open that folder", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    if (!name.trim()) return;
    setBusy("create");
    try {
      const r = await post<{ path: string | null }>("projects", { create: name.trim() });
      if (r.path) finish(r.path);
    } catch (e) {
      toast.error("Could not start that project", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent showCloseButton={false} className="w-[340px] gap-0 overflow-hidden rounded-2xl bg-popover p-0 shadow-2xl backdrop-blur-xl sm:max-w-[340px]">
        <div className="px-5 pb-4 pt-5 text-center">
          <span className="mx-auto grid size-9 place-items-center rounded-[10px] bg-primary text-primary-foreground"><FolderOpen className="size-4" /></span>
          <DialogTitle className="mt-2.5 text-[14px] font-semibold">Open a folder or start a project</DialogTitle>
          <DialogDescription className="mt-1 text-[12.5px] leading-snug">A project keeps the chats about one app together, and ucode works on its files.</DialogDescription>
        </div>

        <div className="space-y-3 px-4 pb-4">
          <button
            disabled={busy !== null}
            onClick={pick}
            className="flex w-full items-center gap-2.5 rounded-xl bg-card px-3 py-2.5 text-left ring-1 ring-border transition-colors hover:bg-accent disabled:opacity-60"
          >
            {busy === "pick" ? <LoaderCircle className="size-4 shrink-0 animate-spin text-primary" /> : <FolderOpen className="size-4 shrink-0 text-primary" />}
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">Open a folder on this computer</span>
              <span className="block text-[11.5px] text-muted-foreground">
                {busy === "pick" ? "Choose the folder in the window that opened…" : "Something you already have, like a website or a school project."}
              </span>
            </span>
          </button>

          <div>
            <p className="flex items-center gap-1.5 px-1 pb-1 text-[11px] font-medium text-muted-foreground"><FolderPlus className="size-3" /> Or start a new one</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Give it a name, like My game"
              disabled={busy !== null}
              aria-label="New project name"
              className="h-8 w-full rounded-lg bg-accent px-2.5 text-[13px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1">
            <button
              disabled={!name.trim() || busy !== null}
              onClick={create}
              className="flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy === "create" && <LoaderCircle className="size-3.5 animate-spin" />} Start project
            </button>
            <button disabled={busy !== null} onClick={() => onOpenChange(false)} className="h-8 w-full rounded-lg text-[13px] text-primary transition-colors hover:bg-accent disabled:opacity-40">
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
