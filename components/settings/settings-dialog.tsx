"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SetupConfig } from "@/lib/setup/config";
import { apiFetch } from "@/lib/api-client";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

type FieldKey = keyof SetupConfig;

const FIELD_GROUPS: { title: string; fields: { key: FieldKey; label: string; placeholder?: string }[] }[] = [
  {
    title: "ComfyUI接続",
    fields: [
      { key: "comfyuiUrl", label: "ComfyUI URL", placeholder: "http://localhost:8188" },
      { key: "comfyuiApiKey", label: "ComfyUI API Key" },
      { key: "comfyuiPath", label: "ComfyUIインストールパス" },
    ],
  },
  {
    title: "出力・モデルフォルダ",
    fields: [
      { key: "outputDir", label: "出力フォルダ" },
      { key: "checkpointDir", label: "チェックポイントフォルダ" },
      { key: "loraDir", label: "LoRAフォルダ" },
      { key: "upscalerDir", label: "アップスケーラーフォルダ" },
    ],
  },
  {
    title: "リモート",
    fields: [{ key: "remoteProcessUrl", label: "リモート処理サーバーURL" }],
  },
  {
    title: "その他",
    fields: [{ key: "civitaiApiKey", label: "Civitai API Key" }],
  },
  {
    title: "LoRAデータセット",
    fields: [
      { key: "loraDatasetDir", label: "データセット保存フォルダ" },
      { key: "danbooruLogin", label: "Danbooru ユーザー名" },
      { key: "danbooruApiKey", label: "Danbooru API Key" },
    ],
  },
  {
    title: "Kohya's GUI / LoRA学習",
    fields: [
      { key: "kohyaGuiPath", label: "Kohya's GUI / sd-scriptsインストールフォルダ" },
    ],
  },
];

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [config, setConfig] = useState<SetupConfig>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeGroup, setActiveGroup] = useState(FIELD_GROUPS[0].title);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ config?: SetupConfig }>("/api/settings");
      setConfig(data.config ?? {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      load();
      setActiveGroup(FIELD_GROUPS[0].title);
    }
  }, [open, load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      window.location.reload();
    } catch {
      setSaving(false);
    }
  };

  const group = FIELD_GROUPS.find((g) => g.title === activeGroup) ?? FIELD_GROUPS[0];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex h-[70vh] max-h-160 flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>設定</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            <nav className="w-40 shrink-0 space-y-0.5 overflow-y-auto border-r p-2">
              {FIELD_GROUPS.map((g) => (
                <button
                  key={g.title}
                  type="button"
                  onClick={() => setActiveGroup(g.title)}
                  className={cn(
                    "block w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                    g.title === activeGroup
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50",
                  )}
                >
                  {g.title}
                </button>
              ))}
            </nav>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {group.fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label htmlFor={f.key} className="text-xs">
                    {f.label}
                  </Label>
                  <Input
                    id={f.key}
                    value={config[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
