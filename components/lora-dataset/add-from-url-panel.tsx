"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link2, Loader2 } from "lucide-react";

interface Props {
  disabled: boolean;
  onAdd: (url: string) => Promise<void>;
}

export default function AddFromUrlPanel({ disabled, onAdd }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!url.trim() || loading) return;
    setLoading(true);
    try {
      await onAdd(url.trim());
      setUrl("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1 border-b p-3">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">画像URLから追加（tagger自動タグ付け）</label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="https://..."
            className="text-xs"
            disabled={disabled || loading}
          />
        </div>
        <Button size="sm" className="gap-1.5" onClick={submit} disabled={disabled || loading || !url.trim()}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          {loading ? "タグ付け中..." : "追加"}
        </Button>
      </div>
      {loading && (
        <p className="text-[10px] text-muted-foreground">初回はtaggerモデルのダウンロードで数分かかることがあります</p>
      )}
    </div>
  );
}
