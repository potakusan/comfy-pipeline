"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FolderInput } from "lucide-react";
import { toast } from "sonner";
import { formatDateYmd, sanitizeFolderName } from "@/lib/gallery-release-copy";

const LS_CHARACTER = "cp_release_copy_character";
const LS_GROUP = "cp_release_copy_group";

function lsRead(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

/** モザイク処理済み画像を、リリース用フォルダへ 01,02,... に振り直してコピーする */
export default function GalleryReleaseCopyDialog({
  open,
  onClose,
  paths,
}: {
  open: boolean;
  onClose: () => void;
  /** outputDirからの相対パス("<folder>/mosaic/...") */
  paths: string[];
}) {
  // 開くたびにマウントし直し、前回の入力(localStorage)を初期値にする
  return open ? <ReleaseCopyContent onClose={onClose} paths={paths} /> : null;
}

function ReleaseCopyContent({ onClose, paths }: { onClose: () => void; paths: string[] }) {
  const [character, setCharacter] = useState(() => lsRead(LS_CHARACTER));
  const [group, setGroup] = useState(() => lsRead(LS_GROUP));
  const [copying, setCopying] = useState(false);

  const ymd = formatDateYmd(new Date());
  const c = sanitizeFolderName(character);
  const g = sanitizeFolderName(group);
  const preview = c && g ? ["X:", ymd.slice(0, 6), `${ymd}_${c}`, g, ""].join("\\") : null;

  const handleCopy = async () => {
    setCopying(true);
    try {
      const res = await fetch("/api/gallery/mosaic/copy-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths, character, group }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "コピーに失敗しました");
      try {
        localStorage.setItem(LS_CHARACTER, character);
        localStorage.setItem(LS_GROUP, group);
      } catch {}
      toast.success(`${data.copied}枚をコピーしました（${data.firstName}〜${data.lastName}） → ${data.destDir}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "コピーに失敗しました");
    } finally {
      setCopying(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">リリース用フォルダへコピー（{paths.length}枚）</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 text-xs">キャラクター名</Label>
            <Input value={character} onChange={(e) => setCharacter(e.target.value)} placeholder="例: エレン・ジョー" />
          </div>
          <div>
            <Label className="mb-1 text-xs">グループ名（連番フォルダの名前）</Label>
            <Input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="例: 前戯・フェラ" />
          </div>
          <p className="rounded bg-muted/40 p-2 font-mono text-[11px] break-all text-muted-foreground">
            {preview ? `${preview}01, 02, ...` : "コピー先: キャラクター名とグループ名を入力してください"}
          </p>
          <Button className="w-full gap-1.5" size="sm" disabled={!preview || copying} onClick={handleCopy}>
            {copying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderInput className="h-3.5 w-3.5" />}
            コピー
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
