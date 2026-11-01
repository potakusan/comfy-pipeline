import path from "path";

/** Windowsのフォルダ名に使えない文字 */
const INVALID_NAME_CHARS = /[\/:*?"<>|]/g;

export function sanitizeFolderName(name: string): string {
  return name.replace(INVALID_NAME_CHARS, "").trim();
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** YYYYMMDD */
export function formatDateYmd(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1, 2)}${pad(date.getDate(), 2)}`;
}

/** <root>\YYYYMM\YYYYMMDD_キャラクター名\グループ名 。名前が空になる場合はnull。 */
export function buildReleaseDir(root: string, date: Date, character: string, group: string): string | null {
  const c = sanitizeFolderName(character);
  const g = sanitizeFolderName(group);
  if (!c || !g) return null;
  const ymd = formatDateYmd(date);
  return path.join(root, ymd.slice(0, 6), `${ymd}_${c}`, g);
}

/** 既存ファイル(01.jpg等)の連番の最大値。連番でないファイルは無視する。 */
export function maxExistingSequence(filenames: string[]): number {
  let max = 0;
  for (const f of filenames) {
    const m = f.match(/^(\d+)\.[^.]+$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

/** 元ファイル名の並び順のまま 01,02,... へ振り直す(拡張子は維持)。startは最初の番号。 */
export function numberedNames(sources: string[], start: number): string[] {
  const width = Math.max(2, String(start + sources.length - 1).length);
  return sources.map((src, i) => `${pad(start + i, width)}${path.extname(src).toLowerCase()}`);
}
