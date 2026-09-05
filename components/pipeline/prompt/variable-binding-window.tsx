"use client";
import {
  type VariableDefs,
  type VariableBindings,
  type VariableUsage,
} from "@/lib/comfy";
import { Badge } from "@/components/ui/badge";
import { Braces } from "lucide-react";
import FloatingWindow from "@/components/gallery/floating-window";
import VariableBindingList from "@/components/pipeline/prompt/variable-binding-list";
import type { PromptPreviewPos } from "@/hooks/pipeline/use-pipeline";

interface VariableBindingWindowProps {
  names: string[];
  usages: VariableUsage[];
  missingRequired: string[];
  defs: VariableDefs;
  onDefsChange: (defs: VariableDefs) => void;
  values: VariableBindings;
  onValueChange: (name: string, value: string) => void;
  pos: PromptPreviewPos;
  onPosChange: (p: PromptPreviewPos) => void;
}

/**
 * 通常モードの1枚生成向け。チェック中プリセットに `%%変数%%` が1つ以上あるときだけ
 * 表示し、値をその場で編集する。編集値は addToQueue にも引き継がれる
 * (hooks/pipeline/use-normal-mode.ts の variableInputValues)。
 */
export default function VariableBindingWindow({
  names,
  usages,
  missingRequired,
  defs,
  onDefsChange,
  values,
  onValueChange,
  pos,
  onPosChange,
}: VariableBindingWindowProps) {
  if (names.length === 0) return null;

  return (
    <FloatingWindow
      title="変数"
      icon={<Braces className="h-3 w-3 text-muted-foreground" />}
      badges={
        missingRequired.length > 0 ? (
          <Badge variant="destructive" className="text-[9px]">
            未入力 {missingRequired.length}
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[9px]">
            {names.length}
          </Badge>
        )
      }
      pos={pos}
      onPosChange={onPosChange}
      defaultWidth={320}
      defaultHeight={300}
      minWidth={240}
      minHeight={160}
      initialPlacement="bottom-left"
    >
      {missingRequired.length > 0 && (
        <p className="border-b bg-destructive/10 px-3 py-1.5 text-[10px] text-destructive">
          値または候補が未設定の変数があるためキューに追加できません
        </p>
      )}
      <VariableBindingList
        names={names}
        usages={usages}
        defs={defs}
        onDefsChange={onDefsChange}
        values={values}
        onValueChange={onValueChange}
        missingRequired={missingRequired}
      />
    </FloatingWindow>
  );
}
