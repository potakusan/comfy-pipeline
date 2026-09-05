# 構図プール（.i2i 参照画像プール）

対応issue: 未起票（本提案が spec-ready。起票時は `.github/ISSUE_TEMPLATE/feature_spec.md` 構成）

親: `docs/proposals/img2img-reference.md`（img2img MVP、実装済み）の拡張。

## 実装状況（2026-08-30 実装済み）

本提案の「仕様（確定）」どおりに実装。主なファイル:
`lib/server/i2i-pool.ts`（`.i2i` 走査・追加・削除・ComfyUI へのステージング）,
`app/api/i2i/{groups,image,images,upload,add,stage}/route.ts`,
`app/api/gallery/folders/route.ts`（`.i2i` を一覧から除外）,
`lib/comfy/comfy-types.ts`（`ImageRefPool`）,
`hooks/pipeline/use-normal-mode.ts`（`imageRefPool` state・`cp_image_ref_pool`・`imageRef` と排他）,
`hooks/pipeline/use-pipeline-queue.ts`（生成ループでプールから毎バッチ1枚ランダム抽選、`samePrompt` 時は同じ1枚を再利用）,
`components/pipeline/prompt/image-ref-section.tsx`（単一/プール モード切替）,
`components/pipeline/prompt/i2i-pool-manager-dialog.tsx`（グループ作成・アップロード・削除、パイプライン/ギャラリー共用）,
`components/pipeline/queue/batch-queue-run-setup-view.tsx`（プール行）,
`app/gallery/page.tsx`（「構図プールへ」ボタン）,
`test/unit/i2i-pool.test.ts`（パス安全性 4ケース）。

検証: `npx tsc --noEmit` クリーン / `npx vitest run` 121 passed / `npx eslint .` 指摘数不変（174）/ `npx next build` 成功。

## 背景

販売用に「構図・ポージングを揺らしたバリエーションを大量生成」したい。揺らしの軸は2本ある。

| 軸 | 手段 | 状況 |
|---|---|---|
| プロンプト揺らし（手・表情・小物） | `promptMode:"random"` プリセット / `random` モード変数 | 既存機能で対応済み。新規実装不要 |
| 構図・カメラワーク揺らし | 参照画像（img2img） | 単一画像は img2img MVP で対応済み。**複数パターンをランダムに当てる仕組みが未対応** ← 本提案 |

img2img は多少構図が揺れてよい（ユーザー確認済み）。ControlNet は対応範囲外（将来）。

## 要件

1. 良い構図の画像を**フォルダ単位でグルーピング**して保管できる（`.seed-archive/` と同じく出力ディレクトリのライフサイクルから独立した `.i2i/`）。
2. フォルダは**入れ子で細分化**できる。グループを選ぶとそのフォルダ＋サブフォルダの画像すべてが対象。
3. 1グループに複数枚あるとき、**生成ごとにランダムで1枚**を下絵に使う。
4. 通常の1枚生成でも一括キュー実行でも、同じグループを選んで使える。
5. **ギャラリーページから、表示中の画像を任意のグループへ保存**できる。
6. 参照プール未選択なら挙動は現状どおり（単一画像 img2img / txt2img）。

## 仕様（確定）

### ストレージ

- `<outputDir>/.i2i/<グループパス>/<hash>.<ext>`。
- グループ = `.i2i/` 以下の**任意の深さのディレクトリ**。画像集合はそのディレクトリ以下（サブフォルダ含む）**再帰**。
- ファイル名は**内容のSHA1先頭16桁**。同一画像の二重追加は冪等（既存ならスキップ）。
- `.i2i/` はギャラリーのフォルダ走査対象から除外する（`app/api/gallery/folders/route.ts` の除外リストに追加。`.seed-archive` と同様）。

### サーバ（`lib/server/i2i-pool.ts` + API）

- `listI2iGroups(): { path: string; depth: number; count: number; thumbnail: string | null }[]`
  画像を含むディレクトリを再帰列挙。`count` は再帰件数、`thumbnail` は代表画像の相対パス。
- `listGroupImages(group: string): string[]`（`.i2i` からの相対パス、再帰）
- `addImageFromBuffer(group, buf, ext): string`（hash名で書き込み、相対パスを返す）
- `deleteImage(relPath): void`
- `readImage(relPath): { buffer: Buffer; mime: string } | null`
- `stageGroupToComfy(group): Promise<string[]>`
  グループの各画像を `${getComfyUIUrl()}/upload/image` へ `FormData{ image, type:"input", overwrite:"true" }` で POST（`i2i_<hash>.<ext>` 名、`Promise.all` 並列）。返ってきた `name` の配列を返す。ローカル/リモート両対応（`/api/comfy/upload` と同じ経路）。
