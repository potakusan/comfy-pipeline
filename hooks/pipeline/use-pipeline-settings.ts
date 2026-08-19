"use client";
import { useState, useCallback, useEffect } from "react";
import { type GenerationSettings } from "@/lib/comfy";
import { DEFAULT_SETTINGS } from "@/lib/config";
import { lsGet, lsSet } from "@/hooks/ls";

const LS = {
  settings: "cp_settings",
  batchCount: "cp_batch_count",
  panelSizes: "cp_panel_sizes",
  promptPreview: "cp_prompt_preview",
  etaPos: "cp_eta_pos",
};

export type PromptPreviewPos = { x: number; y: number; collapsed: boolean; width?: number; height?: number };
export const DEFAULT_PROMPT_PREVIEW: PromptPreviewPos = { x: -1, y: -1, collapsed: false };
const DEFAULT_PANEL_SIZES = { left: 28, center: 38, right: 34 };

/** 生成設定・バッチ数・パネルレイアウト・フローティングウィンドウ位置。 */
export function usePipelineSettings() {
  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS);
  const [batchCount, setBatchCount] = useState(4);
  const [panelSizes, setPanelSizesState] = useState<Record<string, number>>(DEFAULT_PANEL_SIZES);
  const [promptPreviewPos, setPromptPreviewPosState] = useState<PromptPreviewPos>(DEFAULT_PROMPT_PREVIEW);
  const [etaPos, setEtaPosState] = useState<PromptPreviewPos>(DEFAULT_PROMPT_PREVIEW);
  const [lsLoaded, setLsLoaded] = useState(false);

  useEffect(() => {
    setSettings(lsGet(LS.settings, DEFAULT_SETTINGS));
    setBatchCount(lsGet(LS.batchCount, 4));
    setPanelSizesState(lsGet(LS.panelSizes, DEFAULT_PANEL_SIZES));
    setPromptPreviewPosState(lsGet(LS.promptPreview, DEFAULT_PROMPT_PREVIEW));
    setEtaPosState(lsGet(LS.etaPos, DEFAULT_PROMPT_PREVIEW));
    setLsLoaded(true);
  }, []);

  useEffect(() => { if (lsLoaded) lsSet(LS.settings, settings); }, [lsLoaded, settings]);
  useEffect(() => { if (lsLoaded) lsSet(LS.batchCount, batchCount); }, [lsLoaded, batchCount]);

  const setPanelSizes = useCallback((sizes: Record<string, number>) => {
    setPanelSizesState(sizes);
    lsSet(LS.panelSizes, sizes);
  }, []);
  const setPromptPreviewPos = useCallback((pos: PromptPreviewPos) => {
    setPromptPreviewPosState(pos);
    lsSet(LS.promptPreview, pos);
  }, []);
  const setEtaPos = useCallback((pos: PromptPreviewPos) => {
    setEtaPosState(pos);
    lsSet(LS.etaPos, pos);
  }, []);

  return {
    settings,
    setSettings,
    batchCount,
    setBatchCount,
    panelSizes,
    setPanelSizes,
    promptPreviewPos,
    setPromptPreviewPos,
    etaPos,
    setEtaPos,
    lsLoaded,
  };
}
