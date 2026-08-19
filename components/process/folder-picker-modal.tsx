import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw, FolderOpen, Check } from "lucide-react";
import type { FolderInfo } from "@/app/api/process/dirs/route";
import { thumbUrl } from "@/components/process/process-helpers";

export default function FolderPickerModal({
  open,
  folders,
  selected,
  loading,
  onRefresh,
  onSelect,
  onClose,
}: {
  open: boolean;
  folders: FolderInfo[];
  selected: string;
  loading: boolean;
  onRefresh: () => void;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-[90vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FolderOpen className="h-4 w-4" />
            処理対象フォルダを選択
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 gap-1 text-[11px]"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw
                className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
              />
              更新
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[75vh] pr-3">
          {folders.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
              {loading ? "読み込み中..." : "フォルダが見つかりません"}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {folders.map((folder) => {
                const isSelected = selected === folder.name;
                return (
                  <button
                    key={folder.name}
                    onClick={() => {
                      onSelect(folder.name);
                      onClose();
                    }}
                    className={`group relative overflow-hidden rounded-xl border text-left transition-all hover:border-primary/60 hover:shadow-lg ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border bg-card/30"
                    }`}
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/30">
                      {folder.firstImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbUrl(folder.firstImage)}
                          alt={folder.name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <FolderOpen className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary shadow">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="px-3 py-2">
                      <p className="truncate font-mono text-[11px] font-medium leading-tight">
                        {folder.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {folder.count} 枚
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
