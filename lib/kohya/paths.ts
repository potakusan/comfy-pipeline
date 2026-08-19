import fs from "fs";
import path from "path";
import { getKohyaGuiPath } from "@/lib/setup/config";

/**
 * D:\kohya_ss の実物（kohya_gui/common_gui.py: setup_environment(), gui.bat）を読んで
 * 確認した通り、accelerate/学習スクリプトの実行にはvenvのScripts直下の実行ファイルと
 * 以下の環境変数が必要。venv activateを介さず直接spawnするため、ここで明示的に組み立てる。
 */

export function getSdScriptsDir(): string {
  return path.join(getKohyaGuiPath(), "sd-scripts");
}

function getVenvScriptsDir(): string {
  return path.join(getKohyaGuiPath(), "venv", process.platform === "win32" ? "Scripts" : "bin");
}

export function getAccelerateExePath(): string {
  return path.join(getVenvScriptsDir(), process.platform === "win32" ? "accelerate.exe" : "accelerate");
}

/** 学習(accelerate)とtagger(素のpython)で同じvenvを使う前提を1箇所に集約する。 */
export function getVenvPythonPath(): string {
  return path.join(getVenvScriptsDir(), process.platform === "win32" ? "python.exe" : "python");
}

export function getSdxlTrainScriptPath(): string {
  return path.join(getSdScriptsDir(), "sdxl_train_network.py");
}

export function getWd14TaggerScriptPath(): string {
  return path.join(getSdScriptsDir(), "finetune", "tag_images_by_wd14_tagger.py");
}

/** モデルの永続キャッシュ先。相対パス既定のままだとcwd次第で毎回再ダウンロードされるため絶対パスにする。 */
export function getWd14TaggerModelDir(): string {
  return path.join(getKohyaGuiPath(), "wd14_tagger_model");
}

export function getTrainingEnv(): NodeJS.ProcessEnv {
  const kohyaGuiPath = getKohyaGuiPath();
  const sdScriptsDir = getSdScriptsDir();
  const env = { ...process.env };

  env.PYTHONPATH = [kohyaGuiPath, sdScriptsDir, env.PYTHONPATH].filter(Boolean).join(path.delimiter);
  env.TF_ENABLE_ONEDNN_OPTS = "0";
  env.TF_CPP_MIN_LOG_LEVEL = env.TF_CPP_MIN_LOG_LEVEL ?? "2";

  if (process.platform === "win32") {
    env.XFORMERS_FORCE_DISABLE_TRITON = "1";
    const torchLib = path.join(kohyaGuiPath, "venv", "Lib", "site-packages", "torch", "lib");
    env.PATH = [env.PATH, torchLib].filter(Boolean).join(path.delimiter);
  }

  return env;
}

/** 学習開始前の事前チェック。未設定・パス不在をユーザー向けメッセージにして返す。 */
export function validateKohyaInstall(): string | null {
  const kohyaGuiPath = getKohyaGuiPath();
  if (!kohyaGuiPath) return "Kohya's GUI / sd-scriptsインストールフォルダが設定されていません";
  if (!fs.existsSync(kohyaGuiPath) || !fs.statSync(kohyaGuiPath).isDirectory()) {
    return `フォルダが見つかりません: ${kohyaGuiPath}`;
  }
  const accelerate = getAccelerateExePath();
  if (!fs.existsSync(accelerate)) {
    return `accelerateが見つかりません（venvが未セットアップの可能性があります）: ${accelerate}`;
  }
  const script = getSdxlTrainScriptPath();
  if (!fs.existsSync(script)) {
    return `sdxl_train_network.pyが見つかりません（sd-scriptsサブモジュールが未取得の可能性があります）: ${script}`;
  }
  return null;
}

/** tagger実行前の事前チェック。venvのpython自体はvalidateKohyaInstallと共通なのでそちらを先に呼ぶ想定。 */
export function validateTaggerAvailable(): string | null {
  const kohyaError = validateKohyaInstall();
  if (kohyaError) return kohyaError;
  const script = getWd14TaggerScriptPath();
  if (!fs.existsSync(script)) {
    return `tag_images_by_wd14_tagger.pyが見つかりません: ${script}`;
  }
  return null;
}
