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
      <DialogContent showCloseButton={false} className="w-[380px] gap-0 overflow-hidden rounded-2xl bg-popover p-0 shadow-2xl backdrop-blur-xl sm:max-w-[380px]">
        <div className="px-6 pb-5 pt-6 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-[12px] bg-primary text-primary-foreground"><FolderOpen className="size-5" /></span>
          <DialogTitle className="mt-3 text-[17px] font-semibold">Open a folder or start a project</DialogTitle>
          <DialogDescription className="mt-1 text-[13px] leading-snug">A project keeps the chats about one app together, and ucode works on its files.</DialogDescription>
        </div>

        <div className="space-y-4 px-5 pb-5">
          <button
            disabled={busy !== null}
            onClick={pick}
            className="flex w-full items-center gap-3 rounded-xl bg-card px-4 py-3 text-left ring-1 ring-border transition-colors hover:bg-accent disabled:opacity-60"
          >
            {busy === "pick" ? <LoaderCircle className="size-5 shrink-0 animate-spin text-primary" /> : <FolderOpen className="size-5 shrink-0 text-primary" />}
            <span className="min-w-0">
              <span className="block text-[14px] font-medium">Open a folder on this computer</span>
              <span className="block text-[12px] text-muted-foreground">
                {busy === "pick" ? "Choose the folder in the window that opened…" : "Something you already have, like a website or a school project."}
              </span>
            </span>
          </button>

          <div>
            <p className="flex items-center gap-1.5 px-1 pb-1.5 text-[12px] font-medium text-muted-foreground"><FolderPlus className="size-3.5" /> Or start a new one</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Give it a name, like My game"
              disabled={busy !== null}
              aria-label="New project name"
              className="h-10 w-full rounded-[10px] bg-accent px-3 text-[14px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
            />
          </div>

          <div className="space-y-2">
            <button
              disabled={!name.trim() || busy !== null}
              onClick={create}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy === "create" && <LoaderCircle className="size-4 animate-spin" />} Start project
            </button>
            <button disabled={busy !== null} onClick={() => onOpenChange(false)} className="h-10 w-full rounded-[10px] text-[14px] text-primary transition-colors hover:bg-accent disabled:opacity-40">
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
