export type AnnotationBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  imageId?: number;
};

export type AnnotationImage = {
  id: number;
  file_name: string;
  width?: number;
  height?: number;
};

export type DirectoryHandle = {
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

export type AnnotationParseResult = {
  boxes: AnnotationBox[];
  format: string;
  warning?: string;
  images?: AnnotationImage[];
};

export type AnnotationSource =
  | "coco"
  | "coco-text"
  | "voc"
  | "yolo"
  | "simple"
  | null;

export type ImageMetrics = {
  naturalWidth: number;
  naturalHeight: number;
  displayWidth: number;
  displayHeight: number;
};
