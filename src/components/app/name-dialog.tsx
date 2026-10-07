"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  initial?: string;
  action: string;
  onSave: (name: string) => void;
};

/** One small box for a name, like an iOS alert with a text field: renaming a chat. */
export function NameDialog({ open, onOpenChange, title, description, initial = "", action, onSave }: Props) {
  const [name, setName] = useState(initial);
  useEffect(() => { if (open) setName(initial); }, [open, initial]);

  const save = () => {
    if (!name.trim()) return;
    onSave(name.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[300px] gap-0 overflow-hidden rounded-2xl bg-popover p-0 text-center shadow-2xl backdrop-blur-xl sm:max-w-[300px]">
        <div className="px-5 pb-4 pt-5">
          <DialogTitle className="text-[15px] font-semibold leading-snug">{title}</DialogTitle>
          <DialogDescription className="mt-1 text-[13px] leading-snug text-foreground/80">{description}</DialogDescription>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 120))}
            onKeyDown={(e) => e.key === "Enter" && save()}
            onFocus={(e) => e.target.select()}
            aria-label={title}
            className="mt-4 h-8 w-full rounded-[8px] border bg-background px-2.5 text-left text-[13px] outline-none focus:border-primary"
          />
        </div>
        <div className="grid grid-cols-2 divide-x border-t">
          <button onClick={() => onOpenChange(false)} className="h-11 text-[15px] text-primary transition-colors hover:bg-accent">Cancel</button>
          <button onClick={save} disabled={!name.trim()} className="h-11 text-[15px] font-semibold text-primary transition-colors hover:bg-accent disabled:opacity-40">{action}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
