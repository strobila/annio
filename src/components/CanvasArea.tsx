import type { RefObject } from "react";
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
  return (
    <div className="canvas-area">
      <div className="canvas">
        {imageUrl ? (
          <div className="canvas__media">
            <img
              ref={imageRef}
              src={imageUrl}
              alt={imageName ?? "選択した画像"}
              onLoad={onImageLoad}
            />
            {svgSize && hasAnnotations && imageMetrics.naturalWidth > 0 && (
              <svg
                className="annotation-overlay"
                width={svgSize.width}
                height={svgSize.height}
                viewBox={`0 0 ${imageMetrics.naturalWidth} ${imageMetrics.naturalHeight}`}
                preserveAspectRatio="none"
              >
                {annotationBoxes.map((box) => (
                  <g key={`${box.id}-${box.x}-${box.y}`}>
                    <rect
                      x={box.x}
                      y={box.y}
                      width={box.width}
                      height={box.height}
                      rx={6}
                      className="annotation-overlay__box"
                    />
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
