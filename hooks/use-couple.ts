"use client";
import { useState, useCallback } from "react";
import {
  type CoupleConfig,
  type CoupleRegion,
  type CouplePositionPreset,
  type CoupleControlNet,
  DEFAULT_COUPLE_CONFIG,
  DEFAULT_CONTROL_NET,
  DEFAULT_REGION_HEX_COLORS,
} from "@/lib/couple";
import type { LoraEntry } from "@/lib/comfy";

const LS = {
  configs: "cp_couple_configs",
  activeId: "cp_couple_active_id",
  countId: "cp_couple_count_id",
  sceneId: "cp_couple_scene_id",
  positionId: "cp_couple_position_id",
};

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function migrateConfig(raw: unknown): CoupleConfig {
  const c = raw as Record<string, unknown>;
  const regions = ((c.regions as unknown[]) ?? []).map((r: unknown, i: number) => {
    const rr = r as Record<string, unknown>;
    return {
      id: (rr.id as string) ?? crypto.randomUUID(),
      name: (rr.name as string) ?? "キャラ",
      xStart: (rr.xStart as number) ?? 0,
      xEnd: (rr.xEnd as number) ?? 1,
      yStart: (rr.yStart as number) ?? 0,
      yEnd: (rr.yEnd as number) ?? 1,
      prompt: (rr.prompt as string) ?? "",
      lora: (rr.lora as LoraEntry | null) ?? null,
      // Migrate: old regions without colorHex get defaults
      colorHex: (rr.colorHex as string) ?? DEFAULT_REGION_HEX_COLORS[i % DEFAULT_REGION_HEX_COLORS.length],
      selectedPresetIds: (rr.selectedPresetIds as string[] | undefined) ?? [],
    };
  });

  const rawCn = c.controlNet as Record<string, unknown> | undefined;
  const controlNet: CoupleControlNet = {
    enabled: (rawCn?.enabled as boolean) ?? DEFAULT_CONTROL_NET.enabled,
    controlNetModel: (rawCn?.controlNetModel as string) ?? DEFAULT_CONTROL_NET.controlNetModel,
    poseImageName: (rawCn?.poseImageName as string | null) ?? null,
    colorMapImageName: (rawCn?.colorMapImageName as string | null) ?? null,
    strength: (rawCn?.strength as number) ?? DEFAULT_CONTROL_NET.strength,
    startPercent: (rawCn?.startPercent as number) ?? DEFAULT_CONTROL_NET.startPercent,
    endPercent: (rawCn?.endPercent as number) ?? DEFAULT_CONTROL_NET.endPercent,
  };

  return {
    id: (c.id as string) ?? crypto.randomUUID(),
    name: (c.name as string) ?? "設定",
    basePrompt: (c.basePrompt as string) ?? "",
    regions,
    // Migrate: old `posePresets` (with regionPrompts) → positionPresets
    positionPresets: (
      ((c.positionPresets ?? c.posePresets) as unknown[]) ?? []
    ).map((p: unknown) => {
      const pp = p as Record<string, unknown>;
      return {
        id: (pp.id as string) ?? crypto.randomUUID(),
        name: (pp.name as string) ?? "",
        regionPrompts: (pp.regionPrompts as string[]) ?? [],
      };
    }),
    controlNet,
  };
}

