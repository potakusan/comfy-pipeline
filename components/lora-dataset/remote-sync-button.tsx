"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UploadCloud, Loader2, Check } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";

interface Props {
  folder: string;
}

export default function RemoteSyncButton({ folder }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [done, setDone] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    setDone(false);
    try {
      const result = await apiFetch<{ count: number }>("/api/lora-dataset/upload-to-remote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder }),
      });
      toast.success(`リモートへ${result.count}件のファイルを同期しました`);
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "同期に失敗しました");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleSync} disabled={syncing}>
      {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? <Check className="h-3.5 w-3.5" /> : <UploadCloud className="h-3.5 w-3.5" />}
      リモートへ同期
    </Button>
  );
}
