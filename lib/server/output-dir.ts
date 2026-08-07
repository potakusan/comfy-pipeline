import path from "path";
import { getOutputDir as getConfiguredOutputDir } from "@/lib/setup/config";

export function getOutputDir(): string {
  return getConfiguredOutputDir();
}

/** Resolves `relPath` inside `baseDir`, rejecting directory traversal. Returns null if unsafe. */
export function safePath(baseDir: string, relPath: string): string | null {
  const base = path.resolve(baseDir);
  const resolved = path.resolve(base, relPath);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return resolved;
}

export const IMAGE_EXT = /\.(png|jpe?g|webp|avif|gif)$/i;
