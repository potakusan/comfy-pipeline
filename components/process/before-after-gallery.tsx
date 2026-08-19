import { ArrowRight } from "lucide-react";
import { thumbUrl, toMosaicFilename } from "@/components/process/process-helpers";

export default function BeforeAfterGallery({
  folder,
  processedImages,
  hasMosaic,
  hasResize,
  cacheBust,
}: {
  folder: string;
  processedImages: string[];
  hasMosaic: boolean;
  hasResize: boolean;
  cacheBust: number;
}) {
  if (processedImages.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        処理結果 ({processedImages.length}枚)
      </p>
      <div className="space-y-2">
        {processedImages.map((filename) => {
          const beforePath = `${folder}/${filename}`;
          const afterPath = hasMosaic
            ? `${folder}/mosaic/${toMosaicFilename(filename)}`
            : hasResize
              ? `${folder}/resized/${filename}`
              : null;
          return (
            <div
              key={filename}
              className="flex items-center gap-2 rounded-lg border bg-card/20 p-2"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate font-mono text-[10px] text-muted-foreground mb-1.5 px-0.5">
                  {filename}
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="mb-1 text-[10px] text-muted-foreground">
                      処理前
                    </p>

                    <img
                      src={thumbUrl(beforePath)}
                      alt={`before ${filename}`}
                      className="w-full rounded object-cover aspect-[4/3]"
                      loading="lazy"
                    />
                  </div>
                  {afterPath && (
                    <>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />

                      <div className="flex-1 min-w-0">
                        <p className="mb-1 text-[10px] text-muted-foreground">
                          処理後
                        </p>

                        <img
                          src={`${thumbUrl(afterPath)}&v=${cacheBust}`}
                          alt={`after ${filename}`}
                          className="w-full rounded object-cover aspect-[4/3]"
                          loading="lazy"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
