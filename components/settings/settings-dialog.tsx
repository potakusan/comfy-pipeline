"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
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
      { key: "outputDir", label: "出力フォルダ (COMFYUI_OUTPUT_DIR)" },
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
      { key: "loraDatasetDir", label: "データセット保存フォルダ (LORA_DATASET_DIR)" },
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
  const [envOverrides, setEnvOverrides] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ config?: SetupConfig; envOverrides?: Partial<Record<FieldKey, boolean>> }>(
        "/api/settings",
      );
      setConfig(data.config ?? {});
      setEnvOverrides(data.envOverrides ?? {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {FIELD_GROUPS.map((group) => (
              <div key={group.title} className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.title}
                </p>
                {group.fields.map((f) => {
                  const disabled = !!envOverrides[f.key];
                  return (
                    <div key={f.key} className="space-y-1">
                      <Label htmlFor={f.key} className="text-xs">
                        {f.label}
                      </Label>
                      <Input
                        id={f.key}
                        value={config[f.key] ?? ""}
                        placeholder={f.placeholder}
                        disabled={disabled}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, [f.key]: e.target.value }))
                        }
                      />
                      {disabled && (
                        <p className="text-[10px] text-muted-foreground">
                          環境変数で設定されているため変更できません
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
