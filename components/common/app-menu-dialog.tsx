"use client";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface AppMenuItem {
  key: string;
  icon: LucideIcon;
  label: string;
  description: string;
  href?: string;
  active?: boolean;
  onSelect?: () => void;
}

interface AppMenuDialogProps {
  open: boolean;
  onClose: () => void;
  items: AppMenuItem[];
}

export default function AppMenuDialog({ open, onClose, items }: AppMenuDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>メニュー</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((item) => {
            const Icon = item.icon;
            const cardClass = cn(
              "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
              item.active
                ? "cursor-default border-primary bg-accent/50"
                : "hover:bg-accent",
            );
            const inner = (
              <>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {item.label}
                    {item.active && (
                      <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                        (現在のページ)
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">{item.description}</span>
                </span>
              </>
            );

            if (item.href) {
              return item.active ? (
                <span key={item.key} className={cardClass}>
                  {inner}
                </span>
              ) : (
                <a key={item.key} href={item.href} className={cardClass}>
                  {inner}
                </a>
              );
            }

            return (
              <button
                key={item.key}
                type="button"
                disabled={item.active}
                onClick={() => {
                  item.onSelect?.();
                  onClose();
                }}
                className={cardClass}
              >
                {inner}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
