export const normalizePath = (value: string) => value.replace(/\\/g, "/");

export const getBaseName = (value: string) => {
  const normalized = normalizePath(value);
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
};

export const buildAttemptedPath = (rootName: string | null, fileName: string) => {
  const rootLabel = rootName ?? "未選択";
  return `ルート: ${rootLabel} / 相対パス: ${normalizePath(fileName)}`;
};