export function useCouple() {
  const [configs, setConfigsRaw] = useState<CoupleConfig[]>(() => {
    const stored = lsGet<unknown[]>(LS.configs, [DEFAULT_COUPLE_CONFIG]);
    return stored.map(migrateConfig);
  });
  const [activeConfigId, setActiveConfigIdRaw] = useState<string>(() =>
    lsGet(LS.activeId, DEFAULT_COUPLE_CONFIG.id),
  );
  // Selected IDs from normal-mode presets (count/scene shared state)
  const [selectedNormalCountId, setSelectedNormalCountIdRaw] = useState<string | null>(() =>
    lsGet(LS.countId, null),
  );
  const [selectedNormalSceneId, setSelectedNormalSceneIdRaw] = useState<string | null>(() =>
    lsGet(LS.sceneId, null),
  );
  const [selectedPositionPresetId, setSelectedPositionPresetIdRaw] = useState<string | null>(() =>
    lsGet(LS.positionId, null),
  );

  // --- Persist helpers ---
  const setConfigs = useCallback((next: CoupleConfig[]) => {
    setConfigsRaw(next);
    lsSet(LS.configs, next);
  }, []);

  const setActiveConfigId = useCallback((id: string) => {
    setActiveConfigIdRaw(id);
    lsSet(LS.activeId, id);
    setSelectedPositionPresetIdRaw(null);
    lsSet(LS.positionId, null);
  }, []);

  const setSelectedNormalCountId = useCallback((id: string | null) => {
    setSelectedNormalCountIdRaw(id);
    lsSet(LS.countId, id);
  }, []);

  const setSelectedNormalSceneId = useCallback((id: string | null) => {
    setSelectedNormalSceneIdRaw(id);
    lsSet(LS.sceneId, id);
  }, []);

  const setSelectedPositionPresetId = useCallback((id: string | null) => {
    setSelectedPositionPresetIdRaw(id);
    lsSet(LS.positionId, id);
  }, []);

  const activeConfig =
    configs.find((c) => c.id === activeConfigId) ??
    configs[0] ??
    DEFAULT_COUPLE_CONFIG;

  const patchActiveConfig = useCallback(
    (patch: (c: CoupleConfig) => CoupleConfig) => {
      setConfigsRaw((prev) => {
        const next = prev.map((c) =>
          c.id === activeConfigId ? patch(c) : c,
        );
        lsSet(LS.configs, next);
        return next;
      });
    },
    [activeConfigId],
  );

  // --- Config CRUD ---

  const createConfig = useCallback(
    (name: string, initialBasePrompt?: string) => {
      const newConfig: CoupleConfig = {
        ...DEFAULT_COUPLE_CONFIG,
        id: crypto.randomUUID(),
        name,
        basePrompt: initialBasePrompt ?? DEFAULT_COUPLE_CONFIG.basePrompt,
        regions: DEFAULT_COUPLE_CONFIG.regions.map((r) => ({
          ...r,
          id: crypto.randomUUID(),
        })),
        positionPresets: DEFAULT_COUPLE_CONFIG.positionPresets.map((p) => ({
          ...p,
          id: crypto.randomUUID(),
        })),
        controlNet: { ...DEFAULT_CONTROL_NET },
      };
      setConfigs([...configs, newConfig]);
      setActiveConfigId(newConfig.id);
    },
    [configs, setConfigs, setActiveConfigId],
  );

  const updateControlNet = useCallback(
    (updates: Partial<CoupleControlNet>) => {
      patchActiveConfig((c) => ({
        ...c,
        controlNet: { ...c.controlNet, ...updates },
      }));
    },
    [patchActiveConfig],
  );

  const deleteConfig = useCallback(
    (id: string) => {
      const next = configs.filter((c) => c.id !== id);
      if (next.length === 0) {
        const fresh: CoupleConfig = {
          ...DEFAULT_COUPLE_CONFIG,
          id: crypto.randomUUID(),
          name: "デフォルト",
        };
        setConfigs([fresh]);
        setActiveConfigId(fresh.id);
      } else {
        setConfigs(next);
        if (activeConfigId === id) setActiveConfigId(next[0].id);
      }
    },
    [configs, activeConfigId, setConfigs, setActiveConfigId],
  );

  const renameConfig = useCallback((id: string, name: string) => {
    setConfigsRaw((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, name } : c));
      lsSet(LS.configs, next);
      return next;
    });
  }, []);

  // --- Region operations ---

  const updateBasePrompt = useCallback(
    (prompt: string) => {
      patchActiveConfig((c) => ({ ...c, basePrompt: prompt }));
    },
    [patchActiveConfig],
  );

  const updateRegion = useCallback(
    (index: number, updates: Partial<CoupleRegion>) => {
      patchActiveConfig((c) => ({
        ...c,
        regions: c.regions.map((r, i) => (i === index ? { ...r, ...updates } : r)),
      }));
    },
    [patchActiveConfig],
  );

  const addRegion = useCallback(() => {
    patchActiveConfig((c) => {
      if (c.regions.length >= 5) return c;
      const names = ["A", "B", "C", "D", "E"];
      const count = c.regions.length + 1;
      const gap = 0.05;
      const segSize = parseFloat(((1 - gap * (count - 1)) / count).toFixed(3));
      const regions: CoupleRegion[] = Array.from({ length: count }, (_, i) => ({
        id: i < c.regions.length ? c.regions[i].id : crypto.randomUUID(),
        name: i < c.regions.length ? c.regions[i].name : `キャラ${names[i] ?? i + 1}`,
        xStart: parseFloat((i * (segSize + gap)).toFixed(2)),
        xEnd: parseFloat((i * (segSize + gap) + segSize).toFixed(2)),
        yStart: 0,
        yEnd: 1,
        prompt: i < c.regions.length ? c.regions[i].prompt : "1girl,",
        lora: i < c.regions.length ? c.regions[i].lora : null,
        colorHex: i < c.regions.length
          ? c.regions[i].colorHex
          : DEFAULT_REGION_HEX_COLORS[i % DEFAULT_REGION_HEX_COLORS.length],
        selectedPresetIds: i < c.regions.length ? c.regions[i].selectedPresetIds : [],
      }));
      const positionPresets = c.positionPresets.map((p) => ({
        ...p,
        regionPrompts: Array.from({ length: count }, (_, i) => p.regionPrompts[i] ?? ""),
      }));
      return { ...c, regions, positionPresets };
    });
  }, [patchActiveConfig]);

  const removeRegion = useCallback(
    (index: number) => {
      patchActiveConfig((c) => {
        if (c.regions.length <= 1) return c;
        const regions = c.regions.filter((_, i) => i !== index);
        const count = regions.length;
        const gap = 0.05;
        const segSize = parseFloat(((1 - gap * (count - 1)) / count).toFixed(3));
        const redistributed = regions.map((r, i) => ({
          ...r,
          xStart: parseFloat((i * (segSize + gap)).toFixed(2)),
          xEnd: parseFloat((i * (segSize + gap) + segSize).toFixed(2)),
        }));
        const positionPresets = c.positionPresets.map((p) => ({
          ...p,
          regionPrompts: redistributed.map((_, i) => p.regionPrompts[i] ?? ""),
        }));
        return { ...c, regions: redistributed, positionPresets };
      });
    },
    [patchActiveConfig],
  );

  // --- Position preset CRUD ---

  const addPositionPreset = useCallback(
    (name: string, regionPrompts: string[]) => {
      patchActiveConfig((c) => ({
        ...c,
        positionPresets: [
          ...c.positionPresets,
          { id: crypto.randomUUID(), name, regionPrompts },
        ],
      }));
    },
    [patchActiveConfig],
  );

  const updatePositionPreset = useCallback(
    (id: string, updates: Partial<CouplePositionPreset>) => {
      patchActiveConfig((c) => ({
        ...c,
        positionPresets: c.positionPresets.map((p) =>
          p.id === id ? { ...p, ...updates } : p,
        ),
      }));
    },
    [patchActiveConfig],
  );

  const removePositionPreset = useCallback(
    (id: string) => {
      patchActiveConfig((c) => ({
        ...c,
        positionPresets: c.positionPresets.filter((p) => p.id !== id),
      }));
      if (selectedPositionPresetId === id) setSelectedPositionPresetId(null);
    },
    [patchActiveConfig, selectedPositionPresetId, setSelectedPositionPresetId],
  );

  return {
    configs,
    activeConfig,
    activeConfigId,
    setActiveConfigId,
    selectedNormalCountId,
    setSelectedNormalCountId,
    selectedNormalSceneId,
    setSelectedNormalSceneId,
    createConfig,
    deleteConfig,
    renameConfig,
    updateBasePrompt,
    updateRegion,
    addRegion,
    removeRegion,
    updateControlNet,
  };
}

export type CoupleHook = ReturnType<typeof useCouple>;
