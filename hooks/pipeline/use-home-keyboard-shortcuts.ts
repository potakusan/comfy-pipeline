"use client";
import { useState, useEffect, useRef } from "react";
import type { QueueItem } from "@/lib/comfy";

/**
 * ホーム画面のグローバルキーボードショートカット。
 * Ctrl+Enterでキュー追加、Escで実行中ジョブの中止確認モーダルを開く。
 */
export function useHomeKeyboardShortcuts(
  onAddToQueue: () => void,
  currentItem: QueueItem | null,
) {
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Stable ref so the keydown handler always calls the latest onAddToQueue
  // without needing to re-register the listener on every render.
  const addToQueueRef = useRef(onAddToQueue);
  addToQueueRef.current = onAddToQueue;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Enter — add current settings to queue
      if (e.ctrlKey && e.key === "Enter") {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        )
          return;
        e.preventDefault();
        addToQueueRef.current();
        return;
      }
      // Esc — prompt to cancel the running job
      if (e.key === "Escape" && currentItem && !showCancelModal) {
        setShowCancelModal(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentItem, showCancelModal]);

  return { showCancelModal, setShowCancelModal };
}
