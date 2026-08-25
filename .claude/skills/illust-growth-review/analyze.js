#!/usr/bin/env node
/**
 * data/illust.json (Pixivの自作品一覧APIレスポンス) を集計し、
 * 成長分析・KPI予測に使う構造化メトリクスをJSONでstdoutへ出力する。
 * 数値計算のみを担当し、文章化・過去レビューとの比較・所感はSKILL.md側の責務。
 *
 * Usage: node analyze.js [--target=YYYY-MM-DD] [--input=data/illust.json]
 */

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round(n, d = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

const args = parseArgs(process.argv);
const inputPath = path.resolve(args.input || "data/illust.json");

if (!fs.existsSync(inputPath)) {
  console.error(`入力ファイルが見つかりません: ${inputPath}`);
  console.error("data/illust.json にPixivの自作品一覧APIレスポンス(JSON)を配置してください。");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const works = raw?.body?.data?.works;
if (!Array.isArray(works) || works.length === 0) {
  console.error("body.data.works が空、または想定した形式ではありません。");
  process.exit(1);
}

// pageCount等はbody.thumbnails.illustにのみ存在するため、workIdで結合する。
// 将来のエクスポート形式でthumbnailsが欠けていても、ページ数系メトリクスをnullにして落ちないようにする。
const thumbList = raw?.body?.thumbnails?.illust;
const thumbMap = new Map(Array.isArray(thumbList) ? thumbList.map((t) => [t.id, t]) : []);

const now = new Date();
for (const w of works) {
  w._createDateObj = new Date(w.createDate.replace(" ", "T") + "+09:00");
  w._ageDays = (now - w._createDateObj) / 86400000;
  const t = thumbMap.get(w.workId);
  w._pageCount = t ? t.pageCount : null;
}

const sortedByDate = [...works].sort((a, b) => a._createDateObj - b._createDateObj);
const firstPost = sortedByDate[0];
const lastPost = sortedByDate[sortedByDate.length - 1];
const totalSpanDays = Math.max((now - firstPost._createDateObj) / 86400000, 1);

// ---- 基本メトリクス ----
const bmArr = works.map((w) => w.bookmarkCount);
const vwArr = works.map((w) => w.viewCount);
const pageArr = works.map((w) => w._pageCount).filter((p) => p !== null && p !== undefined);

const basics = {
  snapshotDate: now.toISOString(),
  totalWorks: works.length,
  dateRange: { first: firstPost.createDate, last: lastPost.createDate, spanDays: round(totalSpanDays, 1) },
  bookmark: { sum: bmArr.reduce((a, b) => a + b, 0), avg: round(mean(bmArr)), median: median(bmArr), max: Math.max(...bmArr), min: Math.min(...bmArr) },
  view: { sum: vwArr.reduce((a, b) => a + b, 0), avg: round(mean(vwArr)), median: median(vwArr), max: Math.max(...vwArr), min: Math.min(...vwArr) },
  bookmarkRatePct: round((100 * bmArr.reduce((a, b) => a + b, 0)) / vwArr.reduce((a, b) => a + b, 0), 2),
  pageCount:
    pageArr.length > 0
      ? {
          avg: round(mean(pageArr)),
          median: median(pageArr),
          multiPageRatePct: round((100 * pageArr.filter((p) => p > 1).length) / pageArr.length, 1),
          missingJoinCount: works.length - pageArr.length,
        }
      : { note: "body.thumbnails.illust が無いためページ数メトリクスは算出不可" },
  neverRankedCount: works.filter((w) => !w.dailyRankingBestRank || w.dailyRankingBestRank === 0).length,
};

// ---- 投稿ペース(日次、複数ウィンドウ) ----
const cadenceWindows = [7, 14, 30, 60, 90];
const postsPerDay = {};
for (const win of cadenceWindows) {
  const n = works.filter((w) => w._ageDays < win).length;
  postsPerDay[`${win}d`] = round(n / win, 2);
}
postsPerDay.allTime = round(works.length / totalSpanDays, 2);

// ---- 成長曲線(年齢別プラトー・ランプ比率) ----
// 30〜250日を「成熟済み」とみなし中央値をプラトー値とする。250日超は個体差(初期コホート等)が
// 混ざるため除外。データ期間がまだ短い場合はnullにしてスキップする。
const MATURE_MIN_N = 20;
function buildCurve(valueKey) {
  const matureGrp = works.filter((w) => w._ageDays >= 30 && w._ageDays < 250);
  if (matureGrp.length < MATURE_MIN_N) return null;
  const plateau = median(matureGrp.map((w) => w[valueKey]));
  const rampBuckets = [
    [0, 3],
    [3, 7],
    [7, 14],
    [14, 30],
  ].map(([lo, hi]) => {
    const g = works.filter((w) => w._ageDays >= lo && w._ageDays < hi);
    const m = g.length > 0 ? median(g.map((w) => w[valueKey])) : null;
    return { ageRange: `${lo}-${hi}d`, n: g.length, median: m, ratio: m !== null ? round(m / plateau, 3) : null };
  });
  return { plateau, matureSampleSize: matureGrp.length, rampBuckets };
}

function rampRatio(curve, age) {
  if (!curve) return 1;
  if (age >= 30) return 1;
  const b = curve.rampBuckets.find((r) => age >= parseFloat(r.ageRange) && age < parseFloat(r.ageRange.split("-")[1]));
  if (b && b.ratio !== null) return b.ratio;
  // 該当バケットのサンプルが無い場合は直近の既知比率で代用
  const known = curve.rampBuckets.filter((r) => r.ratio !== null);
  return known.length ? known[0].ratio : 1;
}

const curveBM = buildCurve("bookmarkCount");
const curveVW = buildCurve("viewCount");

// ---- 月次コホート比較(生値 vs 成熟度調整後) ----
const byMonth = {};
for (const w of works) {
  const m = w.createDate.slice(0, 7);
  (byMonth[m] ||= { raw: [], adjBM: [], adjVW: [] });
  byMonth[m].raw.push(w.bookmarkCount);
  byMonth[m].adjBM.push(w.bookmarkCount / rampRatio(curveBM, w._ageDays));
  byMonth[m].adjVW.push(w.viewCount / rampRatio(curveVW, w._ageDays));
}
const monthlyCohorts = Object.keys(byMonth)
  .sort()
  .map((m) => ({
    month: m,
    n: byMonth[m].raw.length,
    rawMedianBM: median(byMonth[m].raw),
    maturityAdjMedianBM: round(median(byMonth[m].adjBM)),
    maturityAdjMedianVW: round(median(byMonth[m].adjVW)),
  }));

// ---- 目標日までのKPI予測 ----
let target = args.target ? new Date(`${args.target}T23:59:59+09:00`) : new Date(`${now.getFullYear()}-12-31T23:59:59+09:00`);
if (target <= now) target = new Date(`${target.getFullYear() + 1}-12-31T23:59:59+09:00`);
const daysToTarget = (target - now) / 86400000;

let projection = null;
if (curveBM && curveVW) {
  // 既存の未成熟作品(<30日)が満期まで育つ分の伸びしろ
  let extraBM = 0;
  let extraVW = 0;
  for (const w of works) {
    if (w._ageDays < 30) {
      extraBM += w.bookmarkCount / rampRatio(curveBM, w._ageDays) - w.bookmarkCount;
      extraVW += w.viewCount / rampRatio(curveVW, w._ageDays) - w.viewCount;
    }
  }

  const scenarios = {
    conservative: postsPerDay.allTime,
    mid: postsPerDay["30d"],
    aggressive: postsPerDay["14d"],
  };

  const avgFutureAge = daysToTarget / 2;
  const results = {};
  for (const [name, cadence] of Object.entries(scenarios)) {
    const futurePosts = cadence * daysToTarget;
    const futureBM = futurePosts * curveBM.plateau * rampRatio(curveBM, avgFutureAge);
    const futureVW = futurePosts * curveVW.plateau * rampRatio(curveVW, avgFutureAge);
    results[name] = {
      assumedPostsPerDay: cadence,
      projectedFutureWorks: Math.round(futurePosts),
      projectedTotalWorks: Math.round(works.length + futurePosts),
      projectedTotalBookmarks: Math.round(basics.bookmark.sum + extraBM + futureBM),
      projectedTotalViews: Math.round(basics.view.sum + extraVW + futureVW),
    };
  }

  projection = {
    targetDate: target.toISOString().slice(0, 10),
    daysToTarget: round(daysToTarget, 1),
    existingImmatureWorksExpectedGrowth: { bookmarks: Math.round(extraBM), views: Math.round(extraVW) },
    scenarios: results,
  };
} else {
  projection = { note: "成熟済み(30〜250日)サンプルが不足しているため予測はスキップ(データが増えたら次回以降で算出)" };
}

// ---- ハイライト ----
const top5 = [...works]
  .sort((a, b) => b.bookmarkCount - a.bookmarkCount)
  .slice(0, 5)
  .map((w) => ({ workId: w.workId, bookmarkCount: w.bookmarkCount, viewCount: w.viewCount, createDate: w.createDate }));

const output = {
  basics,
  postsPerDay,
  growthCurve: { bookmark: curveBM, view: curveVW },
  monthlyCohorts,
  projection,
  top5ByBookmark: top5,
};

console.log(JSON.stringify(output, null, 2));
