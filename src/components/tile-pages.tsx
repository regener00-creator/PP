"use client";

import { useId, useState, type ReactNode } from "react";

const PAGE_SIZE = 20;

export function TilePages<T>({ items, label, renderItem }: {
  items: T[];
  label: string;
  renderItem: (item: T) => ReactNode;
}) {
  const gridId = useId();
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  // A deletion can remove the last page. Keep the next render on a valid page.
  if (page !== currentPage) setPage(currentPage);
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, items.length);

  if (!items.length) return null;
  return <>
    <div className="memory-tiles paginated-tiles" id={gridId} aria-label={label}>
      {items.slice(start, end).map(renderItem)}
    </div>
    <nav className="tile-pagination" aria-label={`เปลี่ยนหน้า${label}`}>
      <button type="button" className="secondary" aria-controls={gridId}
        aria-label={`หน้าก่อนหน้าของ${label}`} disabled={currentPage === 1}
        onClick={() => setPage(currentPage - 1)}>ก่อนหน้า</button>
      <p role="status" aria-live="polite" aria-atomic="true">
        หน้า {currentPage} / {pageCount}<span>{start + 1}–{end} จาก {items.length} รายการ</span>
      </p>
      <button type="button" className="secondary" aria-controls={gridId}
        aria-label={`หน้าถัดไปของ${label}`} disabled={currentPage === pageCount}
        onClick={() => setPage(currentPage + 1)}>ถัดไป</button>
    </nav>
  </>;
}
