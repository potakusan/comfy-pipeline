"use client";
import { useMemo, useState } from "react";
import {
  type BatchPresetSet,
  type BatchRunOverrides,
  type Preset,
  type VariableDefs,
  type VariableBindings,
  type VariablePromptSource,
  type PromptReplacement,
  collectVariableUsages,
  extractVariableNames,
  missingRequiredInputs,
} from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Plus, Trash2, ChevronDown } from "lucide-react";
import VariableBindingList from "@/components/pipeline/prompt/variable-binding-list";

interface VariableInputViewProps {
  set: BatchPresetSet;
  /** run-setup で確定済みのオーバーライド(physical/scene はここから取る) */
  overrides: BatchRunOverrides;
  /** 現在の固定タグ(一括生成でも使われるため走査対象に含める) */
  fixedTags: string;
  countPresets: Preset[];
  posePresets: Preset[];
  otherPresets: Preset[];
  variableDefs: VariableDefs;
  onDefsChange: (defs: VariableDefs) => void;
  /** 通常モードのフローティングウィンドウで入力済みの変数値(既定として引き継ぐ) */
  baseValues?: VariableBindings;
  /** シード引き継ぎ元の代表バインディング(初期値) */
  seedBindings?: VariableBindings;
  onConfirm: (
    variableValues: VariableBindings,
    promptReplacements: PromptReplacement[],
  ) => void;
  onBack: () => void;
}

/**
 * 一括キュー実行前の変数入力ステップ。選択セット内の全プリセット＋overrides から
 * `%%name%%` を集約し、未入力のものを入力させる。1変数への入力は同名変数の全出現
 * 箇所へ適用される(グローバル名前空間)。変数化していない箇所向けに解決後プロンプトへの
 * 一括 find & replace も指定できる。
 */
export default function VariableInputView({
  set,
  overrides,
  fixedTags,
  countPresets,
  posePresets,
  otherPresets,
  variableDefs,
  onDefsChange,
  baseValues,
  seedBindings,
  onConfirm,
  onBack,
}: VariableInputViewProps) {
  const { names, usages, prefill } = useMemo(() => {
    const sources: VariablePromptSource[] = [];
    if (fixedTags)
      sources.push({
        id: "__fixed__",
        label: "固定タグ",
        slot: "fixed",
        text: fixedTags,
      });
    for (const bp of set.presets) {
      const ctx = bp.name || "(無名プリセット)";
      const push = (p: Preset | null | undefined) => {
        if (p)
          sources.push({
            id: `${bp.id}:${p.id}`,
            label: `${ctx} › ${p.name}`,
            slot: p.type,
            text: p.prompt,
          });
      };
      push(countPresets.find((p) => p.id === bp.countPresetId));
      push(posePresets.find((p) => p.id === bp.posePresetId));
      for (const oid of bp.otherPresetIds)
        push(otherPresets.find((p) => p.id === oid));
      if (bp.additionalPrompt)
        sources.push({
          id: `${bp.id}:additional`,
          label: `${ctx} › 追加プロンプト`,
          slot: "additional",
          text: bp.additionalPrompt,
        });
      if (bp.fixedTags)
        sources.push({
          id: `${bp.id}:fixed`,
          label: `${ctx} › 固定タグ`,
          slot: "fixed",
          text: bp.fixedTags,
        });
    }
    for (const p of overrides.physicalPresets)
      sources.push({ id: `ov:${p.id}`, label: `身体的特徴 › ${p.name}`, slot: p.type, text: p.prompt });
    if (overrides.scenePreset)
      sources.push({
        id: `ov:${overrides.scenePreset.id}`,
        label: `シーン › ${overrides.scenePreset.name}`,
        slot: overrides.scenePreset.type,
        text: overrides.scenePreset.prompt,
      });

    const names = extractVariableNames(sources.map((s) => s.text).join("\n"));
    const usages = collectVariableUsages(sources);

    // 優先度(後勝ち): プリセット既定値 < 通常モードで入力済みの値 < シード引き継ぎ由来
    const prefill: VariableBindings = {};
    for (const bp of set.presets) Object.assign(prefill, bp.variableValues);
    Object.assign(prefill, baseValues);
    Object.assign(prefill, seedBindings);

    return { names, usages, prefill };
  }, [
    set,
    overrides,
    fixedTags,
    countPresets,
    posePresets,
    otherPresets,
    baseValues,
    seedBindings,
  ]);

  const [values, setValues] = useState<VariableBindings>(() => {
    const v: VariableBindings = {};
    for (const n of names) if (prefill[n] != null) v[n] = prefill[n];
    return v;
  });
  const [replacements, setReplacements] = useState<PromptReplacement[]>([]);
  const [replaceOpen, setReplaceOpen] = useState(false);

  const missingRequired = missingRequiredInputs({
    names,
    defs: variableDefs,
    inputValues: values,
  });

  const prefilledNames = names.filter((n) => prefill[n] != null);

  const handleConfirm = () => {
    if (missingRequired.length > 0) return;
    const cleaned = replacements.filter((r) => r.from.trim());
    onConfirm(values, cleaned);
  };

  if (names.length === 0) {
    // 呼び出し側が変数の有無を判定してこの画面をスキップする想定だが、保険として
    // 直接実行できるようにしておく。
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6">
        <p className="text-xs text-muted-foreground">
          このセットに %%変数%% はありません
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="text-xs" onClick={onBack}>
            戻る
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => onConfirm({}, [])}>
            <Play className="h-3.5 w-3.5" />
            実行
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="px-3 pt-3 text-[11px] text-muted-foreground">
          1つの変数への入力は、同名変数の全出現箇所(複数プリセット)へ適用されます。
        </p>
        <VariableBindingList
          names={names}
          usages={usages}
          defs={variableDefs}
          onDefsChange={onDefsChange}
          values={values}
          onValueChange={(name, value) =>
            setValues((prev) => ({ ...prev, [name]: value }))
          }
          missingRequired={missingRequired}
          prefilledNames={prefilledNames}
        />

        <div className="border-t px-3 py-2">
          <button
            type="button"
            onClick={() => setReplaceOpen((v) => !v)}
            className="flex w-full items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={`h-3 w-3 transition-transform ${replaceOpen ? "" : "-rotate-90"}`}
            />
            追加の置換ルール (変数化していない箇所){replacements.length > 0 ? ` · ${replacements.length}` : ""}
          </button>
          {replaceOpen && (
            <div className="mt-2 space-y-1.5">
              {replacements.map((r, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input
                    value={r.from}
                    onChange={(e) =>
                      setReplacements((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, from: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="置換前"
                    className="h-7 font-mono text-xs"
                  />
                  <span className="text-muted-foreground">→</span>
                  <Input
                    value={r.to}
                    onChange={(e) =>
                      setReplacements((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, to: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="置換後"
                    className="h-7 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setReplacements((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-[11px]"
                onClick={() =>
                  setReplacements((prev) => [...prev, { from: "", to: "" }])
                }
              >
                <Plus className="h-3 w-3" />
                行を追加
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t px-4 py-3">
        {missingRequired.length > 0 && (
          <p className="mb-2 text-[10px] text-destructive">
            値/候補が未設定の変数（このままだと空になります）:{" "}
            {missingRequired.map((n) => `%%${n}%%`).join(", ")}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={onBack}>
            戻る
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5 text-xs"
            disabled={missingRequired.length > 0}
            onClick={handleConfirm}
          >
            <Play className="h-3.5 w-3.5" />
            実行
          </Button>
        </div>
      </div>
    </div>
  );
}
