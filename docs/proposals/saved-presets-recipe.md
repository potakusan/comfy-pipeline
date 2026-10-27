# 生成レシピの保存と `_savedpresets` からの部分差し替え再生成

対応issue: 未起票（本提案が確定したら feature_spec で起票する）

## 背景

販売用選択（`POST /api/gallery/release`）時に、画像とサイドカーJSONを `<folder>_release/` へコピーし、seed 等だけを `.seed-archive/`（320px webp ＋ JSON）へ残している。

- サイドカーが持つのは組み立て済み `positivePrompt`・`settings`・`loras`・`batchPresetId`・`bindings`・`randomChoices` のみ。どのスロットでどのプリセットを選んだか、プロンプトのどの部分がどこ由来かは残っていない。
- `batchPresetId` は localStorage のプリセットを ID で引き直すため、プリセット編集・削除後は元の設定を再現できない。通常モード由来の画像は `batchPresetId` 自体が無い。
- 容量: `_release` はフル解像度PNGのコピーで、フォルダを消すと `.seed-archive` 以外の情報が失われる。

要求: 販売用に選んだ画像セットについて、同じ設定のまま一部（キャラLoRA・キャラ部分のプロンプト・服装など）だけ変えて再生成できるようにする。保存は縮小JPG＋JSONで行い、そこから選択できるようにする。

## 要件

1. 画像ごとに「選択された項目ごとのデータ」（レシピ）を保存する。後からプリセット定義が変わっても再現できる。
2. 保存先は縮小JPG＋JSONの `_savedpresets`。`_release`（フル解像度PNG、販売用の実体）は現状維持。
3. 再利用時、プリセット（スロット）単位の差し替えができる。
4. 服装は複数箇所に散在する（可変LoRAのトリガー内 / 身体的特徴 / `other` / `%%clothedfemale%%` のような変数）。服装専用スロットは作らず、出どころに関係なく差し替えられる。
5. 断片丸ごとの差し替えが主。断片内のテキストの部分編集もできる。
6. `%%name%%` 変数の置換先（モード・固定値・候補）を再利用時に変更できる。変更はその実行限りで、グローバル定義は書き換えない。
7. 変数の入れ子は無い（`applyVariableBindings` は1回置換）ため、解決順は保存しない。

## 設計

### レシピ（`ImageMetadata.recipe`）

`schemaVersion` 付きで以下を保存する。旧画像（`recipe` 無し）は従来の「数値seed＋bindingsのみ引き継ぎ」にフォールバックする。

- 可変LoRA / 固定LoRA / `fixedTags` / ネガティブ / `variationTags` / 追加プロンプト（生テキスト＋モード）
- スロット別プリセット（physical / count / pose / scene / other）の**全文スナップショット**（ID・名前・prompt・lora・promptMode）
- `BatchPreset` 全体のスナップショット
- `settings`（seed・upscaleSeed 含む）
- `segments`: プロンプト断片のリスト。各要素は `source`（`variableLora.trigger` / `fixedTags` / `preset:<slot>` / `additional` / `variation`）・`presetId?`・`presetName?`・解決前 `text`（`%%name%%` 残し）
- 使われた変数のみの定義スナップショット（モード・固定値・候補・デフォルト）と解決済み `bindings`
- `randomChoices`、`imageRef` / `imageRefPool` の情報

### 保存先

```
_savedpresets/<folder>/<filename>.jpg        長辺 512〜768px, quality 80 程度
_savedpresets/<folder>/<filename>.jpg.json   レシピを含む完全なメタデータ
```

- `.seed-archive` を置き換える。既存エントリは初回アクセス時に移行する（レシピ無しの旧エントリとして扱う）。
- 選択解除（`DELETE /release`）で `_savedpresets` 側も削除する（現在の `removeArchivedSeed` と同じ）。
- フォルダ一覧（`gallery/folders`）・プリセット統計（`gallery-preset-stats`）の走査から `_savedpresets` を除外する（現在 `SEED_ARCHIVE_DIR` で除外している2箇所）。

