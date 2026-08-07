"use client";
import { useState } from "react";
import {
  type BatchRunOverrides,
  type LoraEntry,
  type Preset,
  type GenerationSettings,
} from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import SamplerSettings from "@/components/pipeline/sampler-settings";
import { Play, ChevronUp, ChevronDown } from "lucide-react";

interface RunSetupViewProps {
  variableLoras: LoraEntry[];
  physicalPresets: Preset[];
  scenePresets: Preset[];
  initialSettings: GenerationSettings;
  onConfirm: (overrides: BatchRunOverrides) => void;
  onCancel: () => void;
}

export default function RunSetupView({
  variableLoras,
  physicalPresets,
  scenePresets,
  initialSettings,
  onConfirm,
  onCancel,
}: RunSetupViewProps) {
  const [selectedLoraIdx, setSelectedLoraIdx] = useState<number | null>(null);
  const [selectedPhysicalIds, setSelectedPhysicalIds] = useState<string[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [runSettings, setRunSettings] = useState<GenerationSettings>(initialSettings);
  const [samplerOpen, setSamplerOpen] = useState(false);

  const togglePhysical = (id: string) =>
    setSelectedPhysicalIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const handleConfirm = () => {
    onConfirm({
      variableLora: selectedLoraIdx !== null ? variableLoras[selectedLoraIdx] : null,
      physicalPresets: physicalPresets.filter((p) => selectedPhysicalIds.includes(p.id)),
      scenePreset: scenePresets.find((p) => p.id === selectedSceneId) ?? null,
      settings: runSettings,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-4">
          {/* 可変LoRA */}
          <div>
            <p className="mb-1.5 text-xs font-semibold">可変LoRA</p>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedLoraIdx(null)}
                className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
                  selectedLoraIdx === null
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                なし
              </button>
              {variableLoras.map((lora, idx) => {
                const label =
                  lora.name.split("/").pop()?.replace(".safetensors", "") ?? lora.name;
                return (
                  <button
                    key={lora.name}
                    onClick={() => setSelectedLoraIdx(idx === selectedLoraIdx ? null : idx)}
                    className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
                      selectedLoraIdx === idx
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
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
                    onClick={() => togglePhysical(p.id)}
                    className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
                      selectedPhysicalIds.includes(p.id)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
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
                  onClick={() => setSelectedSceneId(null)}
                  className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
                    selectedSceneId === null
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  なし
                </button>
                {scenePresets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      setSelectedSceneId((prev) => (prev === p.id ? null : p.id))
                    }
                    className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
                      selectedSceneId === p.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
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
                <SamplerSettings settings={runSettings} onChange={setRunSettings} />
              </div>
            )}
          </div>
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
          実行
        </Button>
      </div>
    </div>
  );
}
