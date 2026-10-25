import React, { useRef, useState } from "react";
import { MAX_COLS, MAX_ROW_SPAN, MIN_COLS, clearPositions, fits, gridArea, resolveLayout, rowCount } from "../lib/layout";
import { getTextColor } from "../lib/tags";

const ROW_HEIGHT = 56;
const GAP = 8;

const Stepper = ({ label, value, onDec, onInc, canDec, canInc }) => (
  <div className="flex items-center gap-1 h-9 pl-2.5 pr-1 rounded-lg bg-ink-800 border border-ink-700 text-xs font-medium text-ink-400">
    {label}
    <button onClick={onDec} disabled={!canDec} aria-label={`Decrease ${label}`} className="w-7 h-7 rounded-md text-white text-base hover:bg-ink-700 disabled:opacity-30">
      −
    </button>
    <span className="w-5 text-center text-sm text-white tabular-nums">{value}</span>
    <button onClick={onInc} disabled={!canInc} aria-label={`Increase ${label}`} className="w-7 h-7 rounded-md text-white text-base hover:bg-ink-700 disabled:opacity-30">
      +
    </button>
  </div>
);

// Drag a button to move it, drag its corner to resize, tap it to select and use the steppers.
const LayoutEditor = ({ tags, cols, onChangeTags, onChangeCols }) => {
  const gridRef = useRef(null);
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [selected, setSelected] = useState(null);

  const items = resolveLayout(tags, cols);
  const selectedItem = items.find((i) => i.tag.name === selected);
  const others = (name) => items.filter((i) => i.tag.name !== name);

  const extent = drag ? Math.max(rowCount(items), drag.rect.y + drag.rect.h) : rowCount(items);
  const rows = Math.max(extent, 1) + 1; // one spare row to drag into

  // Persist the resolved rectangle of every tag, with `name` moved to `rect`
  const commit = (name, rect) => {
    const pos = Object.fromEntries(items.map(({ tag, x, y, w, h }) => [tag.name, { x, y, w, h }]));
    pos[name] = rect;
    onChangeTags(tags.map((t) => ({ ...t, ...pos[t.name] })));
  };

  const cellAt = (e) => {
    const box = gridRef.current.getBoundingClientRect();
    return {
      cx: Math.floor(((e.clientX - box.left) / (box.width + GAP)) * cols),
      cy: Math.floor((e.clientY - box.top) / (ROW_HEIGHT + GAP)),
    };
  };

  const startDrag = (e, item, mode) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const { cx, cy } = cellAt(e);
    const origin = { x: item.x, y: item.y, w: item.w, h: item.h };
    dragRef.current = { name: item.tag.name, mode, origin, grab: { dx: cx - item.x, dy: cy - item.y }, rect: origin, moved: false, valid: true };
    setDrag(dragRef.current);
  };

  const moveDrag = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const { cx, cy } = cellAt(e);
    const { origin } = d;
    const rect =
      d.mode === "move"
        ? {
            ...origin,
            x: Math.max(0, Math.min(cols - origin.w, cx - d.grab.dx)),
            y: Math.max(0, cy - d.grab.dy),
          }
        : {
            ...origin,
            w: Math.max(1, Math.min(cols - origin.x, cx - origin.x + 1)),
            h: Math.max(1, Math.min(MAX_ROW_SPAN, cy - origin.y + 1)),
          };
    if (rect.x === d.rect.x && rect.y === d.rect.y && rect.w === d.rect.w && rect.h === d.rect.h) return;
    const moved = rect.x !== origin.x || rect.y !== origin.y || rect.w !== origin.w || rect.h !== origin.h;
    dragRef.current = { ...d, rect, moved: d.moved || moved, valid: fits(rect, others(d.name), cols) };
    setDrag(dragRef.current);
  };

  const endDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    if (!d.moved) {
      setSelected((s) => (s === d.name ? null : d.name));
    } else if (d.valid) {
      commit(d.name, d.rect);
      setSelected(d.name);
    }
  };

  const cancelDrag = () => {
    dragRef.current = null;
    setDrag(null);
  };

  const resizeSelected = (dw, dh) => {
    const rect = { x: selectedItem.x, y: selectedItem.y, w: selectedItem.w + dw, h: selectedItem.h + dh };
    if (rect.h <= MAX_ROW_SPAN && fits(rect, others(selected), cols)) commit(selected, rect);
  };
  const canResize = (dw, dh) => {
    if (!selectedItem) return false;
    const rect = { x: selectedItem.x, y: selectedItem.y, w: selectedItem.w + dw, h: selectedItem.h + dh };
    return rect.h <= MAX_ROW_SPAN && fits(rect, others(selected), cols);
  };

  const handleAutoArrange = () => {
    if (window.confirm("Reset the layout? All buttons go back to 1×1, placed in group order.")) {
      onChangeTags(clearPositions(tags));
      setSelected(null);
    }
  };

  const dragHandlers = { onPointerMove: moveDrag, onPointerUp: endDrag, onPointerCancel: cancelDrag };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Stepper
          label="Columns"
          value={cols}
          onDec={() => onChangeCols(cols - 1)}
          onInc={() => onChangeCols(cols + 1)}
          canDec={cols > MIN_COLS}
          canInc={cols < MAX_COLS}
        />
        <button onClick={handleAutoArrange} className="ml-auto h-9 px-3 rounded-lg text-sm font-semibold text-ink-200 hover:bg-ink-800">
          Auto arrange
        </button>
      </div>

      <div
        ref={gridRef}
        className="grid select-none"
        style={{
          gap: GAP,
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, ${ROW_HEIGHT}px)`,
        }}
      >
        {Array.from({ length: rows * cols }, (_, i) => (
          <div
            key={`cell-${i}`}
            className="rounded-lg border border-dashed border-ink-700"
            style={{ gridColumn: (i % cols) + 1, gridRow: Math.floor(i / cols) + 1 }}
          />
        ))}

        {items.map((item) => {
          const { tag } = item;
          const isDragged = drag?.name === tag.name && drag.moved;
          const isSelected = selected === tag.name;
          return (
            <div
              key={tag.name}
              onPointerDown={(e) => startDrag(e, item, "move")}
              {...dragHandlers}
              className={`relative rounded-xl flex items-center justify-center text-center px-1 cursor-grab active:cursor-grabbing transition-opacity ${
                isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-ink-900" : ""
              } ${isDragged ? "opacity-40" : ""}`}
              style={{ ...gridArea(item), backgroundColor: tag.color, color: getTextColor(tag.color), touchAction: "none" }}
            >
              <span className="text-[11px] sm:text-xs font-extrabold uppercase leading-tight break-words line-clamp-3">
                {tag.name}
              </span>
              <span
                onPointerDown={(e) => startDrag(e, item, "resize")}
                {...dragHandlers}
                aria-label={`Resize ${tag.name}`}
                className="absolute right-0 bottom-0 w-7 h-7 flex items-end justify-end p-1 cursor-se-resize"
                style={{ touchAction: "none" }}
              >
                <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 opacity-70" aria-hidden="true">
                  <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </div>
          );
        })}

        {drag?.moved && (
          <div
            className={`rounded-xl border-2 pointer-events-none ${drag.valid ? "border-accent bg-accent/15" : "border-red-400 bg-red-500/15"}`}
            style={{ ...gridArea(drag.rect), zIndex: 10 }}
          />
        )}
      </div>

      {selectedItem ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedItem.tag.color }} />
          <span className="font-bold uppercase text-sm mr-1">{selectedItem.tag.name}</span>
          <Stepper
            label="Width"
            value={selectedItem.w}
            onDec={() => resizeSelected(-1, 0)}
            onInc={() => resizeSelected(1, 0)}
            canDec={selectedItem.w > 1}
            canInc={canResize(1, 0)}
          />
          <Stepper
            label="Height"
            value={selectedItem.h}
            onDec={() => resizeSelected(0, -1)}
            onInc={() => resizeSelected(0, 1)}
            canDec={selectedItem.h > 1}
            canInc={canResize(0, 1)}
          />
        </div>
      ) : (
        <p className="text-sm text-ink-400">Drag to move · drag the corner to resize · tap a button to change its size.</p>
      )}
    </div>
  );
};

export default LayoutEditor;
