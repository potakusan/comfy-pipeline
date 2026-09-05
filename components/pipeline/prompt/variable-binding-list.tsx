"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type VariableDef,
  type VariableDefs,
  type VariableBindings,
  type VariableMode,
  type VariableUsage,
  getVariableDef,
  emptyReasonFor,
} from "@/lib/comfy";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Settings2, AlertCircle } from "lucide-react";
import { slotLabel } from "@/hooks/pipeline/use-variable-bindings";

interface VariableBindingListProps {
  names: string[];
  usages: VariableUsage[];
  defs: VariableDefs;
  onDefsChange: (defs: VariableDefs) => void;
  values: VariableBindings;
  onValueChange: (name: string, value: string) => void;
  missingRequired: string[];
  /** true = 引き継ぎ由来などで初期値が入っている変数に印を付ける */
  prefilledNames?: string[];
}

const MODE_LABEL: Record<VariableMode, string> = {
  input: "実行前に入力",
  fixed: "固定値",
  random: "候補からランダム",
};

/** テキストを候補配列へ。空行(空白のみ含む)だけ捨て、各候補の中身はそのまま残す
 * (行頭/行末スペースや行間の空行で改行が消えないように、正規化は最小限に留める)。 */
function parseCandidates(text: string): string[] {
  return text.split("\n").filter((line) => line.trim().length > 0);
}

/**
 * 候補リストの編集欄。テキストエリアの表示値は「編集中の生テキスト(draft)」を保持し、
 * 親には parseCandidates() した配列だけを渡す。以前は表示値も
 * `candidates.join("\n")` から毎キーストローク導出していたため、空行が filter で消えて
 * 改行できず、trim で行頭スペースも打てなかった。 */
function CandidatesEditor({
  candidates,
  onChange,
  mode,
}: {
  candidates: string[];
  onChange: (next: string[]) => void;
  mode: "random" | "input";
}) {
  const [draft, setDraft] = useState(() => candidates.join("\n"));
  // 自分が emit した値が prop 経由で戻ってきたとき draft を上書きしないための番人。
  const lastEmitted = useRef(candidates.join("\n"));

  useEffect(() => {
    const joined = candidates.join("\n");
    if (joined !== lastEmitted.current) {
      setDraft(joined);
      lastEmitted.current = joined;
    }
  }, [candidates]);

  return (
    <Textarea
      value={draft}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const parsed = parseCandidates(text);
        lastEmitted.current = parsed.join("\n");
        onChange(parsed);
      }}
      rows={3}
      placeholder={
        mode === "random"
          ? "抽選候補 (1行1値)"
          : "入力補助の候補 (1行1値・任意)"
      }
      className="font-mono text-[11px]"
    />
  );
}

/**
 * `%%name%%` 変数ごとに、使用箇所バッジ(ツールチップ=該当行)・解決モード・入力欄を
 * 縦に並べる共有リスト。通常モードのフローティングウィンドウと一括キューの変数入力
 * ステップの両方で使う。
 */
export default function VariableBindingList({
  names,
  usages,
  defs,
  onDefsChange,
  values,
  onValueChange,
  missingRequired,
  prefilledNames = [],
}: VariableBindingListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const usagesByName = useMemo(() => {
    const m = new Map<string, VariableUsage[]>();
    for (const u of usages) {
      const arr = m.get(u.name) ?? [];
      arr.push(u);
      m.set(u.name, arr);
    }
    return m;
  }, [usages]);

  if (names.length === 0) {
    return (
      <p className="px-3 py-4 text-center text-[11px] text-muted-foreground">
        選択中のプリセットに %%変数%% はありません
      </p>
    );
  }

  const patchDef = (name: string, patch: Partial<VariableDef>) => {
    const cur = getVariableDef(defs, name);
    onDefsChange({ ...defs, [name]: { ...cur, name, ...patch } });
  };

  return (
    <ul className="divide-y">
      {names.map((name) => {
        const def = getVariableDef(defs, name);
        const nameUsages = usagesByName.get(name) ?? [];
        const isMissing = missingRequired.includes(name);
        const isPrefilled = prefilledNames.includes(name);
        const isOpen = expanded.has(name);

        return (
          <li key={name} className="space-y-1.5 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] font-semibold">
                %%{name}%%
              </code>
              {isMissing && (
                <span className="flex items-center gap-0.5 text-[10px] text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {emptyReasonFor(def)}
                </span>
              )}
              {isPrefilled && !isMissing && (
                <span className="text-[10px] text-muted-foreground">引き継ぎ</span>
              )}
              <span className="ml-auto text-[10px] text-muted-foreground">
                {MODE_LABEL[def.mode]}
              </span>
              <button
                type="button"
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(name)) next.delete(name);
                    else next.add(name);
                    return next;
                  })
                }
                className={`rounded p-0.5 hover:bg-muted ${isOpen ? "text-foreground" : "text-muted-foreground"}`}
                title="この変数の設定"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {nameUsages.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {nameUsages.map((u, i) => (
                  <Badge
                    key={`${u.sourceId}-${i}`}
                    variant="secondary"
                    className="max-w-full cursor-help truncate text-[9px] font-normal"
                    title={`${slotLabel(u.slot)}: ${u.snippet}`}
                  >
                    {u.sourceLabel}
                  </Badge>
                ))}
              </div>
            )}

            {def.mode === "input" && (
              <Input
                value={values[name] ?? ""}
                onChange={(e) => onValueChange(name, e.target.value)}
                placeholder={def.value ? `既定: ${def.value}` : "値を入力..."}
                list={def.candidates?.length ? `var-cands-${name}` : undefined}
                className="h-7 font-mono text-xs"
                aria-invalid={isMissing}
              />
            )}
            {def.candidates?.length ? (
              <datalist id={`var-cands-${name}`}>
                {def.candidates.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            ) : null}

            {def.mode === "fixed" && (
              <p className="font-mono text-[11px] text-muted-foreground">
                → {def.value || "(空)"}
              </p>
            )}
            {def.mode === "random" && (
              <p className="font-mono text-[11px] text-muted-foreground">
                {def.candidates?.length
                  ? `${def.candidates.length}候補から抽選`
                  : "候補未設定 (空になります)"}
              </p>
            )}

            {isOpen && (
              <div className="space-y-1.5 rounded-md border bg-muted/30 p-2">
                <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  モード
                  <NativeSelect
                    size="sm"
                    value={def.mode}
                    onChange={(e) =>
                      patchDef(name, { mode: e.target.value as VariableMode })
                    }
                    className="w-40"
                  >
                    <NativeSelectOption value="input">
                      実行前に入力
                    </NativeSelectOption>
                    <NativeSelectOption value="fixed">固定値</NativeSelectOption>
                    <NativeSelectOption value="random">
                      候補からランダム
                    </NativeSelectOption>
                  </NativeSelect>
                </label>

                {(def.mode === "input" || def.mode === "fixed") && (
                  <Input
                    value={def.value ?? ""}
                    onChange={(e) => patchDef(name, { value: e.target.value })}
                    placeholder={
                      def.mode === "fixed" ? "固定値" : "既定値 (任意)"
                    }
                    className="h-7 font-mono text-xs"
                  />
                )}

                {(def.mode === "random" || def.mode === "input") && (
                  <CandidatesEditor
                    candidates={def.candidates ?? []}
                    onChange={(next) => patchDef(name, { candidates: next })}
                    mode={def.mode}
                  />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
