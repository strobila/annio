import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type AnnotationBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  imageId?: number;
};

type AnnotationImage = {
  id: number;
  file_name: string;
  width?: number;
  height?: number;
};

type DirectoryHandle = {
  name?: string;
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<DirectoryHandle>;
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<{ getFile: () => Promise<File> }>;
};

type AnnotationParseResult = {
  boxes: AnnotationBox[];
  format: string;
  warning?: string;
  images?: AnnotationImage[];
};

export default function App() {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const annotationInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [annotationName, setAnnotationName] = useState<string | null>(null);
  const [annotationContent, setAnnotationContent] = useState<string | null>(null);
  const [annotationError, setAnnotationError] = useState<string | null>(null);
  const [annotationBoxes, setAnnotationBoxes] = useState<AnnotationBox[]>([]);
  const [annotationFormat, setAnnotationFormat] = useState<string | null>(null);
  const [annotationWarning, setAnnotationWarning] = useState<string | null>(null);
  const [annotationSource, setAnnotationSource] = useState<
    "coco" | "coco-text" | "voc" | "yolo" | "simple" | null
  >(null);
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false);
  const [annotationItems, setAnnotationItems] = useState<AnnotationImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null);
  const [boxesByImageId, setBoxesByImageId] = useState<
    Map<number, AnnotationBox[]>
  >(() => new Map());
  const [imageMismatch, setImageMismatch] = useState<string | null>(null);
  const [imageRootHandle, setImageRootHandle] = useState<DirectoryHandle | null>(
    null
  );
  const [imageRootName, setImageRootName] = useState<string | null>(null);
  const [imageMetrics, setImageMetrics] = useState({
    naturalWidth: 0,
    naturalHeight: 0,
    displayWidth: 0,
    displayHeight: 0
  });

  const handleImageClick = () => imageInputRef.current?.click();
  const handleAnnotationClick = () => annotationInputRef.current?.click();
  const handleSelectRootFolder = async () => {
    setImageMismatch(null);
    const picker = (window as unknown as { showDirectoryPicker?: () => Promise<DirectoryHandle> })
      .showDirectoryPicker;
    if (!picker) {
      setImageMismatch("このブラウザはフォルダー選択に未対応です。");
      return;
    }
    try {
      const handle = await picker();
      setImageRootHandle(handle);
      setImageRootName(handle.name ?? "選択済み");
      if (selectedImageName) {
        const loaded = await tryLoadImageFromHandle(handle, selectedImageName);
        if (!loaded) {
          setImageMismatch(
            `画像の読み込みに失敗しました。パス: ${buildAttemptedPath(
              selectedImageName
            )}`
          );
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setImageMismatch("フォルダーの選択に失敗しました。");
    }
  };

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) {
      return;
    }

    const updateSize = () => {
      setImageMetrics((prev) => ({
        ...prev,
        displayWidth: image.clientWidth,
        displayHeight: image.clientHeight
      }));
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(image);
    return () => observer.disconnect();
  }, [imageUrl]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    const nextUrl = URL.createObjectURL(file);
    setImageUrl(nextUrl);
    setImageName(file.name);
    if (selectedImageName && getBaseName(selectedImageName) !== file.name) {
      setImageMismatch("選択中の画像名と一致しません。確認してください。");
    } else {
      setImageMismatch(null);
    }
    setImageMetrics({
      naturalWidth: 0,
      naturalHeight: 0,
      displayWidth: 0,
      displayHeight: 0
    });
  };

  const normalizePath = (value: string) => value.replace(/\\/g, "/");

  const buildAttemptedPath = (fileName: string) => {
    const rootLabel = imageRootName ?? "未選択";
    return `ルート: ${rootLabel} / 相対パス: ${normalizePath(fileName)}`;
  };

  const getBaseName = (value: string) => {
    const normalized = normalizePath(value);
    const parts = normalized.split("/");
    return parts[parts.length - 1] || normalized;
  };

  const loadImageFile = useCallback(
    (file: File) => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
      const nextUrl = URL.createObjectURL(file);
      setImageUrl(nextUrl);
      setImageName(file.name);
      setImageMetrics({
        naturalWidth: 0,
        naturalHeight: 0,
        displayWidth: 0,
        displayHeight: 0
      });
    },
    [imageUrl]
  );

  const tryLoadImageFromHandle = useCallback(
    async (rootHandle: DirectoryHandle, fileName: string) => {
      const normalized = normalizePath(fileName);
      const parts = normalized.split("/").filter(Boolean);
      if (parts.length === 0) {
        return false;
      }
      try {
        let dirHandle = rootHandle;
        for (let i = 0; i < parts.length - 1; i += 1) {
          dirHandle = await dirHandle.getDirectoryHandle(parts[i], {
            create: false
          });
        }
        const fileHandle = await dirHandle.getFileHandle(
          parts[parts.length - 1],
          { create: false }
        );
        const file = await fileHandle.getFile();
        loadImageFile(file);
        return true;
      } catch {
        return false;
      }
    },
    [loadImageFile]
  );

  const tryLoadImageFromRoot = useCallback(
    async (fileName: string) => {
      if (!imageRootHandle) {
        return false;
      }
      return tryLoadImageFromHandle(imageRootHandle, fileName);
    },
    [imageRootHandle, tryLoadImageFromHandle]
  );

  const getBoxCount = useCallback(
    (imageId: number) => boxesByImageId.get(imageId)?.length ?? 0,
    [boxesByImageId]
  );

  const handleImageLoad = () => {
    const image = imageRef.current;
    if (!image) {
      return;
    }
    setImageMetrics({
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      displayWidth: image.clientWidth,
      displayHeight: image.clientHeight
    });
  };

  const parseAnnotationBoxes = (data: unknown): AnnotationBox[] => {
    const normalize = (item: any, index: number): AnnotationBox | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const id = String(item.id ?? item.name ?? index + 1);
      if (Array.isArray(item.bbox) && item.bbox.length >= 4) {
        const [x, y, width, height] = item.bbox;
        return {
          id,
          x: Number(x),
          y: Number(y),
          width: Number(width),
          height: Number(height),
          label: item.label ?? item.category ?? item.text
        };
      }

      if (
        typeof item.x === "number" &&
        typeof item.y === "number" &&
        typeof item.width === "number" &&
        typeof item.height === "number"
      ) {
        return {
          id,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          label: item.label ?? item.category ?? item.text
        };
      }

      return null;
    };

    const extract = (items: unknown): AnnotationBox[] => {
      if (!Array.isArray(items)) {
        return [];
      }
      return items
        .map((item, index) => normalize(item, index))
        .filter((item): item is AnnotationBox => item !== null);
    };

    if (Array.isArray(data)) {
      return extract(data);
    }

    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      return (
        extract(record.boxes) ||
        extract(record.annotations) ||
        extract(record.objects)
      );
    }

    return [];
  };

  const parseCoco = (data: any): AnnotationParseResult => {
    const images = Array.isArray(data.images) ? data.images : [];
    const annotations = Array.isArray(data.annotations) ? data.annotations : [];
    const categories = Array.isArray(data.categories) ? data.categories : [];
    const categoryMap = new Map(
      categories
        .filter((cat: any) => cat && cat.id != null)
        .map((cat: any) => [cat.id, cat.name ?? String(cat.id)])
    );
    const boxes = annotations
      .map((ann: any, index: number) => {
        const bbox = Array.isArray(ann.bbox) ? ann.bbox : [0, 0, 0, 0];
        const label = categoryMap.get(ann.category_id) ?? ann.label;
        return {
          id: String(ann.id ?? index + 1),
          x: Number(bbox[0] ?? 0),
          y: Number(bbox[1] ?? 0),
          width: Number(bbox[2] ?? 0),
          height: Number(bbox[3] ?? 0),
          label,
          imageId: ann.image_id ?? undefined
        } satisfies AnnotationBox;
      });

    return { boxes, format: "COCO", images };
  };

  const parseCocoText = (data: any): AnnotationParseResult => {
    const images = Array.isArray(data.images) ? data.images : [];
    const annotations = Array.isArray(data.annotations) ? data.annotations : [];
    const boxes = annotations
      .map((ann: any, index: number) => {
        const bbox = Array.isArray(ann.bbox) ? ann.bbox : [0, 0, 0, 0];
        const transcription =
          ann.transcription ?? ann.utf8_string ?? ann.text ?? ann.label;
        return {
          id: String(ann.id ?? index + 1),
          x: Number(bbox[0] ?? 0),
          y: Number(bbox[1] ?? 0),
          width: Number(bbox[2] ?? 0),
          height: Number(bbox[3] ?? 0),
          label: transcription ? String(transcription) : undefined,
          imageId: ann.image_id ?? undefined
        } satisfies AnnotationBox;
      });

    return { boxes, format: "COCO-Text", images };
  };

  const parseVoc = (rawText: string): AnnotationParseResult => {
    const parser = new DOMParser();
    const xml = parser.parseFromString(rawText, "application/xml");
    const parserError = xml.querySelector("parsererror");
    if (parserError) {
      throw new Error("XMLの解析に失敗しました");
    }

    const fileName =
      xml.getElementsByTagName("filename")[0]?.textContent ?? "image.jpg";
    const width = Number(
      xml.getElementsByTagName("width")[0]?.textContent ?? 0
    );
    const height = Number(
      xml.getElementsByTagName("height")[0]?.textContent ?? 0
    );
    const imageId = 1;

    const objects = Array.from(xml.getElementsByTagName("object"));
    const boxes = objects
      .map((obj, index): AnnotationBox | null => {
        const name = obj.getElementsByTagName("name")[0]?.textContent ?? undefined;
        const bnd = obj.getElementsByTagName("bndbox")[0];
        if (!bnd) {
          return null;
        }
        const xmin = Number(bnd.getElementsByTagName("xmin")[0]?.textContent ?? 0);
        const ymin = Number(bnd.getElementsByTagName("ymin")[0]?.textContent ?? 0);
        const xmax = Number(bnd.getElementsByTagName("xmax")[0]?.textContent ?? 0);
        const ymax = Number(bnd.getElementsByTagName("ymax")[0]?.textContent ?? 0);
        const box: AnnotationBox = {
          id: String(index + 1),
          x: xmin,
          y: ymin,
          width: Math.max(0, xmax - xmin),
          height: Math.max(0, ymax - ymin),
          imageId
        };
        if (name) {
          box.label = name;
        }
        return box;
      })
      .filter((item): item is AnnotationBox => item !== null);

    return {
      boxes,
      format: "Pascal VOC",
      images: [{ id: imageId, file_name: fileName, width, height }]
    };
  };

  const parseYolo = (rawText: string): AnnotationParseResult => {
    if (!imageMetrics.naturalWidth || !imageMetrics.naturalHeight) {
      return {
        boxes: [],
        format: "YOLO",
        warning: "画像サイズ未取得のため描画できません"
      };
    }
    const imageId = 1;
    const lines = rawText.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const boxes = lines
      .map((line, index): AnnotationBox | null => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5) {
          return null;
        }
        const [classId, xCenter, yCenter, width, height] = parts.map(Number);
        const absWidth = width * imageMetrics.naturalWidth;
        const absHeight = height * imageMetrics.naturalHeight;
        const absX = xCenter * imageMetrics.naturalWidth - absWidth / 2;
        const absY = yCenter * imageMetrics.naturalHeight - absHeight / 2;
        const box: AnnotationBox = {
          id: String(index + 1),
          x: absX,
          y: absY,
          width: absWidth,
          height: absHeight,
          imageId
        };
        if (Number.isFinite(classId)) {
          box.label = `class_${classId}`;
        }
        return box;
      })
      .filter((item): item is AnnotationBox => item !== null);

    const fallbackName = imageName ?? "image.jpg";
    return {
      boxes,
      format: "YOLO",
      images: [{ id: imageId, file_name: fallbackName }]
    };
  };

  const handleAnnotationChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setAnnotationName(file.name);
    setAnnotationError(null);
    setAnnotationWarning(null);
    setImageMismatch(null);

    try {
      const rawText = await file.text();
      const lowerName = file.name.toLowerCase();
      const isJson = lowerName.endsWith(".json");
      const isXml = lowerName.endsWith(".xml");
      const isTxt = lowerName.endsWith(".txt");

      let parseResult: AnnotationParseResult | null = null;
      let parsed: unknown = null;

      if (isJson) {
        parsed = JSON.parse(rawText);
        if (parsed && typeof parsed === "object" && "annotations" in (parsed as any)) {
          const hasTextFields = Array.isArray((parsed as any).annotations)
            ? (parsed as any).annotations.some(
                (ann: any) =>
                  ann &&
                  ("transcription" in ann ||
                    "utf8_string" in ann ||
                    "text" in ann)
              )
            : false;
          if (hasTextFields) {
            parseResult = parseCocoText(parsed);
            setAnnotationSource("coco-text");
          } else {
            parseResult = parseCoco(parsed);
            setAnnotationSource("coco");
          }
        } else {
          parseResult = { boxes: parseAnnotationBoxes(parsed), format: "簡易JSON" };
          setAnnotationSource("simple");
        }
      } else if (isXml) {
        parseResult = parseVoc(rawText);
        setAnnotationSource("voc");
      } else if (isTxt) {
        parseResult = parseYolo(rawText);
        setAnnotationSource("yolo");
      }

      const formatted = isJson
        ? JSON.stringify(parsed, null, 2)
        : rawText;
      const previewLimit = 5000;
      const preview =
        formatted.length > previewLimit
          ? `${formatted.slice(0, previewLimit)}\n...`
          : formatted;
      setAnnotationContent(preview);
      if (parseResult) {
        const nextItems = parseResult.images ?? [];
        const grouped = new Map<number, AnnotationBox[]>();
        parseResult.boxes.forEach((box) => {
          const imageId = box.imageId ?? 0;
          if (!grouped.has(imageId)) {
            grouped.set(imageId, []);
          }
          grouped.get(imageId)?.push(box);
        });

        setAnnotationItems(nextItems);
        setBoxesByImageId(grouped);
        setAnnotationFormat(parseResult.format);
        setAnnotationWarning(parseResult.warning ?? null);

        if (nextItems.length > 0) {
          const first = nextItems[0];
          setSelectedImageId(first.id);
          setSelectedImageName(first.file_name);
          setAnnotationBoxes(grouped.get(first.id) ?? []);
          if (imageRootHandle) {
            const loaded = await tryLoadImageFromRoot(first.file_name);
            if (!loaded) {
              setImageMismatch(
                `画像の読み込みに失敗しました。パス: ${buildAttemptedPath(
                  first.file_name
                )}`
              );
            }
          } else if (imageName && getBaseName(first.file_name) !== imageName) {
            setImageMismatch("画像が未選択です。該当画像を読み込んでください。");
          }
        } else {
          setSelectedImageId(null);
          setSelectedImageName(null);
          setAnnotationBoxes(parseResult.boxes);
        }
      } else {
        setAnnotationBoxes([]);
        setAnnotationFormat("未対応");
        setAnnotationSource(null);
        setAnnotationItems([]);
        setBoxesByImageId(new Map());
        setSelectedImageId(null);
        setSelectedImageName(null);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "読み込みに失敗しました";
      setAnnotationError(message);
      setAnnotationContent(null);
      setAnnotationBoxes([]);
      setAnnotationFormat(null);
      setAnnotationSource(null);
      setAnnotationItems([]);
      setBoxesByImageId(new Map());
      setSelectedImageId(null);
      setSelectedImageName(null);
    }
  };

  const handleSelectImageItem = async (item: AnnotationImage) => {
    setSelectedImageId(item.id);
    setSelectedImageName(item.file_name);
    setAnnotationBoxes(boxesByImageId.get(item.id) ?? []);
    if (imageRootHandle) {
      const loaded = await tryLoadImageFromRoot(item.file_name);
      if (!loaded) {
        setImageMismatch(
          `画像の読み込みに失敗しました。パス: ${buildAttemptedPath(
            item.file_name
          )}`
        );
      } else {
        setImageMismatch(null);
      }
      return;
    }
    if (!imageName) {
      setImageMismatch("画像が未選択です。該当画像を読み込んでください。");
      return;
    }
    if (getBaseName(item.file_name) !== imageName) {
      setImageMismatch("選択中の画像名と一致しません。確認してください。");
    } else {
      setImageMismatch(null);
    }
  };

  const handleSaveAnnotations = () => {
    if (!imageName || annotationBoxes.length === 0) {
      return;
    }

    const imageId = 1;
    const payload = {
      images: [
        {
          id: imageId,
          file_name: imageName,
          width: imageMetrics.naturalWidth || undefined,
          height: imageMetrics.naturalHeight || undefined
        }
      ],
      annotations: annotationBoxes.map((box, index) => ({
        id: index + 1,
        image_id: imageId,
        bbox: [box.x, box.y, box.width, box.height],
        transcription: box.label ?? ""
      }))
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = imageName.replace(/\.[^/.]+$/, "") + "_coco-text.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const hasAnnotations = annotationBoxes.length > 0;
  const svgSize = useMemo(() => {
    if (!imageMetrics.displayWidth || !imageMetrics.displayHeight) {
      return null;
    }
    return {
      width: imageMetrics.displayWidth,
      height: imageMetrics.displayHeight
    };
  }, [imageMetrics.displayWidth, imageMetrics.displayHeight]);

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar__group">
          <button className="btn" type="button" onClick={handleImageClick}>
            画像読み込み
          </button>
          <input
            ref={imageInputRef}
            className="file-input"
            type="file"
            accept="image/*"
            aria-label="画像ファイルを選択"
            onChange={handleImageChange}
          />

          <button className="btn" type="button" onClick={handleAnnotationClick}>
            アノテーション読込
          </button>
          <input
            ref={annotationInputRef}
            className="file-input"
            type="file"
            accept=".json,.xml,.txt,.csv"
            aria-label="アノテーションデータを選択"
            onChange={(event) => void handleAnnotationChange(event)}
          />

          <button className="btn" type="button" onClick={handleSelectRootFolder}>
            画像ルートフォルダー選択
          </button>
          {imageRootName && (
            <span className="hint">選択中: {imageRootName}</span>
          )}
        </div>

        <div className="toolbar__group">
          <button
            className="btn btn--primary"
            type="button"
            onClick={handleSaveAnnotations}
            disabled={annotationBoxes.length === 0 || !imageName}
          >
            アノテーション保存
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => setShowAnnotationPanel((prev) => !prev)}
          >
            JSON表示: {showAnnotationPanel ? "ON" : "OFF"}
          </button>
          <span className="hint">※保存は作成・編集モードのみ</span>
        </div>
      </header>

      <main className="layout">
        <aside className="sidebar">
          <div className="sidebar__header">アノテーション一覧</div>
          {annotationItems.length === 0 ? (
            <div className="sidebar__empty">データ未読込</div>
          ) : (
            <ul className="sidebar__list">
              {annotationItems.map((item, index) => {
                const isActive = item.id === selectedImageId;
                return (
                  <li key={item.id}>
                    <button
                      className={`sidebar__item${isActive ? " is-active" : ""}`}
                      type="button"
                      onClick={() => void handleSelectImageItem(item)}
                    >
                      <span className="sidebar__index">{index + 1}</span>
                      <span className="sidebar__name">
                        {getBaseName(item.file_name)}
                      </span>
                      <span className="sidebar__count">
                        {getBoxCount(item.id)} 件
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <div className="canvas-area">
          <div className="canvas">
            {imageUrl ? (
              <div className="canvas__media">
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt={imageName ?? "選択した画像"}
                  onLoad={handleImageLoad}
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
                    <button
                      className="btn btn--ghost"
                      type="button"
                      onClick={handleImageClick}
                    >
                      画像ファイルを選択
                    </button>
                  </div>
                )}
              </div>
            )}
            {imageMismatch && (
              <div className="canvas__warning">{imageMismatch}</div>
            )}
            {showAnnotationPanel &&
              annotationName &&
              (annotationContent || annotationError) && (
              <aside className="annotation-panel">
                <div className="annotation-panel__header">
                  <span>アノテーション</span>
                  <span className="annotation-panel__name">{annotationName}</span>
                </div>
                {annotationFormat && (
                  <div className="annotation-panel__meta">
                    形式: {annotationFormat}
                  </div>
                )}
                {annotationWarning && (
                  <div className="annotation-panel__warning">
                    {annotationWarning}
                  </div>
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
      </main>
    </div>
  );
}
