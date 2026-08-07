"use client";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { GripHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import type { FloatingWindowPos } from "@/lib/gallery";

type ResizeEdge = "e" | "s" | "se" | "sw" | "w" | null;

/**
 * Generic draggable / resizable / collapsible floating window, modeled on
 * the main generation page's FloatingPromptPreview (app/_home.tsx), with
 * title/icon/body supplied by the caller so it can host arbitrary content.
 */
export default function FloatingWindow({
  title,
  icon,
  pos,
  onPosChange,
  defaultWidth = 380,
  defaultHeight = 260,
  minWidth = 240,
  minHeight = 140,
  initialPlacement = "bottom-right",
  children,
}: {
  title: string;
  icon?: ReactNode;
  pos: FloatingWindowPos;
  onPosChange: (p: FloatingWindowPos) => void;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  /** Where to place the window the very first time (before any saved position exists). */
  initialPlacement?: "bottom-right" | "center";
  children: ReactNode;
}) {
  const [position, setPosition] = useState({ x: pos.x, y: pos.y });
  const [size, setSize] = useState({ w: pos.width ?? defaultWidth, h: pos.height ?? defaultHeight });
  const [collapsed, setCollapsed] = useState(pos.collapsed);

  const dragging = useRef(false);
  const didDrag = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizing = useRef<ResizeEdge>(null);
  const resizeStart = useRef({ mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 });

  const posLoadedRef = useRef(false);
  useEffect(() => {
    if (posLoadedRef.current) return;
    if (pos.x === -1 || pos.y === -1) {
      const x =
        initialPlacement === "center"
          ? Math.max(10, (window.innerWidth - size.w) / 2)
          : Math.max(10, window.innerWidth - size.w - 20);
      const y =
        initialPlacement === "center"
          ? Math.max(10, (window.innerHeight - size.h) / 2)
          : Math.max(10, window.innerHeight - size.h - 20);
      posLoadedRef.current = true;
      setPosition({ x, y });
      onPosChange({ x, y, collapsed: false, width: size.w, height: size.h });
    } else {
      posLoadedRef.current = true;
      setPosition({ x: pos.x, y: pos.y });
      setSize({ w: pos.width ?? defaultWidth, h: pos.height ?? defaultHeight });
      setCollapsed(pos.collapsed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.x, pos.y]);

  const handleTitlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    didDrag.current = false;
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>, edge: ResizeEdge) => {
    e.stopPropagation();
    resizing.current = edge;
    resizeStart.current = { mx: e.clientX, my: e.clientY, x: position.x, y: position.y, w: size.w, h: size.h };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (resizing.current) {
      const dx = e.clientX - resizeStart.current.mx;
      const dy = e.clientY - resizeStart.current.my;
      const edge = resizing.current;
      const { y } = resizeStart.current;
      let { x, w, h } = resizeStart.current;
      if (edge === "e" || edge === "se") w = Math.max(minWidth, w + dx);
      if (edge === "w" || edge === "sw") {
        const newW = Math.max(minWidth, w - dx);
        x = x + (w - newW);
        w = newW;
      }
      if (edge === "s" || edge === "se" || edge === "sw") h = Math.max(minHeight, h + dy);
      setSize({ w, h });
      setPosition({ x, y });
      return;
    }
    if (dragging.current) {
      didDrag.current = true;
      const x = Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 50));
      const y = Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 40));
      setPosition({ x, y });
    }
  };

  const handlePointerUp = () => {
    if (resizing.current) {
      resizing.current = null;
      onPosChange({ ...position, collapsed, width: size.w, height: size.h });
      return;
    }
    if (dragging.current) {
      dragging.current = false;
      onPosChange({ ...position, collapsed, width: size.w, height: size.h });
    }
  };

  const handleTitleClick = () => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    onPosChange({ ...position, collapsed: newCollapsed, width: size.w, height: size.h });
  };

  const displayX = position.x === -1 ? 10 : position.x;
  const displayY = position.y === -1 ? 100 : position.y;

  return (
    <div
      className="fixed z-50 overflow-hidden rounded-lg border bg-background shadow-lg"
      style={{ left: displayX, top: displayY, width: size.w, height: collapsed ? undefined : size.h }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="flex cursor-grab items-center gap-2 px-3 py-1.5 select-none hover:bg-muted/30 active:cursor-grabbing"
        onPointerDown={handleTitlePointerDown}
        onClick={handleTitleClick}
      >
        <GripHorizontal className="h-3 w-3 shrink-0 text-muted-foreground" />
        {icon}
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          {title}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {collapsed ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="min-h-0 overflow-y-auto border-t" style={{ height: size.h - 32 }}>
          {children}
        </div>
      )}

      {!collapsed && (
        <>
          <div
            className="absolute top-6 right-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/20"
            onPointerDown={(e) => handleResizePointerDown(e, "e")}
          />
          <div
            className="absolute top-6 bottom-0 left-0 w-1.5 cursor-ew-resize hover:bg-primary/20"
            onPointerDown={(e) => handleResizePointerDown(e, "w")}
          />
          <div
            className="absolute right-6 bottom-0 left-6 h-1.5 cursor-ns-resize hover:bg-primary/20"
            onPointerDown={(e) => handleResizePointerDown(e, "s")}
          />
          <div
            className="absolute right-0 bottom-0 h-3 w-3 cursor-nwse-resize hover:bg-primary/30"
            onPointerDown={(e) => handleResizePointerDown(e, "se")}
          />
          <div
            className="absolute bottom-0 left-0 h-3 w-3 cursor-nesw-resize hover:bg-primary/30"
            onPointerDown={(e) => handleResizePointerDown(e, "sw")}
          />
        </>
      )}
    </div>
  );
}
