import type { AnnotationImage } from "../types";
import { getBaseName } from "../utils/paths";

type SidebarProps = {
  items: AnnotationImage[];
  selectedImageId: number | null;
  onSelect: (item: AnnotationImage) => void | Promise<void>;
  getBoxCount: (imageId: number) => number;
};

export default function Sidebar({
  items,
  selectedImageId,
  onSelect,
  getBoxCount
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__header">アノテーション一覧</div>
      {items.length === 0 ? (
        <div className="sidebar__empty">データ未読込</div>
      ) : (
        <ul className="sidebar__list">
          {items.map((item, index) => {
            const isActive = item.id === selectedImageId;
            return (
              <li key={item.id}>
                <button
                  className={`sidebar__item${isActive ? " is-active" : ""}`}
                  type="button"
                  onClick={() => void onSelect(item)}
                >
                  <span className="sidebar__index">{index + 1}</span>
                  <span className="sidebar__name">{getBaseName(item.file_name)}</span>
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
  );
}
