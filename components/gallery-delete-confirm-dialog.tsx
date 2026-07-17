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
import type { GalleryImageEntry } from "@/lib/gallery";

export default function GalleryDeleteConfirmDialog({
  entry,
  onOpenChange,
  onConfirm,
}: {
  entry: GalleryImageEntry | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={entry !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>画像を削除しますか?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block font-mono text-xs break-all">{entry?.filename}</span>
            この操作は取り消せません。
            {entry?.releasePath && (
              <span className="mt-1 block">
                販売用フォルダにコピーされているため、そちらも一緒に削除されます。
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            削除する
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
