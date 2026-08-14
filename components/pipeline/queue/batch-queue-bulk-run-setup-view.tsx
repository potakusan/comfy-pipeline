"use client";
import { useState } from "react";
import {
  type BatchRunOverrides,
  type BatchPresetSet,
  type LoraEntry,
  type Preset,
  type GenerationSettings,
} from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import SamplerSettings from "@/components/pipeline/sampler-settings";
import { Play, ChevronUp, ChevronDown } from "lucide-react";

const chipClass = (active: boolean) =>
  `rounded border px-2 py-0.5 text-[10px] transition-colors ${
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border text-muted-foreground hover:border-muted-foreground"
  }`;

// ---------------------------------------------------------------------------
// Per-set config panel (collapsible)
// ---------------------------------------------------------------------------

interface SetConfigProps {
  set: BatchPresetSet;
  variableLoras: LoraEntry[];
  physicalPresets: Preset[];
  scenePresets: Preset[];
  overrides: BatchRunOverrides;
  onChange: (overrides: BatchRunOverrides) => void;
}

function SetConfig({
  set,
  variableLoras,
  physicalPresets,
  scenePresets,
  overrides,
  onChange,
}: SetConfigProps) {
  const [open, setOpen] = useState(true);
  const [samplerOpen, setSamplerOpen] = useState(false);

  const togglePhysical = (preset: Preset) => {
    const has = overrides.physicalPresets.some((p) => p.id === preset.id);
    onChange({
      ...overrides,
      physicalPresets: has
        ? overrides.physicalPresets.filter((p) => p.id !== preset.id)
        : [...overrides.physicalPresets, preset],
    });
  };

  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold"
      >
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate">{set.name}</span>
        <span className="shrink-0 text-[10px] font-normal text-muted-foreground">
          {set.presets.length}プリセット
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t px-3 py-3">
          {/* 可変LoRA */}
          <div>
            <p className="mb-1.5 text-xs font-semibold">可変LoRA</p>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => onChange({ ...overrides, variableLora: null })}
                className={chipClass(!overrides.variableLora)}
              >
                なし
              </button>
              {variableLoras.map((lora) => {
                const label =
                  lora.name.split("/").pop()?.replace(".safetensors", "") ?? lora.name;
                const active = overrides.variableLora?.name === lora.name;
                return (
                  <button
                    key={lora.name}
                    onClick={() =>
                      onChange({ ...overrides, variableLora: active ? null : lora })
                    }
                    className={chipClass(active)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 身体的特徴 */}
          <div>
            <p className="mb-1.5 text-xs font-semibold">身体的特徴</p>
            {physicalPresets.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">プリセットなし</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {physicalPresets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => togglePhysical(p)}
                    className={chipClass(
                      overrides.physicalPresets.some((x) => x.id === p.id),
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* シーン */}
          <div>
            <p className="mb-1.5 text-xs font-semibold">シーン</p>
            {scenePresets.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">プリセットなし</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => onChange({ ...overrides, scenePreset: null })}
                  className={chipClass(!overrides.scenePreset)}
                >
                  なし
                </button>
                {scenePresets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      onChange({
                        ...overrides,
                        scenePreset: overrides.scenePreset?.id === p.id ? null : p,
                      })
                    }
                    className={chipClass(overrides.scenePreset?.id === p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* サンプラー設定 (折りたたみ) */}
          <div>
            <button
              onClick={() => setSamplerOpen((v) => !v)}
              className="flex w-full items-center gap-1.5 text-xs font-semibold"
            >
              {samplerOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              サンプラー設定
            </button>
            {samplerOpen && (
              <div className="mt-2 rounded-lg border bg-card p-3">
                <SamplerSettings
                  settings={overrides.settings}
                  onChange={(settings) => onChange({ ...overrides, settings })}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk run setup view
// ---------------------------------------------------------------------------

interface BulkRunSetupViewProps {
  sets: BatchPresetSet[];
  variableLoras: LoraEntry[];
  physicalPresets: Preset[];
  scenePresets: Preset[];
  initialSettings: GenerationSettings;
  onConfirm: (entries: { set: BatchPresetSet; overrides: BatchRunOverrides }[]) => void;
  onCancel: () => void;
}

export default function BulkRunSetupView({
  sets,
  variableLoras,
  physicalPresets,
  scenePresets,
  initialSettings,
  onConfirm,
  onCancel,
}: BulkRunSetupViewProps) {
  const [overridesById, setOverridesById] = useState<Record<string, BatchRunOverrides>>(
    () =>
      Object.fromEntries(
        sets.map((set) => [
          set.id,
          {
            variableLora: null,
            physicalPresets: [],
            scenePreset: null,
            settings: initialSettings,
          } satisfies BatchRunOverrides,
        ]),
      ),
  );

  const handleConfirm = () => {
    onConfirm(sets.map((set) => ({ set, overrides: overridesById[set.id] })));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-2">
          {sets.map((set) => (
            <SetConfig
              key={set.id}
              set={set}
              variableLoras={variableLoras}
              physicalPresets={physicalPresets}
              scenePresets={scenePresets}
              overrides={overridesById[set.id]}
              onChange={(overrides) =>
                setOverridesById((prev) => ({ ...prev, [set.id]: overrides }))
              }
            />
          ))}
        </div>
      </div>

      <div className="shrink-0 flex gap-2 border-t px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 text-xs"
          onClick={onCancel}
        >
          キャンセル
        </Button>
        <Button
          size="sm"
          className="flex-1 gap-1.5 text-xs"
          onClick={handleConfirm}
        >
          <Play className="h-3.5 w-3.5" />
          {sets.length}件をまとめて実行
        </Button>
      </div>
    </div>
  );
}
