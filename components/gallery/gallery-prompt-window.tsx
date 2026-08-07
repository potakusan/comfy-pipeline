"use client";
import type { ReactNode } from "react";
import { Eye } from "lucide-react";
import FloatingWindow from "@/components/gallery/floating-window";
import type { FloatingWindowPos } from "@/lib/gallery";

export default function GalleryPromptWindow({
  pos,
  onPosChange,
  children,
}: {
  pos: FloatingWindowPos;
  onPosChange: (p: FloatingWindowPos) => void;
  children: ReactNode;
}) {
  return (
    <FloatingWindow
      title="プロンプト"
      icon={<Eye className="h-3 w-3 text-muted-foreground" />}
      pos={pos}
      onPosChange={onPosChange}
      defaultWidth={380}
      defaultHeight={260}
    >
      {children}
    </FloatingWindow>
  );
}
