import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import {
  getSdScriptsDir,
  getTrainingEnv,
  getVenvPythonPath,
  getWd14TaggerModelDir,
  getWd14TaggerScriptPath,
} from "@/lib/kohya/paths";
import type { DanbooruPostTags } from "./types";

/**
 * 初回はHugging Faceからモデル(数百MB)をダウンロードするため長め。
 * 2回目以降は--model_dir(絶対パス)にキャッシュされるため数秒〜数十秒で終わる。
 */
const TIMEOUT_MS = 6 * 60 * 1000;
const CAPTION_EXTENSION = ".txt";

/**
 * kohya_ss同梱のWD14 tagger(sd-scripts/finetune/tag_images_by_wd14_tagger.py)を、
 * 学習と同じvenvで1枚だけ実行する。データセットフォルダ全体を対象にすると
 * 既存画像まで毎回再タグ付けしてしまうため、対象1枚だけを一時ディレクトリに
 * コピーして実行する。
 *
 * 当初は`--debug`でstdoutに出る"Character tags: .../General tags: ..."をパースして
 * カテゴリ分けする案で実装したが、実機で検証したところPythonの`rich`ロガーが
 * 固定カラム幅でログを折り返すため（Node経由でパイプ接続した非TTY実行でも折り返される
 * ことをspawnして直接確認済み）、"General"と"tags:"が別の物理行に分かれるなどして
 * 正規表現が実質マッチしなかった。そのため`--debug`は使わず、taggerが素直に書き出す
 * `<image>.txt`（フラットなカンマ区切り、折り返し無し）を直接読む方式に変更した。
 * この方式ではWD14タガー側のカテゴリ分け（character/general等）は失われるため、
 * 全タグをgeneralカテゴリに入れる（copyright/artist/metaはWD14に対応カテゴリが無いため
 * 元々空配列）。
 */
export async function tagImageFile(imagePath: string): Promise<DanbooruPostTags | { error: string }> {
  const scriptPath = getWd14TaggerScriptPath();
  const tmpDir = path.join(os.tmpdir(), `cp-tagger-${crypto.randomUUID()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const tmpImageName = `image${path.extname(imagePath)}`;
    fs.copyFileSync(imagePath, path.join(tmpDir, tmpImageName));

    const args = [
      scriptPath,
      tmpDir,
      "--onnx",
      "--caption_extension",
      CAPTION_EXTENSION,
      "--model_dir",
      getWd14TaggerModelDir(),
    ];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(getVenvPythonPath(), args, {
        cwd: getSdScriptsDir(),
        env: getTrainingEnv(),
      });

      let errOutput = "";
      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error("taggerの実行がタイムアウトしました"));
      }, TIMEOUT_MS);

      proc.stderr?.on("data", (chunk: Buffer) => {
        errOutput += chunk.toString();
      });
      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`tagger終了コード ${code}\n${errOutput.slice(-2000)}`));
      });
      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    const captionPath = path.join(tmpDir, tmpImageName.replace(path.extname(tmpImageName), CAPTION_EXTENSION));
    const raw = fs.readFileSync(captionPath, "utf-8");
    const general = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    return { general, character: [], copyright: [], artist: [], meta: [] };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "taggerの実行に失敗しました" };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
