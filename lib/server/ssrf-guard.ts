import dns from "dns/promises";

/**
 * URLがhttp/httpsかつ、解決先が全て公開IPであることを検証する。
 * ホスト名ではなく実際にDNS解決されたIPを検査することで、内部ホストを指す
 * ドメイン名を使ったSSRF（クラウドメタデータエンドポイント169.254.169.254等への
 * リクエスト強制）を防ぐ。問題なければnull、問題があればエラーメッセージを返す。
 */
export async function assertPublicHttpUrl(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "不正なURLです";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "http/httpsのURLを指定してください";
  }

  let addresses: string[];
  try {
    addresses = (await dns.lookup(parsed.hostname, { all: true })).map((r) => r.address);
  } catch {
    return "ホスト名を解決できませんでした";
  }
  if (addresses.length === 0 || addresses.some((addr) => !isPublicAddress(addr))) {
    return "内部ネットワークを指すURLは指定できません";
  }
  return null;
}

function isPublicAddress(address: string): boolean {
  return address.includes(":") ? isPublicIPv6(address) : isPublicIPv4(address);
}

function isPublicIPv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 0) return false; // 0.0.0.0/8
  if (a === 10) return false; // 10.0.0.0/8 プライベート
  if (a === 127) return false; // 127.0.0.0/8 ループバック
  if (a === 100 && b >= 64 && b <= 127) return false; // 100.64.0.0/10 CGNAT
  if (a === 169 && b === 254) return false; // 169.254.0.0/16 リンクローカル・クラウドメタデータ
  if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12 プライベート
  if (a === 192 && b === 168) return false; // 192.168.0.0/16 プライベート
  if (a === 192 && b === 0 && parts[2] === 0) return false; // 192.0.0.0/24 IETFプロトコル用
  if (a === 198 && (b === 18 || b === 19)) return false; // 198.18.0.0/15 ベンチマーク用
  if (a >= 224) return false; // マルチキャスト・予約領域
  return true;
}

function isPublicIPv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::") return false; // ループバック・未指定
  if (/^fe[89ab]/.test(normalized)) return false; // fe80::/10 リンクローカル
  if (/^f[cd]/.test(normalized)) return false; // fc00::/7 ユニークローカル
  if (normalized.startsWith("::ffff:")) return isPublicIPv4(normalized.slice("::ffff:".length));
  return true;
}
