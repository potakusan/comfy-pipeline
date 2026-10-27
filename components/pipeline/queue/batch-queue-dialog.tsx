"use client";
import { useState } from "react";
import {
  type BatchPreset,
  type BatchPresetSet,
  type BatchRunOverrides,
  type LoraEntry,
  type Preset,
  type GenerationSettings,
  type SeedSource,
  type VariableDefs,
  type VariableBindings,
  type PromptReplacement,
  extractVariableNames,
  batchPresetFromRecipe,
  getVariableDef,
  type SeedRecipeGroup,
} from "@/lib/comfy";
import { collectSetVariableSources } from "@/hooks/pipeline/pipeline-prompt-helpers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Layers, ArrowLeft } from "lucide-react";
import ListView from "@/components/pipeline/queue/batch-queue-list-view";
import EditView from "@/components/pipeline/queue/batch-queue-edit-view";
import RunSetupView from "@/components/pipeline/queue/batch-queue-run-setup-view";
import BulkRunSetupView from "@/components/pipeline/queue/batch-queue-bulk-run-setup-view";
import SavedSetRunSetupView, {
  type SavedSetRunSetup,
} from "@/components/pipeline/queue/batch-queue-saved-set-setup-view";
import VariableInputView from "@/components/pipeline/queue/batch-queue-variable-input-view";
import BulkVariableInputView from "@/components/pipeline/queue/batch-queue-bulk-variable-input-view";
import { findSetByFilenamePresetName } from "@/lib/gallery-preset-name-match";

/** セット＋オーバーライド＋固定タグが参照する `%%name%%` 変数が1つでもあるか。
 * 一括生成の実プロンプト組み立て(runBatchPresets)と同じテキストを走査する。 */
function setUsesVariables(
  set: BatchPresetSet,
  overrides: BatchRunOverrides,
  fixedTags: string,
  countPresets: Preset[],
  posePresets: Preset[],
  otherPresets: Preset[],
): boolean {
  const sources = collectSetVariableSources({
    set,
    overrides,
    fixedTags,
    countPresets,
    posePresets,
    otherPresets,
  });
  return extractVariableNames(sources.map((s) => s.text).join("\n")).length > 0;
}

/** 一括実行対象の複数セットのいずれかが `%%name%%` 変数を1つでも参照しているか。 */
function bulkUsesVariables(
  entries: { set: BatchPresetSet; overrides: BatchRunOverrides }[],
  fixedTags: string,
  countPresets: Preset[],
  posePresets: Preset[],
  otherPresets: Preset[],
): boolean {
  return entries.some(({ set, overrides }) =>
    setUsesVariables(set, overrides, fixedTags, countPresets, posePresets, otherPresets),
  );
}

/** 複数レシピの変数定義スナップショットを束ねる(最新のグループを優先) */
function mergeRecipeVariableDefs(groups: SeedRecipeGroup[]): VariableDefs {
  const out: VariableDefs = {};
  for (const g of [...groups].reverse()) Object.assign(out, g.recipe.variableDefs);
  return out;
}

/** 複数レシピの前回値を束ねる(最新のグループを優先)。変数入力ステップの初期値に使う */
function mergeRecipeBindings(groups: SeedRecipeGroup[]): VariableBindings {
  const out: VariableBindings = {};
  for (const g of [...groups].reverse()) Object.assign(out, g.bindings);
  return out;
}

/** 保存済みレシピから復元した実行セットのID接頭辞 */
const RECIPE_SET_PREFIX = "recipe:";

