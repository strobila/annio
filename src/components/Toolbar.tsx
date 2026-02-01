type ToolbarProps = {
  onImageClick: () => void;
  onAnnotationClick: () => void;
  onSelectRootFolder: () => void;
  imageRootName: string | null;
  onSave: () => void;
  canSave: boolean;
  mode: "view" | "edit";
  onToggleMode: () => void;
  showAnnotationPanel: boolean;
  onToggleAnnotationPanel: () => void;
};

export default function Toolbar({
  onImageClick,
  onAnnotationClick,
  onSelectRootFolder,
  imageRootName,
  onSave,
  canSave,
  mode,
  onToggleMode,
  showAnnotationPanel,
  onToggleAnnotationPanel
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar__group">
        <button className="btn" type="button" onClick={onImageClick}>
          画像読み込み
        </button>

        <button className="btn" type="button" onClick={onAnnotationClick}>
          アノテーション読込
        </button>

        <button className="btn" type="button" onClick={onSelectRootFolder}>
          画像ルートフォルダー選択
        </button>
        {imageRootName && <span className="hint">選択中: {imageRootName}</span>}
      </div>

      <div className="toolbar__group">
        <button className="btn" type="button" onClick={onToggleMode}>
          モード: {mode === "edit" ? "作成・編集" : "読取専用"}
        </button>
        <button
          className="btn btn--primary"
          type="button"
          onClick={onSave}
          disabled={!canSave}
        >
          アノテーション保存
        </button>
        <button className="btn" type="button" onClick={onToggleAnnotationPanel}>
          JSON表示: {showAnnotationPanel ? "ON" : "OFF"}
        </button>
        <span className="hint">※保存は作成・編集モードのみ</span>
      </div>
    </header>
  );
}
