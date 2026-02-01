import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { AnnotationBox } from "../types";

type CanvasAreaProps = {
  imageUrl: string | null;
  imageName: string | null;
  imageRef: RefObject<HTMLImageElement>;
  onImageLoad: () => void;
  annotationBoxes: AnnotationBox[];
  hasAnnotations: boolean;
  svgSize: { width: number; height: number } | null;
  imageMetrics: { naturalWidth: number; naturalHeight: number };
  mode: "view" | "edit";
  onUpdateBoxes: (nextBoxes: AnnotationBox[]) => void;
  annotationName: string | null;
  showAnnotationPanel: boolean;
  annotationContent: string | null;
  annotationError: string | null;
  annotationFormat: string | null;
  annotationWarning: string | null;
  imageMismatch: string | null;
  selectedImageName: string | null;
  onImageClick: () => void;
};

export default function CanvasArea({
  imageUrl,
  imageName,
  imageRef,
  onImageLoad,
  annotationBoxes,
  hasAnnotations,
  svgSize,
  imageMetrics,
  mode,
  onUpdateBoxes,
  annotationName,
  showAnnotationPanel,
  annotationContent,
  annotationError,
  annotationFormat,
  annotationWarning,
  imageMismatch,
  selectedImageName,
  onImageClick
}: CanvasAreaProps) {
  const [zoom, setZoom] = useState(1);
  const mediaRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<
    | {
        id: string;
        start: { x: number; y: number };
        origin: { x: number; y: number };
        originSize?: { width: number; height: number };
        mode: "move" | "resize";
        handle?: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
      }
    | null
  >(null);

  useEffect(() => {
    setZoom(1);
  }, [imageUrl]);

  useEffect(() => {
    setDragging(null);
  }, [imageUrl]);

  useEffect(() => {
    const target = mediaRef.current;
    if (!target) {
      return;
    }

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) {
        return;
      }
      if (!target.contains(event.target as Node)) {
        return;
      }
      event.preventDefault();
      const direction = event.deltaY > 0 ? 0.9 : 1.1;
      setZoom((prev) => Math.min(5, Math.max(0.2, prev * direction)));
    };

    target.addEventListener("wheel", onWheel, { passive: false });
    return () => target.removeEventListener("wheel", onWheel);
  }, []);

  const getImagePoint = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const frame = frameRef.current;
      if (!frame || !imageMetrics.naturalWidth || !imageMetrics.naturalHeight) {
        return null;
      }
      const rect = frame.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return null;
      }
      const x = ((event.clientX - rect.left) / rect.width) * imageMetrics.naturalWidth;
      const y = ((event.clientY - rect.top) / rect.height) * imageMetrics.naturalHeight;
      return { x, y };
    },
    [imageMetrics.naturalHeight, imageMetrics.naturalWidth]
  );

  const handleBoxPointerDown = useCallback(
    (event: React.PointerEvent<SVGRectElement>, box: AnnotationBox) => {
      if (mode !== "edit") {
        return;
      }
      const point = getImagePoint(event);
      if (!point) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging({
        id: box.id,
        start: point,
        origin: { x: box.x, y: box.y },
        originSize: { width: box.width, height: box.height },
        mode: "move"
      });
    },
    [getImagePoint, mode]
  );

  const handleResizePointerDown = useCallback(
    (
      event: React.PointerEvent<SVGCircleElement>,
      box: AnnotationBox,
      handle: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"
    ) => {
      if (mode !== "edit") {
        return;
      }
      const point = getImagePoint(event);
      if (!point) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging({
        id: box.id,
        start: point,
        origin: { x: box.x, y: box.y },
        originSize: { width: box.width, height: box.height },
        mode: "resize",
        handle
      });
    },
    [getImagePoint, mode]
  );

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const point = getImagePoint(event);
      if (!point) {
        return;
      }
      const deltaX = point.x - dragging.start.x;
      const deltaY = point.y - dragging.start.y;
      const nextBoxes = annotationBoxes.map((box) => {
        if (box.id !== dragging.id) {
          return box;
        }
        if (dragging.mode === "move") {
          return {
            ...box,
            x: dragging.origin.x + deltaX,
            y: dragging.origin.y + deltaY
          };
        }
        const originSize = dragging.originSize ?? { width: box.width, height: box.height };
        let nextX = dragging.origin.x;
        let nextY = dragging.origin.y;
        let nextWidth = originSize.width;
        let nextHeight = originSize.height;
        const handle = dragging.handle;
        if (!handle) {
          return box;
        }
        if (handle.includes("e")) {
          nextWidth = originSize.width + deltaX;
        }
        if (handle.includes("w")) {
          nextX = dragging.origin.x + deltaX;
          nextWidth = originSize.width - deltaX;
        }
        if (handle.includes("s")) {
          nextHeight = originSize.height + deltaY;
        }
        if (handle.includes("n")) {
          nextY = dragging.origin.y + deltaY;
          nextHeight = originSize.height - deltaY;
        }
        const minSize = 8;
        if (nextWidth < minSize) {
          if (handle.includes("w")) {
            nextX = dragging.origin.x + (originSize.width - minSize);
          }
          nextWidth = minSize;
        }
        if (nextHeight < minSize) {
          if (handle.includes("n")) {
            nextY = dragging.origin.y + (originSize.height - minSize);
          }
          nextHeight = minSize;
        }
        return {
          ...box,
          x: nextX,
          y: nextY,
          width: nextWidth,
          height: nextHeight
        };
      });
      onUpdateBoxes(nextBoxes);
    };

    const handlePointerUp = () => {
      setDragging(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [annotationBoxes, dragging, getImagePoint, onUpdateBoxes]);

  return (
    <div className="canvas-area">
      <div className="canvas">
        {imageUrl ? (
          <div className="canvas__media" ref={mediaRef}>
            <div
              className="canvas__frame"
              style={{ transform: `scale(${zoom})` }}
              ref={frameRef}
            >
              <img
                ref={imageRef}
                src={imageUrl}
                alt={imageName ?? "選択した画像"}
                onLoad={onImageLoad}
                draggable={false}
              />
              {svgSize && hasAnnotations && imageMetrics.naturalWidth > 0 && (
                <svg
                  className={`annotation-overlay${mode === "edit" ? " is-edit" : ""}`}
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${imageMetrics.naturalWidth} ${imageMetrics.naturalHeight}`}
                  preserveAspectRatio="none"
                >
                  {annotationBoxes.map((box) => (
                    <g key={box.id}>
                      <rect
                        x={box.x}
                        y={box.y}
                        width={box.width}
                        height={box.height}
                        className="annotation-overlay__box"
                        onPointerDown={(event) =>
                          handleBoxPointerDown(event, box)
                        }
                      />
                      {mode === "edit" && (
                        <g className="annotation-overlay__handles">
                          <circle
                            cx={box.x}
                            cy={box.y}
                            r={2.5}
                            className="annotation-overlay__handle annotation-overlay__handle--nw"
                            onPointerDown={(event) =>
                              handleResizePointerDown(event, box, "nw")
                            }
                          />
                          <circle
                            cx={box.x + box.width / 2}
                            cy={box.y}
                            r={2.5}
                            className="annotation-overlay__handle annotation-overlay__handle--n"
                            onPointerDown={(event) =>
                              handleResizePointerDown(event, box, "n")
                            }
                          />
                          <circle
                            cx={box.x + box.width}
                            cy={box.y}
                            r={2.5}
                            className="annotation-overlay__handle annotation-overlay__handle--ne"
                            onPointerDown={(event) =>
                              handleResizePointerDown(event, box, "ne")
                            }
                          />
                          <circle
                            cx={box.x}
                            cy={box.y + box.height / 2}
                            r={2.5}
                            className="annotation-overlay__handle annotation-overlay__handle--w"
                            onPointerDown={(event) =>
                              handleResizePointerDown(event, box, "w")
                            }
                          />
                          <circle
                            cx={box.x + box.width}
                            cy={box.y + box.height / 2}
                            r={2.5}
                            className="annotation-overlay__handle annotation-overlay__handle--e"
                            onPointerDown={(event) =>
                              handleResizePointerDown(event, box, "e")
                            }
                          />
                          <circle
                            cx={box.x}
                            cy={box.y + box.height}
                            r={2.5}
                            className="annotation-overlay__handle annotation-overlay__handle--sw"
                            onPointerDown={(event) =>
                              handleResizePointerDown(event, box, "sw")
                            }
                          />
                          <circle
                            cx={box.x + box.width / 2}
                            cy={box.y + box.height}
                            r={2.5}
                            className="annotation-overlay__handle annotation-overlay__handle--s"
                            onPointerDown={(event) =>
                              handleResizePointerDown(event, box, "s")
                            }
                          />
                          <circle
                            cx={box.x + box.width}
                            cy={box.y + box.height}
                            r={2.5}
                            className="annotation-overlay__handle annotation-overlay__handle--se"
                            onPointerDown={(event) =>
                              handleResizePointerDown(event, box, "se")
                            }
                          />
                        </g>
                      )}
                      {box.label && (
                        <text
                          x={box.x + 6}
                          y={box.y - 6}
                          className="annotation-overlay__label"
                        >
                          {box.label}
                        </text>
                      )}
                    </g>
                  ))}
                </svg>
              )}
            </div>
            {imageName && <div className="canvas__caption">{imageName}</div>}
            {!hasAnnotations && annotationName && (
              <div className="canvas__badge">アノテーション未解析</div>
            )}
          </div>
        ) : (
          <div className="canvas__placeholder">
            <div>画像とアノテーションをここに表示</div>
            {selectedImageName && (
              <div className="canvas__hint">
                選択中: {selectedImageName}
                <button className="btn btn--ghost" type="button" onClick={onImageClick}>
                  画像ファイルを選択
                </button>
              </div>
            )}
          </div>
        )}
        {imageMismatch && <div className="canvas__warning">{imageMismatch}</div>}
        {showAnnotationPanel &&
          annotationName &&
          (annotationContent || annotationError) && (
            <aside className="annotation-panel">
              <div className="annotation-panel__header">
                <span>アノテーション</span>
                <span className="annotation-panel__name">{annotationName}</span>
              </div>
              {annotationFormat && (
                <div className="annotation-panel__meta">形式: {annotationFormat}</div>
              )}
              {annotationWarning && (
                <div className="annotation-panel__warning">{annotationWarning}</div>
              )}
              {annotationError ? (
                <div className="annotation-panel__error">
                  読み込みエラー: {annotationError}
                </div>
              ) : (
                <pre className="annotation-panel__content">
                  {annotationContent}
                </pre>
              )}
            </aside>
          )}
      </div>
    </div>
  );
}