### 再利用フロー

保存済みレシピを選ぶと実行画面に初期値が入る。実行は既存の `runBatchPresets(presets, overrides)` に、スナップショットから再構成した `BatchPreset` と `BatchRunOverrides` を渡す。新規のワークフロー処理は不要。

| 項目 | 扱い |
|---|---|
| 可変LoRA | 差し替え可（`overrides.variableLora`） |
| physical / scene | 差し替え可（既存 overrides） |
| count / pose / other | 流用。必要なら差し替え（`other` の一部差し替えは新規対応） |
| 断片（`segments`） | 断片ごとに「差し替え / 削除 / 部分編集」。出どころ（LoRAトリガー・身体的特徴・other・変数）を問わない |
| 変数 | 変数ごとに「前回値を引き継ぐ / 再抽選 / 値を上書き / 候補を差し替え」。編集はこの実行限り（`QueueItem.variableDefs` のスナップショットに適用） |
| settings / seed / ネガティブ | 流用 |

- 断片の部分編集は、断片テキストの編集結果をその実行の断片リストに反映する形で実装する（既存の `promptReplacements` は、断片に分解できない箇所の一括置換用として残す）。
- 服装系変数は、キャラ差し替え後に前回値が合わなくなりうる。再利用画面で変数をまとめて「再抽選/再入力」にするボタンを用意する。変数定義に任意タグ（例 `group: "outfit"`）を持たせて一括解除に使うかは Phase 4 で判断する。
- 「今後も使うのでグローバル定義にも反映」は任意チェックボックスとする。

## 段階実装

1. **Phase 1 — レシピ保存**: `recipe`（スロット別スナップショット・`segments`・変数定義スナップショット）をサイドカーへ書く。再利用側は未実装。
2. **Phase 2 — `_savedpresets`**: 縮小JPG＋JSON、除外処理、`.seed-archive` からの移行、一覧API。
3. **Phase 3 — 復元と差し替え**: レシピ選択UI、スナップショットから `BatchPreset` / `overrides` を再構成、スロット単位のプリセット差し替え、変数の引き継ぎ/再抽選/上書き。
4. **Phase 4 — 断片編集・変数置換先の編集**: `segments` ごとの差し替え・部分編集、変数の候補差し替え、服装系の一括解除。

## 受け入れ基準（ドラフト）

- [ ] 生成した画像のサイドカーに、スロット別プリセットのスナップショット・`segments`・使用変数の定義スナップショットが保存される
- [ ] 販売用選択で `_savedpresets/<folder>/` に縮小JPGとレシピ入りJSONが作られ、選択解除で削除される。`_release` の挙動（フル解像度PNG＋JSON）は変わらない
- [ ] `_savedpresets` がギャラリーのフォルダ一覧・プリセット統計に現れない
- [ ] 元の出力フォルダ・元のプリセット定義が削除/変更済みでも、保存済みレシピから再生成できる
- [ ] 保存済みレシピから、可変LoRA・physical・scene を差し替えて一括キューに追加できる（それ以外は元と同一のプロンプト・settings）
- [ ] 服装を含む断片が、LoRAトリガー内・physical・other・変数のいずれにあっても、断片単位で差し替え/削除/部分編集できる
- [ ] 変数の値・モード・候補を再利用時に変更でき、グローバル定義（`cp_variable_defs`）は書き換わらない
- [ ] `recipe` を持たない旧エントリは従来どおり seed（＋bindings）のみ引き継ぎで動く

## 対応範囲外（初期）

- カップル / colorMask ワークフローのレシピ保存と再利用
- 旧画像のレシピ再構成
- 一括実行（`BulkRunSetupView`）からの再利用
- `_release` の縮小化（販売用の実体のため現状維持）
