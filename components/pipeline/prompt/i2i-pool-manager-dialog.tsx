"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";
import { Upload, Trash2, FolderPlus, Plus, PackagePlus } from "lucide-react";

export interface I2iGroup {
  path: string;
  depth: number;
  count: number;
  /** サムネ表示用の画像 .i2i 相対パス(先頭最大4件) */
  thumbnails: string[];
}

export function i2iImageUrl(path: string, thumb = false) {
  return `/api/i2i/image?path=${encodeURIComponent(path)}${thumb ? "&thumb=1" : ""}`;
}

interface I2iPoolManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** セット時、上部に「この画像を追加」ボタンを出す(出力ディレクトリ相対パス) */
  addSourcePath?: string;
  /** グループ一覧が変化したときの通知(呼び出し側の再ステージ用) */
  onGroupsChanged?: () => void;
}

/**
 * 構図プール(.i2i)の管理。グループの作成、画像のアップロード/削除、
 * ギャラリー画像の追加を行う。パイプラインの参照画像セクションとギャラリー
 * ページの両方から開く。
 */
export default function I2iPoolManagerDialog({
  open,
  onOpenChange,
  addSourcePath,
  onGroupsChanged,
}: I2iPoolManagerDialogProps) {
  const [groups, setGroups] = useState<I2iGroup[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [newGroup, setNewGroup] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadGroups = useCallback(
    () =>
      apiFetch<{ groups: I2iGroup[] }>("/api/i2i/groups")
        .then((res) => setGroups(res.groups))
        .catch((e) => setError(e instanceof Error ? e.message : String(e))),
    [],
  );

  const loadImages = useCallback(
    (group: string | null) =>
      group
        ? apiFetch<{ images: { path: string }[] }>(
            `/api/i2i/images?group=${encodeURIComponent(group)}`,
          )
            .then((res) => setImages(res.images.map((i) => i.path)))
            .catch(() => setImages([]))
        : Promise.resolve(setImages([])),
    [],
  );

  useEffect(() => {
    if (open) loadGroups();
  }, [open, loadGroups]);

  const pickGroup = (group: string | null) => {
    setSelected(group);
    void loadImages(group);
  };

  const effectiveGroup = selected ?? newGroup.trim();

  /** ミューテーション後: グループ一覧と、対象グループの画像を再読み込みする。 */
  const refreshFor = async (group: string) => {
    if (!selected) setSelected(group);
    await Promise.all([loadGroups(), loadImages(group)]);
    onGroupsChanged?.();
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !effectiveGroup) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("group", effectiveGroup);
        form.append("image", file, file.name);
        const res = await fetch("/api/i2i/upload", { method: "POST", body: form });
        if (!res.ok) throw new Error(`アップロード失敗 (HTTP ${res.status})`);
      }
      setNewGroup("");
      await refreshFor(effectiveGroup);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAddSource = async () => {
    if (!addSourcePath || !effectiveGroup) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/i2i/add", {
        method: "POST",
        body: JSON.stringify({ group: effectiveGroup, sourcePath: addSourcePath }),
      });
      setNewGroup("");
      await refreshFor(effectiveGroup);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (path: string) => {
    setBusy(true);
    try {
      await apiFetch("/api/i2i/image", {
        method: "DELETE",
        body: JSON.stringify({ path }),
      });
      if (effectiveGroup) await refreshFor(effectiveGroup);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleImportReleased = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch<{
        added: number;
        skipped: number;
        byPose: Record<string, number>;
      }>("/api/i2i/import-released", { method: "POST" });
      const poses = Object.entries(res.byPose);
      setNotice(
        `${res.added}枚を取り込み（既存${res.skipped}枚はスキップ）` +
          (poses.length
            ? ` — ${poses.map(([p, n]) => `${p}:${n}`).join(" / ")}`
            : ""),
      );
      await loadGroups();
      if (selected) await loadImages(selected);
      onGroupsChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl! flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle className="text-sm">構図プール管理</DialogTitle>
        </DialogHeader>

        {addSourcePath && (
          <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2 text-[11px]">
            <span className="truncate text-muted-foreground" title={addSourcePath}>
              追加元: {addSourcePath.split("/").pop()}
            </span>
            <Button
              size="sm"
              className="ml-auto h-7 gap-1 text-xs"
              disabled={busy || !effectiveGroup}
              onClick={handleAddSource}
            >
              <Plus className="h-3 w-3" />
              {effectiveGroup ? `「${effectiveGroup}」へ追加` : "グループを選択"}
            </Button>
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          {/* グループ一覧 */}
          <div className="flex w-56 shrink-0 flex-col border-r">
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {groups.length === 0 && (
                <p className="px-1 py-2 text-[11px] text-muted-foreground">
                  グループがありません
                </p>
              )}
              {groups.map((g) => (
                <button
                  key={g.path}
                  onClick={() => pickGroup(g.path)}
                  style={{ paddingLeft: 6 + g.depth * 12 }}
                  className={`flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] transition-colors ${
                    selected === g.path
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="truncate">
                    {g.path.split("/").pop()}
                  </span>
                  <Badge variant="outline" className="ml-auto shrink-0 text-[9px]">
                    {g.count}
                  </Badge>
                </button>
              ))}
            </div>
            <div className="shrink-0 space-y-1.5 border-t p-2">
              <Input
                value={newGroup}
                onChange={(e) => {
                  setNewGroup(e.target.value);
                  pickGroup(null);
                }}
                placeholder="新規グループ (例: 座り/正面)"
                className="h-7 text-[11px]"
              />
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <FolderPlus className="h-3 w-3" />
                アップロード時に作成されます
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-full gap-1 text-[10px]"
                disabled={busy}
                title="全 *_release フォルダの画像を、ファイル名から推測したポーズ別に取り込む"
                onClick={handleImportReleased}
              >
                <PackagePlus className="h-3 w-3" />
                販売用画像をポーズ別に取り込む
              </Button>
            </div>
          </div>

          {/* 画像グリッド */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {effectiveGroup || "グループ未選択"}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-7 gap-1 text-xs"
                disabled={busy || !effectiveGroup}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3 w-3" />
                アップロード
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleUpload(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {images.length === 0 ? (
                <p className="py-8 text-center text-[11px] text-muted-foreground">
                  {effectiveGroup
                    ? "画像がありません"
                    : "左でグループを選択、または新規作成してください"}
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((p) => (
                    <div key={p} className="group relative aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={i2iImageUrl(p, true)}
                        alt=""
                        className="h-full w-full rounded-md border object-cover"
                        loading="lazy"
                      />
                      <button
                        onClick={() => handleDelete(p)}
                        disabled={busy}
                        className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <p className="shrink-0 border-t bg-destructive/10 px-4 py-1.5 text-[10px] text-destructive">
            {error}
          </p>
        )}
        {notice && !error && (
          <p className="shrink-0 border-t bg-muted/50 px-4 py-1.5 text-[10px] text-muted-foreground">
            {notice}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