interface BatchQueueDialogProps {
  batchPresetSets: BatchPresetSet[];
  onSaveSet: (set: BatchPresetSet) => void;
  onRemoveSet: (id: string) => void;
  onReorderSets: (from: number, to: number) => void;
  onDuplicateSet: (id: string) => void;
  onRunPresets: (presets: BatchPreset[], overrides: BatchRunOverrides) => void;
  onCaptureCurrentSettings: (name?: string) => BatchPreset;
  /** 可変LoRA一覧 (実行前設定で選択させる) */
  variableLoras: LoraEntry[];
  /** 身体的特徴プリセット一覧 (実行前設定で選択させる) */
  physicalPresets: Preset[];
  /** シーンプリセット一覧 (実行前設定で選択させる) */
  scenePresets: Preset[];
  /** 人数プリセット一覧 (保存内容編集用) */
  countPresets: Preset[];
  /** ポーズプリセット一覧 (保存内容編集用) */
  posePresets: Preset[];
  /** その他プリセット一覧 (保存内容編集用) */
  otherPresets: Preset[];
  /** サンプラー設定の初期値 */
  currentSettings: GenerationSettings;
  /** ギャラリーから「シード引き継ぎ元フォルダ」付きで遷移してきた場合に設定される。
   * 設定されるとダイアログを自動的に開く。 */
  seedSource?: SeedSource | null;
  /** seedSourceを読み取り終えたことを親に伝える(URLクエリパラメータのクリア用) */
  onConsumeSeedSource?: () => void;
  /** `%%name%%` 変数の定義(グローバル)。変数入力ステップで参照・編集する。 */
  variableDefs: VariableDefs;
  onVariableDefsChange: (defs: VariableDefs) => void;
  /** 現在の固定タグ(一括生成時も使われるため、変数検出・入力ステップの走査対象に含める) */
  fixedTags: string;
  /** 通常モードのフローティングウィンドウで入力済みの変数値。変数入力ステップの既定値に引き継ぐ。 */
  variableInputValues: VariableBindings;
}

