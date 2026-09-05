# 参照画像 / 下絵（img2img）

対応issue: 未起票（本提案が spec-ready。起票時は `.github/ISSUE_TEMPLATE/feature_spec.md` 構成）

## 実装状況（2026-08-30 MVP 実装済み）

本提案の「仕様（確定）」どおりに実装済み。主なファイル:
`lib/comfy/comfy-types.ts`(`ImageRef`), `lib/comfy/workflow-builder.ts`(`buildBasePipeline` / `buildWorkflow` の `initImage` 分岐), `lib/comfy-upload.ts`(アップロード共通関数), `test/unit/workflow-builder.test.ts`(img2img 3ケース追加), `hooks/pipeline/use-normal-mode.ts`(`imageRef` state・`cp_image_ref` 永続化), `hooks/pipeline/use-pipeline-queue.ts`(生成時に `initImage` を渡す・`addToQueue` / `runBatchPresets` へ付与), `components/pipeline/prompt/image-ref-section.tsx`(左パネル/実行前設定 共用), `components/pipeline/home/left-panel.tsx`(「参照画像 / 下絵」セクション), `components/pipeline/queue/batch-queue-run-setup-view.tsx`(下絵行), `components/pipeline/home/center-panel.tsx`(`?img2imgRef=` 取り込み)。

検証: `npx tsc --noEmit` クリーン / `npx vitest run` 117 passed / `npx eslint .` 指摘数不変 / `npx next build` 成功。

## 背景

シード引き継ぎ＋変数バインディング（`docs/proposals/seed-inheritance-prompt-carryover.md`）で「タグ選択の再現」と「アイテム差し替え」は解決した。だが**構図の引き継ぎ**はシード値に依存しており、可変LoRA・体型・シーンを丸ごと差し替えるような大きな変更では、シードは弱い構図バイアスしか与えない（拡散モデルの性質。初期潜在ノイズは早いデノイズ段階でプロンプト/LoRAに上書きされる）。

構図を確実に引き継ぐ本来の手段は、参照画像を初期latentに使う **img2img** か、参照から構造を抽出して拘束する **ControlNet**。本提案はそのうち **img2img の MVP** を対象にする。ControlNet は将来対応（対応範囲外）。

土台は既にある: `buildBasePipeline` が `EmptyLatentImage`(`wf["lat"]`) を作り、`buildSamplingAndSaveTail` がメインKSamplerの `denoise` に `settings.denoise` を渡している。`/api/comfy/upload`（ComfyUI の `/upload/image` プロキシ、`type=input`）と `/api/comfy/view?type=input`（入力画像プレビュー）も既存。

## 要件

1. 通常の1枚生成で、参照画像を「下絵」に指定して img2img 生成できる。参照 denoise（引き継ぎ強度）をスライダーで調整できる。
2. 参照画像は **未指定が既定**。指定しなければ挙動は現状の txt2img と完全に同一（inert-by-default）。
3. 参照画像の入り口: (a) ローカルファイルのアップロード/ドロップ、(b) 直近の生成画像から、(c) ギャラリーからの deep link（`?img2imgRef=<出力相対パス>`）。
4. 一括キュー実行（`RunSetupView`）でも、1つの参照画像を実行全体に適用できる。
5. 参照画像はリロードをまたいで保持される（ComfyUI の input フォルダのファイル名で保持。ファイルはComfyUI側に残る）。

## 仕様（確定）

### データモデル

- `lib/comfy/comfy-types.ts` に `ImageRef` を追加:
  ```ts
  export interface ImageRef {
    /** ComfyUI input フォルダ内のファイル名(/api/comfy/upload の戻り値 name) */
    name: string;
    /** 参照 denoise(1 - 引き継ぎ強度)。小さいほど元画像に忠実。 */
    denoise: number;
    /** UI表示用のラベル(元ファイル名や "20240101-lora/out_00003_.png" 等) */
    sourceLabel?: string;
  }
  ```
- `QueueItem` に `imageRef?: ImageRef`。
- `BatchRunOverrides` に `imageRef?: ImageRef`。
- `useNormalMode` に `imageRef: ImageRef | null` + `setImageRef`。localStorage `cp_image_ref` に永続化。エクスポート/インポートには**含めない**（ComfyUI 側ファイル参照のため可搬性が低い）。

### ワークフロー

- `buildBasePipeline(wf, settings, loras, initImage?)` に第4引数 `initImage?: { name: string }` を追加。指定時は `wf["lat"]` を以下のチェーンで置き換える（最終ノードのキーは `"lat"` のまま。テールの `latent_image: ["lat", 0]` を変更しない）:
  - `wf["initimg"]` = `LoadImage { image: initImage.name }`
  - `wf["initscale"]` = `ImageScale { image: ["initimg",0], width: settings.width, height: settings.height, upscale_method: "lanczos", crop: "center" }`
  - `wf["lat"]` = `VAEEncode { pixels: ["initscale",0], vae: ["chk",2] }`
  - アスペクト比不一致は **中央クロップ**（`crop: "center"`）で吸収する。生成サイズは参照に合わせて変えない。
- `buildWorkflow` に `initImage?: { name: string; denoise: number }` を追加。指定時は `settings` のコピーに `denoise: initImage.denoise` を適用してベース/テールへ渡し、`initImage` をベースへ渡す。`ksamp2`（アップスケール精緻化, denoise 0.5固定）は変更しない。

### キュー処理

