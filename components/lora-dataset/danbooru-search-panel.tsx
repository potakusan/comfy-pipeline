"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Search } from "lucide-react";
import type { DanbooruRating } from "@/lib/lora-dataset/types";

interface Props {
  loading: boolean;
  onSearch: (tags: string, rating: DanbooruRating | "") => void;
}

export default function DanbooruSearchPanel({ loading, onSearch }: Props) {
  const [tags, setTags] = useState("");
  const [rating, setRating] = useState<DanbooruRating | "">("");

  const submit = () => {
    if (!tags.trim()) return;
    onSearch(tags.trim(), rating);
  };

  return (
    <div className="flex items-end gap-2 border-b p-3">
      <div className="flex-1 space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Danbooruタグ検索</label>
        <Input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="1girl solo long_hair"
          className="text-xs"
        />
      </div>
      <div className="w-32 space-y-1">
        <label className="text-xs font-medium text-muted-foreground">レーティング</label>
        <NativeSelect
          size="sm"
          value={rating}
          onChange={(e) => setRating(e.target.value as DanbooruRating | "")}
        >
          <NativeSelectOption value="">指定なし</NativeSelectOption>
          <NativeSelectOption value="g">General</NativeSelectOption>
          <NativeSelectOption value="s">Sensitive</NativeSelectOption>
          <NativeSelectOption value="q">Questionable</NativeSelectOption>
          <NativeSelectOption value="e">Explicit</NativeSelectOption>
        </NativeSelect>
      </div>
      <Button size="sm" className="gap-1.5" onClick={submit} disabled={loading || !tags.trim()}>
        <Search className="h-3.5 w-3.5" />
        検索
      </Button>
    </div>
  );
}
