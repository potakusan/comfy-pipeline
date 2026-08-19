import fs from "fs"
import path from "path"
import os from "os"

const CONFIG_PATH = path.join(process.cwd(), ".comfy-pipeline.json")

export interface SetupConfig {
  comfyuiPath?: string
  comfyuiUrl?: string
  comfyuiApiKey?: string
  outputDir?: string
  checkpointDir?: string
  loraDir?: string
  upscalerDir?: string
  remoteProcessUrl?: string
  civitaiApiKey?: string
  loraDatasetDir?: string
  danbooruLogin?: string
  danbooruApiKey?: string
  kohyaGuiPath?: string
}

export function readSetupConfig(): SetupConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"))
  } catch {
    return {}
  }
}

export function writeSetupConfig(config: SetupConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8")
}

/**
 * comfyuiPathはexecFileSync/spawnの引数としてシェルを介さず渡されるため
 * コマンドインジェクションの余地は無いが、実在しないパスをそのまま使うと
 * 不可解なENOENT等で失敗するため、保存前に存在確認だけ行う。
 */
export function validateSetupConfig(config: Partial<SetupConfig>): string | null {
  if (config.comfyuiPath !== undefined && config.comfyuiPath !== "") {
    if (!fs.existsSync(config.comfyuiPath) || !fs.statSync(config.comfyuiPath).isDirectory()) {
      return `comfyuiPathが存在するディレクトリではありません: ${config.comfyuiPath}`
    }
  }
  if (config.kohyaGuiPath !== undefined && config.kohyaGuiPath !== "") {
    if (!fs.existsSync(config.kohyaGuiPath) || !fs.statSync(config.kohyaGuiPath).isDirectory()) {
      return `kohyaGuiPathが存在するディレクトリではありません: ${config.kohyaGuiPath}`
    }
  }
  return null
}

/**
 * 検証→既存設定とのマージ→書き込みまでをまとめて行う。app/api/settingsと
 * app/api/setup/configの両routeが同じ.comfy-pipeline.json読み書き処理を
 * 個別実装していたため、ここへ集約し両routeはこの関数を呼ぶ薄い
 * ラッパーにする(バリデーション追加時に片方だけ更新し忘れることを防ぐ)。
 */
export function applySetupConfigUpdate(
  body: Partial<SetupConfig>,
): { error: string } | { config: SetupConfig } {
  const error = validateSetupConfig(body)
  if (error) return { error }
  const current = readSetupConfig()
  const updated = { ...current, ...body }
  writeSetupConfig(updated)
  return { config: updated }
}

// Field -> env var name. Env vars always win over the JSON config, matching
// the existing getComfyUIPath() precedence (env > config.json > default).
const FIELD_ENV_MAP: Record<keyof SetupConfig, string> = {
  comfyuiPath: "COMFYUI_PATH",
  comfyuiUrl: "COMFYUI_URL",
  comfyuiApiKey: "NEXT_PUBLIC_COMFYUI_API_KEY",
  outputDir: "COMFYUI_OUTPUT_DIR",
  checkpointDir: "COMFYUI_CHECKPOINT_DIR",
  loraDir: "COMFYUI_LORA_DIR",
  upscalerDir: "COMFYUI_UPSCALER_DIR",
  remoteProcessUrl: "REMOTE_PROCESS_URL",
  civitaiApiKey: "CIVITAI_API_KEY",
  loraDatasetDir: "LORA_DATASET_DIR",
  danbooruLogin: "DANBOORU_LOGIN",
  danbooruApiKey: "DANBOORU_API_KEY",
  kohyaGuiPath: "KOHYA_GUI_PATH",
}

/** Fields currently pinned by an environment variable (settings UI should disable these). */
export function getEnvOverrides(): Partial<Record<keyof SetupConfig, boolean>> {
  const result: Partial<Record<keyof SetupConfig, boolean>> = {}
  for (const key of Object.keys(FIELD_ENV_MAP) as (keyof SetupConfig)[]) {
    if (process.env[FIELD_ENV_MAP[key]]) result[key] = true
  }
  return result
}

function getField(key: keyof SetupConfig, fallback: string): string {
  const envVal = process.env[FIELD_ENV_MAP[key]]
  if (envVal) return envVal
  const config = readSetupConfig()
  return config[key] || fallback
}

function getOptionalField(key: keyof SetupConfig): string | undefined {
  const envVal = process.env[FIELD_ENV_MAP[key]]
  if (envVal) return envVal
  return readSetupConfig()[key] || undefined
}

export function getComfyUIPath(): string {
  return getField("comfyuiPath", path.join(os.homedir(), "ComfyUI"))
}

export function getComfyUIUrl(): string {
  return getField("comfyuiUrl", "http://localhost:8188")
}

export function getComfyUIApiKey(): string | undefined {
  return getOptionalField("comfyuiApiKey")
}

export function getOutputDir(): string {
  return getField("outputDir", path.join(process.cwd(), "..", "ComfyUI", "output"))
}

export function getCheckpointDir(): string {
  return getField("checkpointDir", "")
}

export function getLoraDir(): string {
  return getField("loraDir", "")
}

export function getUpscalerDir(): string {
  return getField("upscalerDir", "")
}

export function getRemoteProcessUrl(): string | undefined {
  return getOptionalField("remoteProcessUrl")
}

export function getCivitaiApiKey(): string | undefined {
  return getOptionalField("civitaiApiKey")
}

export function getLoraDatasetDir(): string {
  return getField("loraDatasetDir", path.join(process.cwd(), "lora-datasets"))
}

export function getDanbooruLogin(): string | undefined {
  return getOptionalField("danbooruLogin")
}

export function getDanbooruApiKey(): string | undefined {
  return getOptionalField("danbooruApiKey")
}

export function getKohyaGuiPath(): string {
  return getField("kohyaGuiPath", "")
}
