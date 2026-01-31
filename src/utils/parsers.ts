import type {
  AnnotationBox,
  AnnotationParseResult,
  ImageMetrics
} from "../types";

export const parseAnnotationBoxes = (data: unknown): AnnotationBox[] => {
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

export const parseCoco = (data: any): AnnotationParseResult => {
  const images = Array.isArray(data.images) ? data.images : [];
  const annotations = Array.isArray(data.annotations) ? data.annotations : [];
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const categoryMap = new Map(
    categories
      .filter((cat: any) => cat && cat.id != null)
      .map((cat: any) => [cat.id, cat.name ?? String(cat.id)])
  );
  const boxes = annotations.map((ann: any, index: number) => {
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

export const parseCocoText = (data: any): AnnotationParseResult => {
  const images = Array.isArray(data.images) ? data.images : [];
  const annotations = Array.isArray(data.annotations) ? data.annotations : [];
  const boxes = annotations.map((ann: any, index: number) => {
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

export const parseVoc = (rawText: string): AnnotationParseResult => {
  const parser = new DOMParser();
  const xml = parser.parseFromString(rawText, "application/xml");
  const parserError = xml.querySelector("parsererror");
  if (parserError) {
    throw new Error("XMLの解析に失敗しました");
  }

  const fileName =
    xml.getElementsByTagName("filename")[0]?.textContent ?? "image.jpg";
  const width = Number(xml.getElementsByTagName("width")[0]?.textContent ?? 0);
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

export const parseYolo = (
  rawText: string,
  imageMetrics: ImageMetrics,
  fallbackImageName: string | null
): AnnotationParseResult => {
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

  const fallbackName = fallbackImageName ?? "image.jpg";
  return {
    boxes,
    format: "YOLO",
    images: [{ id: imageId, file_name: fallbackName }]
  };
};
