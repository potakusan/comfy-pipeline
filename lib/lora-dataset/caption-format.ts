import type { DanbooruPostTags, DatasetImageManifest, DatasetMeta, TagCategory } from "./types";

/**
 * Danbooruの顔文字系タグはアンダースコアが記号の一部であり、スペースに
 * 変換すると意味が壊れるため除外する（WD14/DeepDanbooruタガーも同様の
 * 例外リストを持つ、booruタグ学習での一般的な慣習）。
 */
const UNDERSCORE_EXCEPTIONS = new Set([
  "0_0",
  ">_<",
  "^_^",
  "+_+",
  "-_-",
  "|_|",
  "._.",
  ";_;",
  "=_=",
  "@_@",
]);

/**
 * "long_hair" -> "long hair", "dress_(medium)" -> "dress \(medium\)"
 * 既にformatTag済みの文字列（候補タグ一覧のクリック等）を渡しても二重エスケープしないよう、
 * 直前がバックスラッシュでない括弧だけをエスケープする（冪等）。
 */
export function formatTag(rawTag: string): string {
  const tag = UNDERSCORE_EXCEPTIONS.has(rawTag) ? rawTag : rawTag.replace(/_/g, " ");
  return tag.replace(/(?<!\\)\(/g, "\\(").replace(/(?<!\\)\)/g, "\\)");
}

const CATEGORY_ORDER: TagCategory[] = ["general", "character", "copyright", "artist", "meta"];

function filteredBaseTags(tags: DanbooruPostTags, includeCategories: TagCategory[]): string[] {
  const result: string[] = [];
  for (const category of CATEGORY_ORDER) {
    if (!includeCategories.includes(category)) continue;
    for (const tag of tags[category]) result.push(formatTag(tag));
  }
  return result;
}

/**
 * 同じタグがremovedTags/extraTags両方に入る矛盾状態を解消する。「削除済みの
 * タグを再度追加」した場合はextraTagsへの追加ではなくremovedTagsからの
 * 除去として扱うべきなので、PATCH受信時・保存前に必ずこれを通す。
 */
export function reconcileTagLists(
  removedTags: string[],
  extraTags: string[],
): { removedTags: string[]; extraTags: string[] } {
  const extraSet = new Set(extraTags);
  return {
    removedTags: removedTags.filter((t) => !extraSet.has(t)),
    extraTags: [...extraSet],
  };
}

/** 適用順序: includeCategoriesでカテゴリフィルタ → removedTagsを除外 → extraTagsを追加（重複除去）。トリガーワードは含まない。 */
export function captionTags(dataset: DatasetMeta, manifest: DatasetImageManifest): string[] {
  const base = filteredBaseTags(manifest.tags, dataset.includeCategories);
  const removedSet = new Set(manifest.removedTags);
  const kept = base.filter((tag) => !removedSet.has(tag));
  return [...new Set([...kept, ...manifest.extraTags])];
}

/**
 * トリガーワードも他のタグと同じformatTagを通す（アンダースコア→スペース等）。
 * Danbooruのcharacterタグ（includeCategoriesに含めている場合）とトリガーワードが
 * 同じキャラクターを指す同一トークンになるケースが多く、整形前は「foo_bar」と
 * 「foo bar」で表記だけ違う重複タグとして両方キャプションに残ってしまっていた
 * （学習信号が2トークンに分散し、収束を弱める）。整形後に一致するなら重複させない。
 */
export function buildCaption(dataset: DatasetMeta, manifest: DatasetImageManifest): string {
  const trigger = formatTag(dataset.triggerWord.trim());
  const tags = captionTags(dataset, manifest);
  const combined = trigger && !tags.includes(trigger) ? [trigger, ...tags] : tags;
  return combined.filter(Boolean).join(", ");
}
