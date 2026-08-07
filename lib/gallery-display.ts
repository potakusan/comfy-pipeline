import type { GalleryImage } from "./comfy";

export function imageUrl(img: GalleryImage) {
  return `/api/comfy/output/image?path=${encodeURIComponent(img.path)}`;
}

export function thumbUrl(img: GalleryImage) {
  return `/api/comfy/output/thumbnail?path=${encodeURIComponent(img.path)}`;
}

export function loraShortName(loraName: string) {
  if (!loraName || loraName === "no-lora") return "固定のみ";
  return (
    loraName.split("/").pop()?.replace(".safetensors", "").substring(0, 24) ??
    loraName
  );
}

export function getFolder(path: string) {
  const parts = path.split("/");
  return parts.length > 1 ? parts[0] : "(root)";
}

export function downloadImageMeta(img: GalleryImage) {
  const blob = new Blob([JSON.stringify(img, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stem =
    img.path
      .split("/")
      .pop()
      ?.replace(/\.[^.]+$/, "") ?? "image";
  a.download = `${stem}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
