"use client";
import { useState } from "react";
import { type LoraEntry } from "@/lib/comfy";
import { Separator } from "@/components/ui/separator";
import LoraModal from "@/components/pipeline/lora/lora-modal";
import LoraFixedSection from "@/components/pipeline/lora/lora-fixed-section";
import LoraVariableSection from "@/components/pipeline/lora/lora-variable-section";

interface LoraPanelProps {
  // Fixed LoRAs (editable)
  fixedLoras: LoraEntry[];
  onAddFixedLora: (lora: LoraEntry) => void;
  onUpdateFixedLora: (index: number, lora: LoraEntry) => void;
  onRemoveFixedLora: (index: number) => void;
  // Variable LoRAs
  variableLoras: LoraEntry[];
  selectedVariableLora: LoraEntry | null;
  onSelectVariableLora: (lora: LoraEntry | null) => void;
  onAddVariableLora: (lora: LoraEntry) => void;
  onUpdateVariableLora: (index: number, lora: LoraEntry) => void;
  onRemoveVariableLora: (index: number) => void;
  onArchiveVariableLora: (index: number, archived: boolean) => void;
}

export default function LoraPanel({
  fixedLoras,
  onAddFixedLora,
  onUpdateFixedLora,
  onRemoveFixedLora,
  variableLoras,
  selectedVariableLora,
  onSelectVariableLora,
  onAddVariableLora,
  onUpdateVariableLora,
  onRemoveVariableLora,
  onArchiveVariableLora,
}: LoraPanelProps) {
  const [fixedModalState, setFixedModalState] = useState<{
    open: boolean;
    lora: LoraEntry | null;
    index: number | null;
  }>({ open: false, lora: null, index: null });

  const [variableModalState, setVariableModalState] = useState<{
    open: boolean;
    lora: LoraEntry | null;
    index: number | null;
  }>({ open: false, lora: null, index: null });

  const openFixedAdd = () =>
    setFixedModalState({ open: true, lora: null, index: null });
  const openFixedEdit = (lora: LoraEntry, index: number) =>
    setFixedModalState({ open: true, lora, index });
  const closeFixedModal = () =>
    setFixedModalState((s) => ({ ...s, open: false }));

  const openVariableAdd = () =>
    setVariableModalState({ open: true, lora: null, index: null });
  const openVariableEdit = (lora: LoraEntry, index: number) =>
    setVariableModalState({ open: true, lora, index });
  const closeVariableModal = () =>
    setVariableModalState((s) => ({ ...s, open: false }));

  const handleFixedSave = (updated: LoraEntry) => {
    if (fixedModalState.index !== null) {
      onUpdateFixedLora(fixedModalState.index, updated);
    } else {
      onAddFixedLora(updated);
    }
  };

  const handleVariableSave = (updated: LoraEntry) => {
    if (variableModalState.index !== null) {
      onUpdateVariableLora(variableModalState.index, updated);
      if (
        selectedVariableLora?.name === variableLoras[variableModalState.index]?.name
      ) {
        onSelectVariableLora(updated);
      }
    } else {
      onAddVariableLora(updated);
    }
  };

  return (
    <div className="space-y-3">
      <LoraFixedSection
        fixedLoras={fixedLoras}
        onAdd={openFixedAdd}
        onEdit={openFixedEdit}
      />

      <Separator />

      <LoraVariableSection
        variableLoras={variableLoras}
        selectedVariableLora={selectedVariableLora}
        onSelect={onSelectVariableLora}
        onAdd={openVariableAdd}
        onEdit={openVariableEdit}
        onArchive={onArchiveVariableLora}
      />

      {/* Fixed LoRA modal */}
      {fixedModalState.open && (
        <LoraModal
          open={fixedModalState.open}
          lora={fixedModalState.lora}
          title={fixedModalState.lora ? "固定LoRA編集" : "固定LoRA追加"}
          onClose={closeFixedModal}
          onSave={handleFixedSave}
          onDelete={
            fixedModalState.index !== null
              ? () => onRemoveFixedLora(fixedModalState.index!)
              : undefined
          }
        />
      )}

      {/* Variable LoRA modal */}
      {variableModalState.open && (
        <LoraModal
          open={variableModalState.open}
          lora={variableModalState.lora}
          title={variableModalState.lora ? "可変LoRA編集" : "可変LoRA追加"}
          allowPromptOnly
          allowDanbooruImport
          onClose={closeVariableModal}
          onSave={handleVariableSave}
          onDelete={
            variableModalState.index !== null
              ? () => {
                  onRemoveVariableLora(variableModalState.index!);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
