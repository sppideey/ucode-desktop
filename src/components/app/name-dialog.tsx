"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

const alertBox = "w-[280px] gap-0 overflow-hidden rounded-2xl bg-popover p-0 shadow-2xl backdrop-blur-xl";
const alertButton = "h-10 rounded-none border-0 text-[13px] transition-colors hover:bg-accent";

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
      <DialogContent showCloseButton={false} className={`${alertBox} text-center sm:max-w-[280px]`}>
        <div className="px-4 pb-3.5 pt-4">
          <DialogTitle className="text-[14px] font-semibold leading-snug">{title}</DialogTitle>
          <DialogDescription className="mt-1 text-[12.5px] leading-snug text-foreground/75">{description}</DialogDescription>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 120))}
            onKeyDown={(e) => e.key === "Enter" && save()}
            onFocus={(e) => e.target.select()}
            aria-label={title}
            className="mt-3 h-7 w-full rounded-md border bg-background px-2 text-left text-[13px] outline-none focus:border-primary"
          />
        </div>
        <div className="grid grid-cols-2 divide-x border-t">
          <button type="button" onClick={() => onOpenChange(false)} className={`${alertButton} text-primary`}>Cancel</button>
          <button type="button" onClick={save} disabled={!name.trim()} className={`${alertButton} font-semibold text-primary disabled:opacity-40`}>{action}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** An iOS-style "are you sure?" with Cancel and a red action: deleting a chat, clearing them all. */
export function ConfirmDialog({ open, onOpenChange, title, description, action, onConfirm }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  action: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm" className={`${alertBox} data-[size=sm]:max-w-[280px]`}>
        <AlertDialogHeader className="place-items-center gap-1 px-4 pb-3.5 pt-4 text-center">
          <AlertDialogTitle className="text-[14px] font-semibold">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-[12.5px] leading-snug text-foreground/75">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="m-0 grid grid-cols-2 gap-0 divide-x border-t bg-transparent p-0">
          <AlertDialogCancel variant="ghost" className={`${alertButton} font-normal text-primary`}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="ghost" className={`${alertButton} font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive`} onClick={onConfirm}>{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
