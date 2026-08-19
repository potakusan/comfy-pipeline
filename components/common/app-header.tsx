"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { HardDrive, Wand2, Images, Settings, Tags } from "lucide-react";
import ModelManagerDialog from "@/components/models/model-manager-dialog";
import SettingsDialog from "@/components/settings/settings-dialog";
import type { LoraEntry } from "@/lib/comfy";

export type AppHeaderActive = "home" | "process" | "gallery" | "setup" | "lora-dataset";

interface AppHeaderProps {
  active: AppHeaderActive;
  /** Page-specific extra content (connection badges, export/import, etc.),
   * rendered right after the title and before the common nav buttons. */
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
        onClick={() => setModelManagerOpen(true)}
      >
        <HardDrive className="h-3.5 w-3.5" />
        モデル管理
      </Button>
      <Separator orientation="vertical" className="h-4" />

      {active !== "process" && (
        <>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" asChild>
            <a href="/process">
              <Wand2 className="h-3.5 w-3.5" />
              画像処理
            </a>
          </Button>
          <Separator orientation="vertical" className="h-4" />
        </>
      )}

      {active !== "gallery" && (
        <>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" asChild>
            <a href="/gallery">
              <Images className="h-3.5 w-3.5" />
              ギャラリー
            </a>
          </Button>
          <Separator orientation="vertical" className="h-4" />
        </>
      )}

      {active !== "lora-dataset" && (
        <>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" asChild>
            <a href="/lora-dataset">
              <Tags className="h-3.5 w-3.5" />
              LoRAデータセット
            </a>
          </Button>
          <Separator orientation="vertical" className="h-4" />
        </>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => setSettingsOpen(true)}
      >
        <Settings className="h-3.5 w-3.5" />
        設定
      </Button>

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