- パスは全て `safePath(i2iDir(), ...)` + `IMAGE_EXT` チェック。`group` は `..` / 先頭 `/` / `\` / 制御文字を拒否。

API ルート:
- `GET  /api/i2i/groups` → `{ groups }`
- `GET  /api/i2i/image?path=<rel>` → 画像バイト（サムネ・グリッド兼用）
- `GET  /api/i2i/images?group=<path>` → `{ images: { path: string }[] }`
- `POST /api/i2i/upload`（FormData `{ group, image }`）→ `{ path }`
- `POST /api/i2i/add`（JSON `{ group, sourcePath }`、`sourcePath` は出力相対パス）→ `{ path }`
- `POST /api/i2i/stage`（JSON `{ group }`）→ `{ names: string[] }`
- `DELETE /api/i2i/image`（JSON `{ path }`）→ `{ ok: true }`

### データモデル

```ts
export interface ImageRefPool {
  group: string;      // .i2i 以下のグループパス
  denoise: number;
  names: string[];    // ステージ済み ComfyUI input ファイル名。生成ごとにランダムで1枚。
}
```
- `QueueItem.imageRefPool?: ImageRefPool`
- `BatchRunOverrides.imageRefPool?: ImageRefPool`
- `useNormalMode`: `imageRefPool: ImageRefPool | null` + `setImageRefPool`。localStorage `cp_image_ref_pool`。エクスポート/インポートには含めない。
- `imageRef`（単一）と `imageRefPool` は排他。片方をセットするともう片方をクリアする。

### 生成

- `use-pipeline-queue.ts` の生成ループ: `initImage` を次の優先順で決める。
  1. `pendingItem.imageRefPool` があれば `names` からランダムに1枚 → `{ name, denoise: pool.denoise }`
  2. なければ `pendingItem.imageRef` → `{ name, denoise }`
  3. どちらも無ければ `undefined`（txt2img）
- 「プロンプト固定でやり直し」(`samePrompt`) では**同じ1枚を再利用**する（`lastResolvedBindings` と同様に `lastInitImage` を保持）。「やり直し(reroll)」では引き直す。
- `buildWorkflow` は無改修（`initImage` を受けるだけ）。

### UI

`components/pipeline/prompt/image-ref-section.tsx` にモード切替を追加: **単一画像 / 構図プール**。
- 構図プール時: `/api/i2i/groups` を取得しインデント付きリストで表示 → 選択で `POST /api/i2i/stage` → `setImageRefPool({ group, denoise, names })`。「N枚 · 生成ごとにランダム」表示。denoise スライダーとプリセットは共通。「再ステージ」ボタン（画像を足した後の反映）。「プールを管理」ボタン。
- モードは `imageRefPool` の有無から導出。切替時に他方をクリア。
- 左パネル（通常タブ）と `RunSetupView` の両方で使える（`RunSetupView` は既に `ImageRefSection` を使用中。プール用 props を渡すだけ）。

`components/pipeline/prompt/i2i-pool-manager-dialog.tsx`（新規、パイプライン/ギャラリー共用）:
- グループ一覧＋「新規グループ」入力（`/` で階層可）。
- グループ選択でサムネグリッド（各画像に削除✕）。
- 「アップロード」（複数ファイル）→ `POST /api/i2i/upload`。
- 任意 prop `addSourcePath?: string`: セット時は上部に「この画像を〈group〉へ追加」ボタン（`POST /api/i2i/add`）。

ギャラリーページ（`app/gallery/page.tsx`）中央ツールバー: 「構図プールへ」ボタン → `I2iPoolManagerDialog` を `addSourcePath={selected.path}` で開く。

## 受け入れ基準

- [ ] `.i2i/<group>/` に画像を追加でき、入れ子グループ（`親/子`）も作れる
- [ ] グループ選択でステージされ、`ImageRefPool.names` が埋まる
- [ ] 親グループを選ぶとサブフォルダの画像も対象になる
- [ ] プール選択で生成すると、各バッチが `names` からランダムに選んだ画像で img2img される
- [ ] 「プロンプト固定でやり直し」では同じ下絵が再利用される
- [ ] 一括キュー実行（`RunSetupView`）でプールを選ぶと、全アイテムがそのプールで生成される
- [ ] ギャラリーページで表示中の画像を任意のグループへ保存でき、同じ画像の二重追加が冪等
- [ ] プールも単一画像も未選択なら、ワークフロー・結果が現状と同一
- [ ] `imageRef` と `imageRefPool` は排他（片方セットで他方クリア）
- [ ] `.i2i/` がギャラリーのフォルダ一覧に出ない
- [ ] `npx tsc --noEmit` / `npx vitest run` / `npx next build` が通る

## 対応範囲外

- ControlNet（openpose/depth）プール。グループに種別を持たせて `buildColorMaskWorkflow` の CN ノードを共通化 → 将来
- グループごとの denoise 既定値の保存（当面はセクションのスライダー値を使う）
- ステージのインクリメンタル差分更新（当面は選択時に全画像を再アップロード。hash名＋overwriteで実害は小さい）
- 手・表情プリセットの `random` 変数化・表記ゆれ正規化（別タスク）
- 継承ダイアログへの統合

## 追加実装（2026-08-30 UI 調整）

- 「参照画像 / 下絵」セクションの**既定モードを構図プール**に、**denoise 既定を 0.8**（`ImageRefSection` / `?img2imgRef=` deep link）。プリセットは 構図重視 0.6 / 標準 0.8 / 大きく変える 0.9、スライダー上限 0.95。
- グループ選択を**サムネ表示**に変更（`I2iGroup.thumbnails` = 先頭最大4件、超過分は「+N」）。
- 新フローティングウィンドウ **参照画像**（`reference-image-window.tsx`）: 参照が指定されているときだけ表示。生成中はその生成で採用された1枚、待機中はプール説明／単一画像。`use-pipeline-queue` が `currentBatchInitImageName` を公開。
- 新フローティングウィンドウ **ランダム要素**（`random-elements-window.tsx`）: キューの running/pending/completed でランダム要素を持つアイテムを一覧。各抽選元について採用行を表示し、行ホバーのツールチップで全候補を表示。`use-pipeline-queue` が抽選を `RandomChoice[]` として記録（`promptMode:"random"` プリセット行・ランダム１行・ランダム構図・`random` 変数）し、`GalleryImage.randomChoices` / sidecar にも保存、`currentBatchRandomChoices` を公開。
- **サムネ専用の縮小画像を自動生成**（`lib/server/i2i-pool.ts`）: 画像追加時に `sharp` で 256px webp を `.i2i/.thumbs/<group>/<hash>.<ext>.webp` へ生成。`GET /api/i2i/image?...&thumb=1` で配信し、グループピッカー／管理グリッドはこれを参照。`.thumbs` はグループ走査・`stageGroupToComfy` の対象外（＝ img2img の下絵には絶対に使われない）。旧データ・外部配置画像は初回アクセス時に遅延生成（本セッションで既存9枚のサムネ生成済み）。`deleteImage` はサムネも削除。
- **参照画像ウィンドウもサムネを使用**: `GET /api/i2i/thumb-for-comfy?name=i2i_<hash>.<ext>` がステージ済み ComfyUI 入力名から元 `.i2i` 画像を hash 逆引きして 256px webp を返す。`ReferenceImageWindow` はプール由来の下絵をこれで表示（単一画像 `ref_*` は該当なしで ComfyUI 原寸、`onError` で原寸フォールバック）。
- **販売用画像をポーズ別に一括取り込み**: `POST /api/i2i/import-released`（`importReleasedImagesByPose`）が出力ディレクトリの全 `*_release/` フォルダを走査し、各画像を `getPoseGroup(ファイル名)`（`_NNNNN` の前まで）で決めたポーズ名の `.i2i/<ポーズ>/` へ取り込む。既存グループは統合、hash 重複はスキップ。戻り値 `{ added, skipped, byPose }`。`I2iPoolManagerDialog` に「販売用画像をポーズ別に取り込む」ボタンと結果表示を追加。`addImageFromBuffer` / `addImageFromOutput` の戻り値を `{ rel, created }` に変更（新規/既存の判別用）。

## 更新履歴

- 2026-08-30 初版。img2img（多少の構図揺れ許容）＋ ギャラリーからの `.i2i` 保存で確定（本セッションのブレスト経緯）。
- 2026-08-30 UI 調整（既定モード=プール / denoise 0.8 / サムネ選択 / 参照画像・ランダム要素の2ウィンドウ追加）。
