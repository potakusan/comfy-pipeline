"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DeleteConfirmDialog from "@/components/common/delete-confirm-dialog";
import { Plus, Trash2, Pencil, ChevronDown, Check } from "lucide-react";
import { type CoupleConfig } from "@/lib/couple";

export default function ConfigSelector({
  configs,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  configs: CoupleConfig[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<CoupleConfig | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const active = configs.find((c) => c.id === activeId) ?? configs[0];

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 flex-1 justify-between gap-1 truncate text-xs"
          >
            <span className="truncate">{active?.name ?? "設定を選択"}</span>
            <ChevronDown className="h-3 w-3 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {configs.map((c) => (
            <DropdownMenuItem
              key={c.id}
              className="flex items-center gap-2 text-xs"
              onSelect={() => onSelect(c.id)}
            >
              {c.id === activeId ? (
                <Check className="h-3 w-3 shrink-0" />
              ) : (
                <span className="h-3 w-3 shrink-0" />
              )}
              <span className="flex-1 truncate">{c.name}</span>
              <button
                className="p-0.5 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameTarget(c);
                  setRenameDraft(c.name);
                  setRenameOpen(true);
                }}
              >
                <Pencil className="h-3 w-3" />
              </button>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-xs"
            onSelect={() => setCreateOpen(true)}
          >
            <Plus className="h-3 w-3" />
            新規設定を作成
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        disabled={configs.length <= 1}
        title="この設定を削除"
        aria-label="この設定を削除"
        onClick={() => setDeleteConfirmOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={`「${active?.name}」を削除しますか?`}
        onConfirm={() => {
          onDelete(activeId);
          setDeleteConfirmOpen(false);
        }}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">新規設定を作成</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="設定名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                onCreate(newName.trim());
                setNewName("");
                setCreateOpen(false);
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              size="sm"
              disabled={!newName.trim()}
              onClick={() => {
                onCreate(newName.trim());
                setNewName("");
                setCreateOpen(false);
              }}
            >
              作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">設定名を変更</DialogTitle>
          </DialogHeader>
          <Input
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameDraft.trim() && renameTarget) {
                onRename(renameTarget.id, renameDraft.trim());
                setRenameOpen(false);
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              size="sm"
              disabled={!renameDraft.trim()}
              onClick={() => {
                if (renameTarget) onRename(renameTarget.id, renameDraft.trim());
                setRenameOpen(false);
              }}
            >
              変更
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
