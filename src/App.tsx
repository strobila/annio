import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CanvasArea from "./components/CanvasArea";
import Sidebar from "./components/Sidebar";
import Toolbar from "./components/Toolbar";
import type {
  AnnotationBox,
  AnnotationImage,
  AnnotationParseResult,
  AnnotationSource,
  DirectoryHandle,
  ImageMetrics
} from "./types";
import { buildAttemptedPath, getBaseName, normalizePath } from "./utils/paths";
import {
  parseAnnotationBoxes,
  parseCoco,
  parseCocoText,
  parseVoc,
  parseYolo
} from "./utils/parsers";

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
  const [annotationSource, setAnnotationSource] = useState<AnnotationSource>(
    null
  );
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
  const [imageMetrics, setImageMetrics] = useState<ImageMetrics>({
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
      const rootName = handle.name ?? "選択済み";
      setImageRootHandle(handle);
      setImageRootName(rootName);
      if (selectedImageName) {
        const loaded = await tryLoadImageFromHandle(handle, selectedImageName);
        if (!loaded) {
          setImageMismatch(
            `画像の読み込みに失敗しました。パス: ${buildAttemptedPath(
              rootName,
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
        parseResult = parseYolo(rawText, imageMetrics, imageName);
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
                  imageRootName,
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
            imageRootName,
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
      <Toolbar
        onImageClick={handleImageClick}
        onAnnotationClick={handleAnnotationClick}
        onSelectRootFolder={handleSelectRootFolder}
        imageRootName={imageRootName}
        onSave={handleSaveAnnotations}
        canSave={annotationBoxes.length > 0 && Boolean(imageName)}
        showAnnotationPanel={showAnnotationPanel}
        onToggleAnnotationPanel={() =>
          setShowAnnotationPanel((prev) => !prev)
        }
      />

      <input
        ref={imageInputRef}
        className="file-input"
        type="file"
        accept="image/*"
        aria-label="画像ファイルを選択"
        onChange={handleImageChange}
      />

      <input
        ref={annotationInputRef}
        className="file-input"
        type="file"
        accept=".json,.xml,.txt,.csv"
        aria-label="アノテーションデータを選択"
        onChange={(event) => void handleAnnotationChange(event)}
      />

      <main className="layout">
        <Sidebar
          items={annotationItems}
          selectedImageId={selectedImageId}
          onSelect={handleSelectImageItem}
          getBoxCount={getBoxCount}
        />
        <CanvasArea
          imageUrl={imageUrl}
          imageName={imageName}
          imageRef={imageRef}
          onImageLoad={handleImageLoad}
          annotationBoxes={annotationBoxes}
          hasAnnotations={hasAnnotations}
          svgSize={svgSize}
          imageMetrics={imageMetrics}
          annotationName={annotationName}
          showAnnotationPanel={showAnnotationPanel}
          annotationContent={annotationContent}
          annotationError={annotationError}
          annotationFormat={annotationFormat}
          annotationWarning={annotationWarning}
          imageMismatch={imageMismatch}
          selectedImageName={selectedImageName}
          onImageClick={handleImageClick}
        />
      </main>
    </div>
  );
}
