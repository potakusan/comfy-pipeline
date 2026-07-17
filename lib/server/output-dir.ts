import path from "path";
import { getOutputDir as getConfiguredOutputDir } from "@/lib/setup/config";

export function getOutputDir(): string {
  return getConfiguredOutputDir();
}

/** Resolves `relPath` inside `baseDir`, rejecting directory traversal. Returns null if unsafe. */
export function safePath(baseDir: string, relPath: string): string | null {
  const resolved = path.resolve(baseDir, relPath);
  if (!resolved.startsWith(path.resolve(baseDir))) return null;
  return resolved;
}

export const IMAGE_EXT = /\.(png|jpe?g|webp|avif|gif)$/i;
