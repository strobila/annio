import { useRef } from "react";

export default function App() {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const annotationInputRef = useRef<HTMLInputElement>(null);

  const handleImageClick = () => imageInputRef.current?.click();
  const handleAnnotationClick = () => annotationInputRef.current?.click();

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
          />
        </div>

        <div className="toolbar__group">
          <button className="btn btn--primary" type="button">
            アノテーション保存
          </button>
          <span className="hint">※保存は作成・編集モードのみ</span>
        </div>
      </header>

      <main className="canvas-area">
        <div className="canvas">
          <div className="canvas__placeholder">
            画像とアノテーションをここに表示
          </div>
        </div>
      </main>
    </div>
  );
}