- `use-pipeline-queue.ts` の生成ループ: `pendingItem.imageRef` があり、かつ couple/colorMask ワークフローでない場合、`buildWorkflow` に `initImage: { name, denoise }` を渡す。
- `addToQueue`: 現在の `imageRef` を `QueueItem.imageRef` に載せる。
- `runBatchPresets`: `overrides.imageRef` を各 `QueueItem.imageRef` に載せる。
- couple/colorMask は自前ワークフローのため `imageRef` を無視（`addCoupleToQueue` は設定しない）。

### UI

- 新規 `components/pipeline/prompt/image-ref-section.tsx`。`LeftPanel` の**通常タブのみ**、`<Section title="参照画像 / 下絵" defaultOpen={false}>` で サンプラー設定 の後・ランダム構図 の前に配置。
  - 未指定時: ファイル選択/ドロップ + 「直近の生成画像から」ボタン。
  - 指定時: `/api/comfy/view?filename=<name>&type=input` のサムネ + denoise スライダー（範囲 0.2–0.9 / step 0.05 / 既定 0.55）+ プリセットチップ「構図重視 0.40 / バランス 0.55 / 寄せる 0.75」+「クリア」。
  - アップロード: `FormData { image, type: "input" }` を `/api/comfy/upload` へ POST → `{ name }` → `setImageRef({ name, denoise: 0.55, sourceLabel })`。
- 一括キューの下絵は**プリセット固有**。`BatchPreset` に `imageRef?` / `imageRefPool?` を持たせ、「セット編集」画面の `PresetEditor` に `ImageRefSection` を埋め込んで事前指定する。`captureCurrentSettings`（「現在の設定をプリセットとして追加」）は通常モードで設定中の下絵も取り込む。プリセット行には下絵ありを示すアイコンを表示。
- **実行時の i2i 使用可否はプリセット単位のチェックボックスで選ぶ（既定オフ）**。`BatchRunOverrides.i2iEnabledPresetIds?: string[]` に「今回の実行で下絵を使う」プリセットIDを入れ、`runBatchPresets` は ID が含まれるプリセットにだけ `imageRef` / `imageRefPool` を適用する（含まれなければ設定があっても txt2img）。UI は共有コンポーネント `PresetI2iToggles`（下絵設定のあるプリセットのみ列挙、「すべて」トグル付き）を `RunSetupView` と `BulkRunSetupView` の両方に配置。
- `BatchPreset` 上の `imageRef` / `imageRefPool` は `batchPresetSets` の一部としてエクスポート JSON に含まれる（通常モードの `imageRef` / `imageRefPool` は従来どおり非対象）。`imageRefPool.group` / `denoise` は可搬。`names`（ステージ済み ComfyUI 入力名）は環境ローカルなキャッシュで、キュー処理時に `group` から自動再ステージするため、`.i2i/<group>` が対象環境に存在すればインポートしたセットもそのまま動く。
- `CenterPanel`: `?img2imgRef=<出力相対パス>` を検出したら `/api/comfy/output/image?path=` で blob を取得 → `/api/comfy/upload` → `setImageRef`。`?seedSourceFolder=` と同じ consume パターンで URL をクリア。
- 生成中プレビュー（`PreviewPanel` / `PromptPreviewWindow` 付近）に参照サムネを小さくピン留め（任意・MVP では省略可）。

## 受け入れ基準

- [ ] 参照画像を指定せず生成すると、ワークフローJSON・生成結果が現状と同一（`EmptyLatentImage` パス）
- [ ] 参照画像を指定して生成すると `LoadImage → ImageScale(crop:center) → VAEEncode` が組まれ、メインKSamplerの `denoise` がスライダー値になる
- [ ] denoise を下げるほど出力が参照画像の構図・色に近づく
- [ ] 参照画像とアスペクト比が異なっても破綻せず中央クロップされる（生成サイズは変わらない）
- [ ] ローカルファイルのアップロードで参照画像を設定できる
- [ ] 「直近の生成画像から」で直近の出力画像を参照画像に設定できる
- [ ] ギャラリーから `?img2imgRef=` 付きで遷移すると参照画像が自動セットされる
- [ ] リロード後も参照画像が保持される
- [ ] `RunSetupView` で参照画像を指定して一括キューを実行すると、全アイテムが img2img で生成される
- [ ] マルチキャラ（couple/colorMask）タブでは「参照画像」セクションが出ず、couple 生成に影響しない
- [ ] `npx tsc --noEmit` / `npx vitest run` / `npx next build` が通る

## 対応範囲外

- ControlNet（openpose / depth / lineart）からの構図拘束 → 将来 Phase 2。`CoupleControlNet` の型・`buildColorMaskWorkflow` の CN ノード群を共通化して流用する。
- ギャラリー全体を閲覧して選ぶ専用ピッカーダイアログ（MVP は アップロード / 直近 / deep link のみ）
- 参照画像プール（シードプールと同型で、バッチに1枚ずつ配る）→ 将来
- 継承ダイアログへの「参照画像」軸の統合（シード / 変数バインディング / 参照画像の3軸）→ 将来
- letterbox / 生成サイズを参照に合わせるオプション（MVP は中央クロップ固定）
- before/after スライダー等の比較UI
- エクスポート/インポートへの `imageRef` 追加

## 更新履歴

- 2026-08-30 初版。案A（左パネルセクション）＋ img2img のみで MVP 化することを決定（ブレスト経緯は本セッション）。
