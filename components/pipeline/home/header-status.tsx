"use client";
import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, Download, Upload } from "lucide-react";
import type { PipelineHook } from "@/hooks/pipeline/use-pipeline";

export interface HeaderStatusProps {
  pipeline: PipelineHook;
  pendingCount: number;
}

export default function HeaderStatus({ pipeline, pendingCount }: HeaderStatusProps) {
  const { wsConnected, isProcessing, exportData, importData } = pipeline;
  const importInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {wsConnected ? (
        <Wifi className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
      )}

      {isProcessing ? (
        <Badge variant="default" className="gap-1.5 text-xs">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-300" />
          生成中
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          接続しました
        </Badge>
      )}
      {pendingCount > 0 && (
        <Badge variant="secondary" className="text-xs">
          待機 {pendingCount}件
        </Badge>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={exportData}
        title="設定をエクスポート"
      >
        <Download className="h-3.5 w-3.5" />
        エクスポート
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => importInputRef.current?.click()}
        title="設定をインポート"
      >
        <Upload className="h-3.5 w-3.5" />
        インポート
      </Button>
      <input
        ref={importInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importData(file);
          e.target.value = "";
        }}
      />
    </>
  );
}
