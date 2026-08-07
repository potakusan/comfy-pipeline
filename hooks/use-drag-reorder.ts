"use client";
import { useState, type DragEvent } from "react";

/**
 * Shared drag-and-drop reorder logic for list items. Each item writes its own
 * index into dataTransfer on drag start; the item under the pointer resolves
 * the source index on drop and calls onReorder(from, to). Used by both
 * couple-panel.tsx's PresetListItem and prompt-builder.tsx's DraggableItem.
 */
export function useDragReorder(
  index: number,
  onReorder: (from: number, to: number) => void,
) {
  const [isOver, setIsOver] = useState(false);

  return {
    isOver,
    draggable: true as const,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    },
    onDragOver: (e: DragEvent) => {
      const from = Number(e.dataTransfer.getData("text/plain"));
      if (isNaN(from)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setIsOver(true);
    },
    onDragLeave: () => setIsOver(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData("text/plain"));
      if (!isNaN(from) && from !== index) onReorder(from, index);
      setIsOver(false);
    },
    onDragEnd: () => setIsOver(false),
  };
}
