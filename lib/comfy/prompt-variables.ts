// プロンプト変数バインディング。
//
// プリセットや追加プロンプトのテキストに `%%name%%` 形式の名前付き変数を書けるようにし、
// 生成時に具体値へ解決する。「プロンプト＝テンプレート＋変数バインディング」というモデルで、
// (1) その他/ランダム要素の引き継ぎ再現 (2) キャラ依存箇所の差し替え (3) 複数プリセットへの
// 一括反映 を1つの仕組みに畳み込む。詳細は docs/proposals/seed-inheritance-prompt-carryover.md。
//
// スコープはグローバル(同名＝同一変数)。定義(VariableDef)を持たない変数は暗黙的に
// `input` モード・デフォルト無しとして扱う。

/** 変数の解決方法。fixed=固定値, random=候補から抽選, input=実行前にユーザー入力。 */
export type VariableMode = "fixed" | "random" | "input";

export interface VariableDef {
  name: string;
  mode: VariableMode;
  /** fixed: 使用する値 / input: 未入力時のデフォルト値 */
  value?: string;
  /** random: 抽選候補 / input: 入力補助の候補(任意) */
  candidates?: string[];
}

/** 変数名 → 定義。localStorage(cp_variable_defs)に永続化される。 */
export type VariableDefs = Record<string, VariableDef>;

/** 変数名 → 解決済みの具体値。 */
export type VariableBindings = Record<string, string>;

/** 解決後プロンプトに対する素朴な文字列置換(変数化していない箇所のエスケープハッチ)。 */
export interface PromptReplacement {
  from: string;
  to: string;
}

/** 変数がどこで使われているか(UI のバッジ/ツールチップ用)。 */
export interface VariableUsage {
  name: string;
  /** 使用元プリセットの id(追加プロンプト等プリセット外なら擬似 id) */
  sourceId: string;
  /** 使用元の表示名(プリセット名・「追加プロンプト」等) */
  sourceLabel: string;
  /** スロット種別。 */
  slot: string;
  /** 変数を含む行(ツールチップに出すプロンプト断片) */
  snippet: string;
}

/** collectVariableUsages へ渡す走査対象。 */
export interface VariablePromptSource {
  id: string;
  label: string;
  slot: string;
  text: string;
}

const VAR_TOKEN = /%%([A-Za-z0-9_]+)%%/g;

/** 変数名として許可する文字(UI のバリデーション用)。 */
export const VARIABLE_NAME_RE = /^[A-Za-z0-9_]+$/;

/** テキスト中に出現する変数名を重複なしで返す(出現順)。 */
export function extractVariableNames(text: string): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(VAR_TOKEN)) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/** 定義が無い変数は暗黙の input(デフォルト無し)として扱う。 */
export function getVariableDef(defs: VariableDefs, name: string): VariableDef {
  return defs[name] ?? { name, mode: "input" };
}

/** 複数の走査対象から、変数ごとの使用箇所一覧を作る(1行に複数変数があれば行を共有)。 */
export function collectVariableUsages(
  sources: VariablePromptSource[],
): VariableUsage[] {
  const usages: VariableUsage[] = [];
  for (const src of sources) {
    if (!src.text) continue;
    for (const line of src.text.split("\n")) {
      const names = extractVariableNames(line);
      if (names.length === 0) continue;
      const snippet = line.trim();
      for (const name of names) {
        usages.push({
          name,
          sourceId: src.id,
          sourceLabel: src.label,
          slot: src.slot,
          snippet,
        });
      }
    }
  }
  return usages;
}

/**
 * 「このまま実行すると空文字に解決されてしまう」変数名を返す(＝実行をブロックすべきもの)。
 * - input : 入力値もデフォルト値も無い
 * - random: 抽選候補が1つも無い
 * - fixed : 固定値が空
 */
export function missingRequiredInputs(args: {
  names: string[];
  defs: VariableDefs;
  inputValues: VariableBindings;
}): string[] {
  const { names, defs, inputValues } = args;
  return names.filter((name) => {
    const def = getVariableDef(defs, name);
    if (def.mode === "random") {
      return (def.candidates ?? []).every((c) => !c.trim());
    }
    if (def.mode === "fixed") {
      return !def.value?.trim();
    }
    // input
    if (inputValues[name]?.trim()) return false;
    return !def.value?.trim();
  });
}

/** missingRequiredInputs で挙がった変数が「なぜ空になるか」の短い説明(UI 表示用)。 */
export function emptyReasonFor(def: VariableDef): string {
  if (def.mode === "random") return "候補未設定";
  if (def.mode === "fixed") return "固定値が空";
  return "未入力";
}

/**
 * 変数名リストを、定義・ユーザー入力値・乱数関数に従って具体値へ解決する。
 * - fixed : def.value ?? ""
 * - input : inputValues[name] があればそれ、無ければ def.value ?? ""
 * - random: candidates から rng で1つ抽選(候補が空なら "")
 */
export function resolveBindings(args: {
  names: string[];
  defs: VariableDefs;
  inputValues: VariableBindings;
  rng?: () => number;
}): VariableBindings {
  const { names, defs, inputValues, rng = Math.random } = args;
  const out: VariableBindings = {};
  for (const name of names) {
    const def = getVariableDef(defs, name);
    if (def.mode === "fixed") {
      out[name] = def.value ?? "";
    } else if (def.mode === "random") {
      const cands = (def.candidates ?? []).map((c) => c.trim()).filter(Boolean);
      out[name] = cands.length ? cands[Math.floor(rng() * cands.length)] : "";
    } else {
      const entered = inputValues[name];
      out[name] =
        entered != null && entered !== "" ? entered : (def.value ?? "");
    }
  }
  return out;
}

/**
 * テキスト中の `%%name%%` を bindings の値で置換する。bindings に無い変数は
 * そのまま残す(プレビューで未解決と分かるように)。置換で生じた空要素
 * (`, ,` / 行頭行末のカンマ) は軽く整形する。
 */
export function applyVariableBindings(
  text: string,
  bindings: VariableBindings,
): string {
  if (!text) return text;
  const replaced = text.replace(VAR_TOKEN, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(bindings, name)
      ? bindings[name]
      : whole,
  );
  return replaced
    .split("\n")
    .map((line) =>
      line
        .replace(/,\s*(?=,)/g, "")
        .replace(/(^|\n)\s*,\s*/g, "$1")
        .replace(/\s+,/g, ",")
        .replace(/,\s*$/g, "")
        .replace(/[ \t]{2,}/g, " ")
        .trimEnd(),
    )
    .join("\n");
}

/** 解決後プロンプトへ素朴な文字列置換を順に適用する(from が空の行は無視)。 */
export function applyPromptReplacements(
  text: string,
  replacements: PromptReplacement[] | undefined,
): string {
  if (!text || !replacements?.length) return text;
  let out = text;
  for (const { from, to } of replacements) {
    if (!from) continue;
    out = out.split(from).join(to);
  }
  return out;
}
