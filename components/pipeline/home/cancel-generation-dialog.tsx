"use client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Kbd } from "@/components/ui/kbd";

export interface CancelGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export default function CancelGenerationDialog({
  open,
  onOpenChange,
  onConfirm,
}: CancelGenerationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>生成を中止しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            現在実行中のキューアイテムを中止します。この操作は元に戻せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="gap-2 text-xs">
            キャンセル <Kbd>Esc</Kbd>
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            autoFocus
            className="gap-2 text-xs"
            onClick={onConfirm}
          >
            中止する <Kbd>Enter</Kbd>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
