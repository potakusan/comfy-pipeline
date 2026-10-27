"use client";
import { useMemo, useState } from "react";
import {
  type BatchPresetSet,
  type BatchRunOverrides,
  type Preset,
  type VariableDefs,
  type VariableBindings,
  type PromptReplacement,
  collectVariableUsages,
  extractVariableNames,
  missingRequiredInputs,
} from "@/lib/comfy";
import { collectSetVariableSources } from "@/hooks/pipeline/pipeline-prompt-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Plus, Trash2, ChevronDown } from "lucide-react";
import VariableBindingList from "@/components/pipeline/prompt/variable-binding-list";

interface BulkVariableInputViewProps {
  /** 一括実行対象の各セットと、実行前設定で確定済みのオーバーライド */
  entries: { set: BatchPresetSet; overrides: BatchRunOverrides }[];
  /** 現在の固定タグ(一括生成でも使われるため走査対象に含める) */
  fixedTags: string;
  countPresets: Preset[];
  posePresets: Preset[];
  otherPresets: Preset[];
  variableDefs: VariableDefs;
  onDefsChange: (defs: VariableDefs) => void;
  /** 通常モードのフローティングウィンドウで入力済みの変数値(既定として引き継ぐ) */
  baseValues?: VariableBindings;
  onConfirm: (
    variableValues: VariableBindings,
    promptReplacements: PromptReplacement[],
  ) => void;
  onBack: () => void;
}

/**
 * 一括キュー実行前の変数入力ステップ。選択した全セット分の `%%name%%` を集約し、
 * 未入力のものを入力させる。変数はグローバル名前空間のため、ここで確定した値は
 * 全セットの実行(onRunPresets呼び出し)へ共通で適用される。単発実行の
 * VariableInputView と走査ロジックを共有する(collectSetVariableSources)。
 */
export default function BulkVariableInputView({
  entries,
  fixedTags,
  countPresets,
  posePresets,
  otherPresets,
  variableDefs,
  onDefsChange,
  baseValues,
  onConfirm,
  onBack,
}: BulkVariableInputViewProps) {
  const { names, usages, prefill } = useMemo(() => {
    const sources = entries.flatMap(({ set, overrides }) =>
      collectSetVariableSources({
        set,
        overrides,
        fixedTags,
        countPresets,
        posePresets,
        otherPresets,
        setLabel: entries.length > 1 ? set.name : undefined,
      }),
    );

    const names = extractVariableNames(sources.map((s) => s.text).join("\n"));
    const usages = collectVariableUsages(sources);

    // 優先度(後勝ち): プリセット既定値 < 通常モードで入力済みの値
    const prefill: VariableBindings = {};
    for (const { set } of entries)
      for (const bp of set.presets) Object.assign(prefill, bp.variableValues);
    Object.assign(prefill, baseValues);

    return { names, usages, prefill };
  }, [entries, fixedTags, countPresets, posePresets, otherPresets, baseValues]);

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
          選択中のセットに %%変数%% はありません
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
          1つの変数への入力は、同名変数の全出現箇所(選択中の全セット)へ適用されます。
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
