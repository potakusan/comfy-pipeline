"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { HardDrive, Wand2, Images, Settings, Tags, Menu } from "lucide-react";
import ModelManagerDialog from "@/components/models/model-manager-dialog";
import SettingsDialog from "@/components/settings/settings-dialog";
import AppMenuDialog, { type AppMenuItem } from "@/components/common/app-menu-dialog";
import type { LoraEntry } from "@/lib/comfy";

export type AppHeaderActive = "home" | "process" | "gallery" | "setup" | "lora-dataset";

interface AppHeaderProps {
  active: AppHeaderActive;
  /** Page-specific extra content (connection badges, export/import, etc.),
   * rendered right after the title and before the menu button. */
  children?: ReactNode;
  onAddLora?: (entry: LoraEntry) => void;
  onRemoveLora?: (name: string) => void;
  onSelectCheckpoint?: (fileName: string) => void;
  addedLoraNames?: Set<string>;
  activeCheckpoint?: string;
  /** Controlled open state for the model manager dialog, so a page can also
   * open it from elsewhere (e.g. a "checkpoint" quick-link deep in a form).
   * Falls back to internal state when omitted. */
  modelManagerOpen?: boolean;
  onModelManagerOpenChange?: (open: boolean) => void;
}

export default function AppHeader({
  active,
  children,
  onAddLora,
  onRemoveLora,
  onSelectCheckpoint,
  addedLoraNames,
  activeCheckpoint,
  modelManagerOpen: modelManagerOpenProp,
  onModelManagerOpenChange,
}: AppHeaderProps) {
  const [internalModelManagerOpen, setInternalModelManagerOpen] = useState(false);
  const modelManagerOpen = modelManagerOpenProp ?? internalModelManagerOpen;
  const setModelManagerOpen = onModelManagerOpenChange ?? setInternalModelManagerOpen;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems: AppMenuItem[] = [
    {
      key: "models",
      icon: HardDrive,
      label: "モデル管理",
      description: "チェックポイント・LoRA・アップスケーラーの一覧管理とCivitaiからのダウンロード",
      onSelect: () => setModelManagerOpen(true),
    },
    {
      key: "process",
      icon: Wand2,
      label: "画像処理",
      description: "ComfyUIワークフローで画像を生成・アップスケール",
      href: "/process",
      active: active === "process",
    },
    {
      key: "gallery",
      icon: Images,
      label: "ギャラリー",
      description: "生成済み画像の閲覧・整理・モザイク適用",
      href: "/gallery",
      active: active === "gallery",
    },
    {
      key: "lora-dataset",
      icon: Tags,
      label: "LoRAデータセット",
      description: "Danbooruからのタグ収集とLoRA学習データセットの作成・学習",
      href: "/lora-dataset",
      active: active === "lora-dataset",
    },
    {
      key: "settings",
      icon: Settings,
      label: "設定",
      description: "ComfyUI接続先・各種フォルダ・APIキーなどの設定",
      onSelect: () => setSettingsOpen(true),
    },
  ];

  return (
    <header className="flex shrink-0 items-center gap-3 border-b px-4 py-2">
      <a href="/" className="shrink-0 text-sm font-bold tracking-tight">
        ComfyPipeline
      </a>
      <Separator orientation="vertical" className="h-4" />

      {children}

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => setMenuOpen(true)}
      >
        <Menu className="h-3.5 w-3.5" />
        メニュー
      </Button>

      <AppMenuDialog open={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />
      <ModelManagerDialog
        open={modelManagerOpen}
        onClose={() => setModelManagerOpen(false)}
        onAddLora={onAddLora}
        onRemoveLora={onRemoveLora}
        onSelectCheckpoint={onSelectCheckpoint}
        addedLoraNames={addedLoraNames}
        activeCheckpoint={activeCheckpoint}
      />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