export default function BatchQueueDialog({
  batchPresetSets,
  onSaveSet,
  onRemoveSet,
  onReorderSets,
  onDuplicateSet,
  onRunPresets,
  onCaptureCurrentSettings,
  variableLoras,
  physicalPresets,
  scenePresets,
  countPresets,
  posePresets,
  otherPresets,
  currentSettings,
  seedSource,
  onConsumeSeedSource,
  variableDefs,
  onVariableDefsChange,
  fixedTags,
  variableInputValues,
}: BatchQueueDialogProps) {
  const [open, setOpen] = useState(false);
  // seedSourceが設定されたら(ギャラリーからの遷移時)自動的に開く。effect無しで
  // 導出できるようopenとの論理和で表現する(onOpenChangeでの閉じる操作は
  // onConsumeSeedSourceでseedSource自体をクリアすることで反映される)。
  const isOpen = open || !!seedSource;
  const [view, setView] = useState<
    | "list"
    | "edit"
    | "run-setup"
    | "variable-input"
    | "bulk-run-setup"
    | "bulk-variable-input"
    | "saved-set-setup"
  >("list");
  // フォルダに複数プリセットが含まれる保存済みレシピの実行設定(変数入力ステップをまたいで保持)
  const [savedSetup, setSavedSetup] = useState<SavedSetRunSetup | null>(null);
  const [pendingEditSet, setPendingEditSet] = useState<BatchPresetSet | null>(null);
  const [pendingRunSet, setPendingRunSet] = useState<BatchPresetSet | null>(null);
  const [pendingRunOverrides, setPendingRunOverrides] =
    useState<BatchRunOverrides | null>(null);
  // 保存済みレシピからの再現時だけ使う、この実行限りの変数定義(グローバル定義は書き換えない)
  const [runVariableDefs, setRunVariableDefs] = useState<VariableDefs | null>(null);
  const [pendingBulkRunSets, setPendingBulkRunSets] = useState<BatchPresetSet[]>([]);
  const [pendingBulkRunEntries, setPendingBulkRunEntries] = useState<
    { set: BatchPresetSet; overrides: BatchRunOverrides }[]
  >([]);

  // seedSourceにbatchPresetIdが含まれる場合、それを持つプリセットを含むセットを
  // 自動的に特定してrun-setup画面まで進める(一覧からの手動選択を省略する)。
  // batchPresetId未記録(#58より前に生成された画像)の場合は、保存済み
  // ファイル名から復元したプリセット名で現在のプリセットと突き合わせる
  // フォールバックを試す(findSetByFilenamePresetName参照。名前ベースなので
  // ID一致より弱いベストエフォート)。
  // レンダー中にstateを調整する(useEffect不使用)ことで、propが変化した
  // タイミングだけ反応させる — https://react.dev/learn/you-might-not-need-an-effect
  const [autoSelectedFolder, setAutoSelectedFolder] = useState<string | null>(null);
  const multiRecipes =
    seedSource?.recipes && seedSource.recipes.length > 1 ? seedSource.recipes : null;
  if (seedSource && seedSource.folder !== autoSelectedFolder) {
    setAutoSelectedFolder(seedSource.folder);
    if (multiRecipes) setView("saved-set-setup");
    // 保存済みレシピがあれば、元セットの有無に関わらずレシピから実行セットを復元する
    // (ライブラリ側でプリセット・セットが編集/削除されていても再現できるようにするため)。
    const recipeSet: BatchPresetSet | null = seedSource.recipe
      ? {
          id: `${RECIPE_SET_PREFIX}${seedSource.folder}`,
          name: `保存済みレシピ(${seedSource.folder})`,
          presets: [
            batchPresetFromRecipe(seedSource.recipe, {
              id: `${RECIPE_SET_PREFIX}${seedSource.folder}`,
              name: seedSource.folder,
              batchCount: Math.max(1, seedSource.seeds.length),
            }),
          ],
        }
      : null;
    const matchedSet =
      recipeSet ??
      (seedSource.batchPresetId
        ? batchPresetSets.find((set) =>
            set.presets.some((p) => p.id === seedSource.batchPresetId),
          )
        : undefined) ?? findSetByFilenamePresetName(seedSource.seeds, batchPresetSets);
    if (matchedSet && !multiRecipes) {
      setPendingRunSet(matchedSet);
      setView("run-setup");
    }
  } else if (!seedSource && autoSelectedFolder !== null) {
    setAutoSelectedFolder(null);
  }

  function openNewSet() {
    setPendingEditSet({
      id: crypto.randomUUID(),
      name: "新しいセット",
      presets: [],
    });
    setView("edit");
  }

  function openEditSet(set: BatchPresetSet) {
    setPendingEditSet(set);
    setView("edit");
  }

  function backToList() {
    setView("list");
    setPendingEditSet(null);
    setPendingRunSet(null);
    setPendingRunOverrides(null);
    setRunVariableDefs(null);
    setPendingBulkRunSets([]);
    setPendingBulkRunEntries([]);
    setSavedSetup(null);
  }

  function openRunSetup(set: BatchPresetSet) {
    setPendingRunSet(set);
    setView("run-setup");
  }

  function openBulkRunSetup(sets: BatchPresetSet[]) {
    setPendingBulkRunSets(sets);
    setView("bulk-run-setup");
  }

  function handleSaveSet(set: BatchPresetSet) {
    onSaveSet(set);
    backToList();
  }

  function handleSaveAndRun(set: BatchPresetSet) {
    onSaveSet(set);
    openRunSetup(set);
  }

  function handleRunConfirm(overrides: BatchRunOverrides) {
    if (!pendingRunSet) return;
    // セットが `%%name%%` 変数を使うなら、実行前に変数入力ステップを挟む。
    if (
      setUsesVariables(
        pendingRunSet,
        overrides,
        fixedTags,
        countPresets,
        posePresets,
        otherPresets,
      )
    ) {
      setPendingRunOverrides(overrides);
      setView("variable-input");
      return;
    }
    // 変数が検出されなくても、通常モードで入力済みの値は既定として渡しておく。
    onRunPresets(pendingRunSet.presets, {
      ...overrides,
      batchSet: { id: pendingRunSet.id, name: pendingRunSet.name },
      variableValues: variableInputValues,
    });
    setOpen(false);
    backToList();
  }

  /** 複数レシピの実行設定に、変数入力の結果と各プリセットの前回値固定を反映して実行する */
  function runSavedSet(
    setup: SavedSetRunSetup,
    variableValues: VariableBindings,
    promptReplacements: PromptReplacement[],
    runDefs?: VariableDefs,
  ) {
    const baseDefs = runDefs ?? { ...variableDefs, ...mergeRecipeVariableDefs(setup.groups) };
    const merged = mergeRecipeBindings(setup.groups);
    const perPreset = { ...setup.overrides.perPreset };
    if (setup.keepPreviousVariables) {
      setup.set.presets.forEach((p, i) => {
        const prev = setup.groups[i].bindings;
        if (!prev) return;
        // 変数入力で前回値から変えた変数は、全プリセットで入力値を優先する
        const kept = Object.fromEntries(
          Object.entries(prev).filter(
            ([name]) => (variableValues[name] ?? merged[name]) === merged[name],
          ),
        );
        const pinned: VariableDefs = { ...baseDefs };
        for (const [name, value] of Object.entries(kept)) {
          const def = getVariableDef(baseDefs, name);
          if (def.mode === "random") pinned[name] = { ...def, mode: "fixed", value };
        }
        perPreset[p.id] = {
          ...perPreset[p.id],
          variableValues: { ...variableValues, ...kept },
          variableDefs: pinned,
        };
      });
    }
    onRunPresets(setup.set.presets, {
      ...setup.overrides,
      perPreset,
      variableValues,
      promptReplacements,
      variableDefs: baseDefs,
    });
    setOpen(false);
    backToList();
  }

  function handleSavedSetConfirm(setup: SavedSetRunSetup) {
    setSavedSetup(setup);
    setPendingRunSet(setup.set);
    if (
      setUsesVariables(setup.set, setup.overrides, fixedTags, countPresets, posePresets, otherPresets)
    ) {
      setPendingRunOverrides(setup.overrides);
      setView("variable-input");
      return;
    }
    runSavedSet(setup, variableInputValues, []);
  }

  function handleVariableInputConfirm(
    variableValues: VariableBindings,
    promptReplacements: PromptReplacement[],
    runDefs?: VariableDefs,
  ) {
    if (!pendingRunSet || !pendingRunOverrides) return;
    if (savedSetup) {
      runSavedSet(savedSetup, variableValues, promptReplacements, runVariableDefs ?? undefined);
      return;
    }
    onRunPresets(pendingRunSet.presets, {
      ...pendingRunOverrides,
      batchSet: { id: pendingRunSet.id, name: pendingRunSet.name },
      variableValues,
      promptReplacements,
      variableDefs: runDefs,
    });
    setOpen(false);
    backToList();
  }

  function handleBulkRunSetupConfirm(
    entries: { set: BatchPresetSet; overrides: BatchRunOverrides }[],
  ) {
    // いずれかのセットが `%%name%%` 変数を使うなら、実行前に変数入力ステップを挟む。
    if (bulkUsesVariables(entries, fixedTags, countPresets, posePresets, otherPresets)) {
      setPendingBulkRunEntries(entries);
      setView("bulk-variable-input");
      return;
    }
    entries.forEach(({ set, overrides }) =>
      onRunPresets(set.presets, {
        ...overrides,
        variableValues: variableInputValues,
      }),
    );
    setOpen(false);
    backToList();
  }

  function handleBulkVariableInputConfirm(
    variableValues: VariableBindings,
    promptReplacements: PromptReplacement[],
  ) {
    pendingBulkRunEntries.forEach(({ set, overrides }) =>
      onRunPresets(set.presets, { ...overrides, variableValues, promptReplacements }),
    );
    setOpen(false);
    backToList();
  }

  // 保存済みレシピからの再現モード(run-setup / variable-input でレシピ由来の初期値・差し替えUIを出す)
  const activeRecipe = pendingRunSet?.id.startsWith(RECIPE_SET_PREFIX)
    ? seedSource?.recipe
    : undefined;

  const dialogTitle =
    view === "list"
      ? "一括キュープリセット"
      : view === "run-setup" || view === "saved-set-setup"
        ? "実行前設定"
        : view === "variable-input" || view === "bulk-variable-input"
          ? "変数入力"
          : view === "bulk-run-setup"
            ? "一括実行設定"
            : "セット編集";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          backToList();
          if (seedSource) onConsumeSeedSource?.();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Layers className="h-3.5 w-3.5" />
          一括キュー
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[85vh] max-w-4xl! flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            {(view === "edit" ||
              view === "run-setup" ||
              view === "saved-set-setup" ||
              view === "variable-input" ||
              view === "bulk-run-setup" ||
              view === "bulk-variable-input") && (
              <button
                onClick={
                  view === "variable-input"
                    ? () => setView(savedSetup ? "saved-set-setup" : "run-setup")
                    : view === "bulk-variable-input"
                      ? () => setView("bulk-run-setup")
                      : backToList
                }
                className="rounded p-0.5 hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {dialogTitle}
            {seedSource && (
              <span className="text-[10px] font-normal text-muted-foreground">
                ({seedSource.recipe ? "保存済みレシピ" : "シード引き継ぎ元"}: {seedSource.folder})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {view === "list" && (
          <ListView
            batchPresetSets={batchPresetSets}
            onEditSet={openEditSet}
            onRemoveSet={onRemoveSet}
            onReorderSets={onReorderSets}
            onDuplicateSet={onDuplicateSet}
            onRunSetup={openRunSetup}
            onBulkRunSetup={openBulkRunSetup}
            onCreateNew={openNewSet}
          />
        )}

        {view === "edit" && pendingEditSet && (
          <EditView
            initialSet={pendingEditSet}
            countPresets={countPresets}
            posePresets={posePresets}
            otherPresets={otherPresets}
            onCaptureCurrentSettings={onCaptureCurrentSettings}
            onSave={handleSaveSet}
            onSaveAndRun={handleSaveAndRun}
            onCancel={backToList}
          />
        )}

        {view === "saved-set-setup" && seedSource && multiRecipes && (
          <SavedSetRunSetupView
            folder={seedSource.folder}
            groups={multiRecipes}
            variableLoras={variableLoras}
            initialSettings={currentSettings}
            onConfirm={handleSavedSetConfirm}
            onCancel={backToList}
          />
        )}

        {view === "run-setup" && pendingRunSet && (
          <RunSetupView
            variableLoras={variableLoras}
            physicalPresets={physicalPresets}
            scenePresets={scenePresets}
            presets={pendingRunSet.presets}
            initialSettings={activeRecipe && seedSource?.settings ? seedSource.settings : currentSettings}
            recipe={activeRecipe}
            countPresets={countPresets}
            posePresets={posePresets}
            otherPresets={otherPresets}
            seedSource={seedSource}
            onConfirm={handleRunConfirm}
            onCancel={backToList}
          />
        )}

        {view === "variable-input" && pendingRunSet && pendingRunOverrides && (
          <VariableInputView
            set={pendingRunSet}
            overrides={pendingRunOverrides}
            fixedTags={fixedTags}
            countPresets={countPresets}
            posePresets={posePresets}
            otherPresets={otherPresets}
            variableDefs={
              savedSetup
                ? (runVariableDefs ?? {
                    ...variableDefs,
                    ...mergeRecipeVariableDefs(savedSetup.groups),
                  })
                : activeRecipe
                  ? (runVariableDefs ?? { ...variableDefs, ...activeRecipe.variableDefs })
                  : variableDefs
            }
            onDefsChange={activeRecipe || savedSetup ? setRunVariableDefs : onVariableDefsChange}
            baseValues={variableInputValues}
            seedBindings={
              savedSetup ? mergeRecipeBindings(savedSetup.groups) : seedSource?.bindings
            }
            recipeMode={!!activeRecipe}
            onConfirm={handleVariableInputConfirm}
            onBack={() => setView("run-setup")}
          />
        )}

        {view === "bulk-run-setup" && pendingBulkRunSets.length > 0 && (
          <BulkRunSetupView
            sets={pendingBulkRunSets}
            variableLoras={variableLoras}
            physicalPresets={physicalPresets}
            scenePresets={scenePresets}
            initialSettings={currentSettings}
            onConfirm={handleBulkRunSetupConfirm}
            onCancel={backToList}
          />
        )}

        {view === "bulk-variable-input" && pendingBulkRunEntries.length > 0 && (
          <BulkVariableInputView
            entries={pendingBulkRunEntries}
            fixedTags={fixedTags}
            countPresets={countPresets}
            posePresets={posePresets}
            otherPresets={otherPresets}
            variableDefs={variableDefs}
            onDefsChange={onVariableDefsChange}
            baseValues={variableInputValues}
            onConfirm={handleBulkVariableInputConfirm}
            onBack={() => setView("bulk-run-setup")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
