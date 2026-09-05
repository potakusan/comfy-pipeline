"use client";
import { type BatchPreset } from "@/lib/comfy";
import { Checkbox } from "@/components/ui/checkbox";
import { Images } from "lucide-react";

interface PresetI2iTogglesProps {
  presets: BatchPreset[];
  /** i2i(下絵)を今回の実行で使うプリセットIDの一覧 */
  enabledIds: string[];
  onChange: (ids: string[]) => void;
}

/**
 * セット編集で下絵(imageRef / imageRefPool)を設定済みのプリセットについて、
 * 今回の実行で i2i を使うかをプリセット単位で選ばせる。既定は全てオフ。
 * 下絵設定のあるプリセットが1つも無ければ何も表示しない。
 */
export default function PresetI2iToggles({
  presets,
  enabledIds,
  onChange,
}: PresetI2iTogglesProps) {
  const withI2i = presets.filter((p) => p.imageRefPool || p.imageRef);
  if (withI2i.length === 0) return null;

  const allOn = withI2i.every((p) => enabledIds.includes(p.id));
  const toggle = (id: string) =>
    onChange(
      enabledIds.includes(id)
        ? enabledIds.filter((x) => x !== id)
        : [...enabledIds, id],
    );
  const toggleAll = () =>
    onChange(allOn ? [] : withI2i.map((p) => p.id));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="flex items-center gap-1 text-xs font-semibold">
          <Images className="h-3 w-3" />
          参照画像 / 下絵（今回の実行で使う）
        </p>
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Checkbox checked={allOn} onCheckedChange={toggleAll} />
          すべて
        </label>
      </div>
      <div className="space-y-1 rounded-lg border p-2">
        {withI2i.map((p) => (
          <label
            key={p.id}
            className="flex cursor-pointer items-center gap-2 text-[11px]"
          >
            <Checkbox
              checked={enabledIds.includes(p.id)}
              onCheckedChange={() => toggle(p.id)}
            />
            <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {p.imageRefPool
                ? `プール「${p.imageRefPool.group}」`
                : "単一画像"}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
