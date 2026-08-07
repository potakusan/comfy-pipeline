'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { LoraEntry } from '@/lib/comfy';
import DownloadSection from '@/components/models/model-download-section';
import ModelList from '@/components/models/model-list';

export interface ModelManagerDialogProps {
  open: boolean;
  onClose: () => void;
  onAddLora?: (entry: LoraEntry) => void;
  onRemoveLora?: (name: string) => void;
  onSelectCheckpoint?: (fileName: string) => void;
  addedLoraNames?: Set<string>;
  activeCheckpoint?: string;
}

export default function ModelManagerDialog({
  open,
  onClose,
  onAddLora,
  onRemoveLora,
  onSelectCheckpoint,
  addedLoraNames = new Set(),
  activeCheckpoint = '',
}: ModelManagerDialogProps) {
  const [tab, setTab] = useState<'lora' | 'checkpoint'>('lora');
  const [loraRefreshSignal, setLoraRefreshSignal] = useState(0);
  const [ckptRefreshSignal, setCkptRefreshSignal] = useState(0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex h-[88vh] max-w-5xl! w-full! flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="text-sm">モデル管理</DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as 'lora' | 'checkpoint')}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="shrink-0">
            <TabsTrigger value="lora" className="text-xs">
              LoRA
            </TabsTrigger>
            <TabsTrigger value="checkpoint" className="text-xs">
              チェックポイント
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="lora"
            className="flex min-h-0 flex-1 flex-col gap-3 mt-3 data-[state=inactive]:hidden"
            forceMount
          >
            <DownloadSection
              type="lora"
              onDownloadComplete={() => setLoraRefreshSignal((k) => k + 1)}
            />
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
              <ModelList
                type="lora"
                refreshSignal={loraRefreshSignal}
                onAddLora={onAddLora}
                onRemoveLora={onRemoveLora}
                addedLoraNames={addedLoraNames}
                activeCheckpoint={activeCheckpoint}
              />
            </div>
          </TabsContent>

          <TabsContent
            value="checkpoint"
            className="flex min-h-0 flex-1 flex-col gap-3 mt-3 data-[state=inactive]:hidden"
            forceMount
          >
            <DownloadSection
              type="checkpoint"
              onDownloadComplete={() => setCkptRefreshSignal((k) => k + 1)}
            />
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
              <ModelList
                type="checkpoint"
                refreshSignal={ckptRefreshSignal}
                onSelectCheckpoint={onSelectCheckpoint}
                addedLoraNames={addedLoraNames}
                activeCheckpoint={activeCheckpoint}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
